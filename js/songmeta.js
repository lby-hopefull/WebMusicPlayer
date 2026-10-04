// ========== 歌曲元信息(idb: songMeta) ==========
// 每首歌存三项: addedTime(加入时间) / size(文件大小,字节) / duration(时长,秒)。
//   - 写入时机:缓存歌曲、批量下载、导入本地文件夹
//   - 补齐时机:播放时读出音频 metadata(未缓存的在线歌曲也能拿到时长)
//   - 删除时机:删除单曲缓存 / 批量删除歌曲时同步删除
//   - 老数据(本次改动前就缓存好的)由 backfillSongMeta() 一次性回填
// 记录在 idb 里是 {id: 歌名, data: {...}} —— 和 db.js 里其它 store 保持一致。

async function getSongMeta(name){
  const rec = await dbGet('songMeta', name);
  return rec && rec.data ? rec.data : null;
}

// 合并写入:只覆盖 patch 给出的字段,其余保持原值。
// 添加时间只在第一次记录时确定,之后再写不会被后来的调用改掉。
async function mergeSongMeta(name, patch){
  const cur = (await getSongMeta(name)) || {};
  const next = Object.assign({}, cur, patch);
  const ok = await dbPut('songMeta', name, next);
  if(ok) songMetaMap[name] = next;
  return next;
}

async function deleteSongMeta(name){
  if(!name) return false;
  const ok = await dbDelete('songMeta', name);
  delete songMetaMap[name];
  return ok;
}

// 把整张 songMeta 表读进内存(排序时要用;表里只有小对象,读一次很便宜)
async function loadSongMetaMap(){
  const all = await dbGetAll('songMeta');
  const m = {};
  all.forEach(rec => {
    if(rec && rec.id != null) m[String(rec.id)] = rec.data || {};
  });
  songMetaMap = m;
  return m;
}

// 已缓存歌曲名列表(getAllKeys 只取键,不读音频本体)
async function getAllCachedKeys(){
  if(!db) return [];
  return new Promise(resolve => {
    const req = db.transaction([storeName], 'readonly').objectStore(storeName).getAllKeys();
    req.onsuccess = () => resolve((req.result || []).filter(k => typeof k === 'string'));
    req.onerror = () => resolve([]);
  });
}

// 探测音频时长:建个临时 audio 读文件头的 metadata,读完立刻释放对象 URL。
// 失败/超时一律 null —— 元信息补不齐不该影响播放、缓存这些主流程。
function probeAudioDuration(source){
  return new Promise(resolve => {
    let url;
    try { url = URL.createObjectURL(source); } catch(e) { return resolve(null); }
    const el = document.createElement('audio');
    let settled = false;
    const finish = v => {
      if(settled) return;
      settled = true;
      el.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(v);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => finish(isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    el.onerror = () => finish(null);
    el.src = url;
    setTimeout(() => finish(null), 15000);   // 兜底:别让探测把调用方挂死
  });
}

// 记录元信息。opts: {addedTime, size, duration, blob}
//   blob 只有第一次需要(用来探测时长),已经有时长就不会再探测。
// 全程吞异常:元信息是附加信息,失败不能拖累调用方。
async function recordSongMeta(name, opts){
  if(!db || !name) return null;
  const o = opts || {};
  try {
    const cur = await getSongMeta(name);
    const patch = {};
    if(!cur || cur.addedTime == null) patch.addedTime = o.addedTime != null ? o.addedTime : Date.now();
    if(o.size != null && (!cur || cur.size !== o.size)) patch.size = o.size;
    if(o.duration != null && isFinite(o.duration) && o.duration > 0 && (!cur || cur.duration == null)) patch.duration = o.duration;
    if(Object.keys(patch).length) await mergeSongMeta(name, patch);

    const known = songMetaMap[name] || cur;
    if((!known || known.duration == null) && o.blob){
      const dur = await probeAudioDuration(o.blob);
      if(dur != null) await mergeSongMeta(name, { duration: dur });
    }
    return songMetaMap[name] || null;
  } catch(e){
    console.warn('记录歌曲元信息失败:', name, e && e.message);
    return null;
  }
}

// 老数据回填:改动之前缓存的歌没有元信息,这里补一次(大小 + 时长 + 添加时间)。
// 只跑一次(setting 里留标记),在后台执行,不挡启动;中途出错就下次启动接着来。
async function backfillSongMeta(){
  if(!db) return;
  const done = await dbGet('setting', 'songMetaBackfillDone');
  if(done && done.data) return;

  const keys = await getAllCachedKeys();
  let filled = 0;
  for(const name of keys){
    try{
      const cur = await getSongMeta(name);
      const needSize = !cur || cur.size == null;
      const needDur = !cur || cur.duration == null;
      const needTime = !cur || cur.addedTime == null;
      if(!needSize && !needDur && !needTime) continue;

      const buf = await getMusic(name);
      if(!buf) continue;

      const patch = {};
      // 老数据的真实"加入时间"已经无从考证,用回填时刻顶替(同批数据时间相同,排序时按名称兜底)
      if(needTime) patch.addedTime = Date.now();
      if(needSize) patch.size = (buf.byteLength != null ? buf.byteLength : buf.size);
      if(needDur){
        const dur = await probeAudioDuration(new Blob([buf], { type: 'audio/mpeg' }));
        if(dur != null) patch.duration = dur;
      }
      if(Object.keys(patch).length){ await mergeSongMeta(name, patch); filled++; }
    }catch(e){
      console.warn('回填元信息失败:', name, e && e.message);
    }
  }
  await dbPut('setting', 'songMetaBackfillDone', true);
  if(filled) console.log(`已回填 ${filled} 首歌曲的元信息`);
}

// ========== 元信息显示 ==========
function formatClock(sec){
  if(sec == null || !isFinite(sec)) return '';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const mm = String(m).padStart(2, '0'), sss = String(ss).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${sss}` : `${m}:${sss}`;
}

function formatBytes(n){
  if(n == null || !isFinite(n)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n, i = 0;
  while(v >= 1024 && i < units.length - 1){ v /= 1024; i++; }
  return (i === 0 ? String(v) : v.toFixed(v >= 100 ? 0 : 1)) + ' ' + units[i];
}

function formatAddedTime(t){
  if(t == null || !isFinite(t)) return '';
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 一行简短元信息:时长 · 大小(管理界面再加上加入时间),没有的项自动省略
function songMetaBrief(name, withAdded){
  const m = songMetaMap[name];
  if(!m) return '';
  const parts = [];
  if(m.duration != null) parts.push(formatClock(m.duration));
  if(m.size != null) parts.push(formatBytes(m.size));
  if(withAdded && m.addedTime != null) parts.push(formatAddedTime(m.addedTime));
  return parts.join(' · ');
}
