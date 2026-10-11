// ========== 歌曲元信息（IndexedDB: songMeta） ==========
// 每首歌记录三项：addedTime（加入时间）、size（文件大小，字节）、duration（时长，秒）。
//   - 写入时机：缓存歌曲、批量下载、导入本地文件夹
//   - 补齐时机：播放时读出音频 metadata（未缓存的在线歌曲也能取得时长）
//   - 删除时机：删除单曲缓存或批量删除歌曲时同步删除
//   - 历史数据（本次改造前已缓存的歌曲）由 backfillSongMeta() 一次性回填
// 库中记录形如 {id: 歌名, data: {...}}，与 db.js 中其它 store 保持一致。

async function getSongMeta(name){
  const rec = await dbGet('songMeta', name);
  return rec && rec.data ? rec.data : null;
}

// 合并写入：只覆盖 patch 给出的字段，其余保持原值。
// 添加时间只在第一次记录时确定，之后再写不会被后来的调用改掉。
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

// 把整张 songMeta 表读进内存(排序时要用；表里只有小对象，读一次很便宜)
async function loadSongMetaMap(){
  const all = await dbGetAll('songMeta');
  const m = {};
  all.forEach(rec => {
    if(rec && rec.id != null) m[String(rec.id)] = rec.data || {};
  });
  songMetaMap = m;
  return m;
}

// 已缓存歌曲名列表（getAllKeys 只取键，不读取音频本体）
async function getAllCachedKeys(){
  if(!db) return [];
  return new Promise(resolve => {
    const req = db.transaction([storeName], 'readonly').objectStore(storeName).getAllKeys();
    req.onsuccess = () => resolve((req.result || []).filter(k => typeof k === 'string'));
    req.onerror = () => resolve([]);
  });
}

// 探测音频时长：创建临时 audio 元素读取文件头的 metadata，读取完毕立即释放对象 URL。
// 失败或超时一律返回 null —— 元信息补齐与否不应影响播放、缓存等主流程。
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
    setTimeout(() => finish(null), 15000);   // 兜底超时，避免探测过程阻塞调用方
  });
}

// 记录元信息。opts 取值：{addedTime, size, duration, blob}
//   blob 仅在首次记录时需要（用于探测时长），已有时长则不再探测。
// 全程忽略异常：元信息属于附加信息，失败不应影响调用方。
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
    console.warn('记录歌曲元信息失败：', name, e && e.message);
    return null;
  }
}

// 历史数据回填：改造之前缓存的歌曲缺少元信息，此处补齐大小、时长与添加时间。
// 仅在 setting 中留下标记后执行一次，后台运行不阻塞启动；中途出错则下次启动时继续。
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
      // 历史数据的真实「加入时间」已无法追溯，以回填时刻替代
      // （同一批数据时间相同，排序时再由名称兜底）
      if(needTime) patch.addedTime = Date.now();
      if(needSize) patch.size = (buf.byteLength != null ? buf.byteLength : buf.size);
      if(needDur){
        const dur = await probeAudioDuration(new Blob([buf], { type: 'audio/mpeg' }));
        if(dur != null) patch.duration = dur;
      }
      if(Object.keys(patch).length){ await mergeSongMeta(name, patch); filled++; }
    }catch(e){
      console.warn('回填元信息失败：', name, e && e.message);
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

// 一行简短元信息：时长 · 大小（管理界面另附加入时间），缺失的项自动省略
function songMetaBrief(name, withAdded){
  const m = songMetaMap[name];
  if(!m) return '';
  const parts = [];
  if(m.duration != null) parts.push(formatClock(m.duration));
  if(m.size != null) parts.push(formatBytes(m.size));
  if(withAdded && m.addedTime != null) parts.push(formatAddedTime(m.addedTime));
  return parts.join(' · ');
}
