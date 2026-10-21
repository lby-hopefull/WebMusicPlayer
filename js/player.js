// ========== 播放控制 ==========
// 音频预加载：提前缓存下一首，减少切歌等待
let preloadedNext = null;

async function preloadNextSong() {
  const nextIdx = (currentTrack + 1) % currentQueue.length;
  const nextSong = currentQueue[nextIdx];
  if (!nextSong || await getMusic(nextSong)) return;

  // 后台静默缓存，不阻塞当前播放
  preloadedNext = nextSong;
  fetch('/music_play?file=' + encodeURIComponent(nextSong))
    .then(r => r.arrayBuffer())
    .then(b => {
      if (preloadedNext === nextSong) {
        saveMusic(nextSong, b);
        recordSongMeta(nextSong, { size: b.byteLength, blob: new Blob([b], {type:'audio/mpeg'}) });
      }
    })
    .catch(err => console.warn('预加载失败：', err));
}

async function playTrack(i){
  if(i<0||i>=currentQueue.length) return;
  // 防重入：两次切换并发时只让最新的一次生效
  const seq = (playTrack._seq = (playTrack._seq||0) + 1);
  await dbPut('currentList', 'lastSong', currentQueue[i]);
  if(seq !== playTrack._seq) return; // 已有更新的切换，放弃本次
  currentTrack=i;
  const name=currentQueue[i];
  
  trackedSongs[name] = false;
  
  // 切歌前先显式暂停，避免旧的 play() promise 被 AbortError 打断
  try{ audio.pause(); }catch(e){}
  let audioUrl;
  const cached=await getMusic(name);
  if(seq !== playTrack._seq) return; // await 期间又有新切换
  let blob = null;
  if(cached){
    blob = new Blob([cached],{type:'audio/mpeg'});
    audioUrl = URL.createObjectURL(blob);
    audio.src = audioUrl;
    loadSongMetadata(name, blob);
    // 顺手补元信息：缓存数据就在手上，大小不用再读一次 idb
    if(!(songMetaMap[name] && songMetaMap[name].size != null)){
      recordSongMeta(name, { size: (cached.byteLength != null ? cached.byteLength : cached.size) });
    }
  } else {
    audioUrl = '/music_play?file='+encodeURIComponent(name);
    audio.src = audioUrl;
    loadSongMetadata(name, audioUrl);
    cacheSong(name);
  }
  
  // 同步系统媒体会话展示的信息
  setupMediaSession();
  updateMediaSessionMetadata(name, '未知歌手', '', null);
  window.originalMediaInfo = null;
  
  // play() 返回 promise，此处捕获 AbortError 等中断，避免影响自动切歌
  audio.play().catch(err=>{ console.warn('play() 被中断：', err.name); });
  isPlaying=true;updateBtn();highlight();

  // 预加载下一首
  preloadNextSong();

  // 恢复上次播放进度（如果是同一首歌）
  const lastProgress = await dbGet('currentList', 'lastProgress');
  if(lastProgress && lastProgress.data && lastProgress.data.song === name) {
    if(audio.duration && lastProgress.data.progress < audio.duration * 0.95) {
      audio.currentTime = lastProgress.data.progress;
    }
  }
}

function togglePlayPause(){
  if(!audio.src)return;
  // 以音频真实状态为准，避免连点后 isPlaying 标志与实际不同步
  if(audio.paused){
    audio.play().catch(err=>{ console.warn('play() 被中断：', err.name); });
    isPlaying=true;
  }else{
    audio.pause();
    isPlaying=false;
  }
  updateBtn();
  updateMediaSessionPlaybackState(); 
}

function updateBtn(){
  const btn = domCache.playPauseBtn || document.getElementById('playPauseBtn');
  // 图标取自全局 sprite：播放与暂停只是换 <use> 的指向，不动按钮的其他结构
  setIcon(btn.querySelector('svg'), isPlaying?'pause-fill':'play-fill');
  // 按钮内容只有在变化时才需要同步无障碍名
  btn.setAttribute('aria-label', isPlaying?'暂停':'播放');
}

async function playNext(){
  await saveCurrentProgress();
  if(currentQueue.length === 0) return;
  const mode=document.getElementById('playMode').value;
  if(mode==='random'){
    // 随机模式等价于「洗过的队列按序播放」：
    // 队列内还有下一首就继续往下走，播放到队尾时重新洗牌并回到第一首。
    // （旧实现每次随机抽取一首，既无法保证播完一轮，也可能连续播放同一首）
    if(currentTrack < currentQueue.length - 1){
      await playTrack(currentTrack+1);
    } else {
      await reshuffleAndRestart();
    }
  }else if(mode==='loop'){
    await playTrack(currentTrack);
  }else if(currentTrack<currentQueue.length-1){
    await playTrack(currentTrack+1);
  } else {
    await playTrack(0);
  }
}

// 随机模式放完整个队列：重新洗牌，再从第一首开始
async function reshuffleAndRestart(){
  const finished = currentQueue[currentTrack];
  shuffleArrayInPlace(currentQueue);
  // 避免刚播完的这一首又立刻排到队首（队列只有一首时无需处理）
  if(currentQueue.length > 1 && currentQueue[0] === finished){
    [currentQueue[0], currentQueue[1]] = [currentQueue[1], currentQueue[0]];
  }
  currentTrack = 0;
  await dbPut('currentList', 'queue', currentQueue);
  renderPlaylist();
  await playTrack(0);
}

async function playPrev(){
  await saveCurrentProgress();
  if(currentQueue.length === 0) return;
  // 上一首即队列中的前一曲，到队首后绕回队尾。
  // 随机模式同样适用：队列本身已洗过牌，若再随机抽取，「上一首 / 下一首」将无法对应。
  await playTrack((currentTrack-1+currentQueue.length)%currentQueue.length);
}

audio.addEventListener('timeupdate',()=>{
  if(audio.duration){
    const progressBar = domCache.progressBar || document.getElementById('progressBar');
    progressBar.value=(audio.currentTime/audio.duration)*100;
    // 高亮段宽度来自 --fill-ratio，程序改动 value 后必须显式同步这一下
    syncRangeFill(progressBar);
    const trackProgress = domCache.trackProgress || document.getElementById('trackProgress');
    trackProgress.textContent=format(audio.currentTime)+'/'+format(audio.duration);
    // 歌词高亮交由 requestAnimationFrame 驱动（见 lyrics.js）；timeupdate 频率仅约 4Hz，不足以支撑逐字动画
    updateMediaSessionPositionState();
    if(audio.duration > 0 && audio.currentTime / audio.duration >= 0.8) {
      const currentSong = currentQueue[currentTrack];
      if(currentSong && !trackedSongs[currentSong]) {
        incStats(currentSong);
        trackedSongs[currentSong] = true;
      }
    }
  }
});

document.getElementById('progressBar').addEventListener('input',function(){
  if(audio.duration)audio.currentTime=(this.value/100)*audio.duration;
});

audio.addEventListener('ended',()=>playNext());

// ===== 加载失败自动跳过 + 播放停滞看门狗 =====
let consecutiveFailures=0;
audio.addEventListener('error',()=>{
  console.warn('音频加载失败：', audio.currentSrc||audio.src);
  if(!currentQueue.length) return;
  if(++consecutiveFailures>Math.min(currentQueue.length,5)){
    console.warn('连续失败过多，停止自动跳过');
    consecutiveFailures=0;
    return;
  }
  setTimeout(()=>playNext(),1000);
});
audio.addEventListener('playing',()=>{ consecutiveFailures=0; });

let lastTimeupdateAt=Date.now(), lastHeardTime=-1;
audio.addEventListener('timeupdate',()=>{
  // 播放时间确实推进才算「正在播放」（避免原地重复触发）
  if(audio.currentTime!==lastHeardTime){
    lastHeardTime=audio.currentTime;
    lastTimeupdateAt=Date.now();
  }
});
// 播放停滞看门狗：每 5 秒检查一次；若处于播放状态且进度 12 秒未推进，则自动切下一首
let stallTimerId=null;
function startStallWatch(){
  if(stallTimerId!==null) return;
  lastTimeupdateAt=Date.now(); // 从后台切回前台时必须重置，否则会被立即判定为停滞
  stallTimerId=setInterval(()=>{
    if(isPlaying && !audio.paused && Date.now()-lastTimeupdateAt>12000){
      console.warn('播放停滞，自动切下一首');
      lastTimeupdateAt=Date.now(); // 防止切歌前的重复触发
      playNext();
    }
  },5000);
}
function stopStallWatch(){
  if(stallTimerId!==null){ clearInterval(stallTimerId); stallTimerId=null; }
}

function format(s){
  const m=Math.floor(s/60),sec=Math.floor(s%60);
  return`${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

async function saveCurrentProgress() {
  if(audio.src && currentQueue[currentTrack]) {
    await dbPut('currentList', 'lastProgress', {
      song: currentQueue[currentTrack],
      progress: audio.currentTime,
      timestamp: Date.now()
    });
  }
}

// 定期保存播放进度（每 3 秒）
let progressTimerId=null;
function startProgressTimer(){
  if(progressTimerId!==null) return;
  progressTimerId=setInterval(async () => {
    if(isPlaying && audio.src) {
      await saveCurrentProgress();
    }
  }, 3000);
}
function stopProgressTimer(){
  if(progressTimerId!==null){ clearInterval(progressTimerId); progressTimerId=null; }
}

// 计时器仅在页面可见时运行：切到后台或锁屏时停表，并顺带把进度写入存储，省电也省去无谓轮询
// （歌词的 rAF 循环本就会由浏览器自动暂停，回到前台时手动对齐一帧）
document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    stopStallWatch();
    stopProgressTimer();
    saveCurrentProgress();
  }else{
    startStallWatch();
    startProgressTimer();
    updateLyricHighlight();
  }
});
startStallWatch();
startProgressTimer();
// ========== 播放列表渲染 ==========
// 拖动结束后屏蔽紧随其后的 click，防止松手位置误触播放
let dragSuppressClick=false;
document.addEventListener('click', e=>{
  if(dragSuppressClick){ e.stopPropagation(); e.preventDefault(); }
}, true);

function renderPlaylist(){
  const box = domCache.playlist || document.getElementById('playlist');
  box.replaceChildren();
  if(currentQueue.length === 0) {
    const empty=document.createElement('div');
    empty.className='empty-hint';
    empty.textContent='暂无歌曲';
    box.appendChild(empty);
    return;
  }
  currentQueue.forEach((t,i)=>{
    const d=document.createElement('div');
    d.className='song';
    if(i===currentTrack)d.classList.add('playing');
    const nameSpan=document.createElement('span');
    nameSpan.textContent=t;
    nameSpan.style.overflow='hidden';
    nameSpan.style.whiteSpace='nowrap';
    nameSpan.style.textOverflow='ellipsis';
    d.appendChild(nameSpan);
    // 统一使用 addEventListener 而非 onclick 属性：便于解绑，也不与内联写法混用
    d.addEventListener('click',()=>playTrack(i));
    // 右侧拖动排序把手
    const handle=document.createElement('span');
    handle.className='drag-handle';
    handle.appendChild(iconEl('grip-vertical'));
    handle.title='长按拖动排序';
    handle.setAttribute('aria-label','长按拖动排序');
    d.appendChild(handle);
    attachDragSort(box, d, handle, i);
    box.appendChild(d);
  });
}

// 长按拖动手动排序（鼠标与触摸通用）
function attachDragSort(box, item, handle, index){
  let dragging=false, longPressTimer=null, placeholder=null;
  const DRAG_THRESHOLD=8; // 超过此位移视为开始拖动
  const LONG_PRESS_MS=0; // 长按触发时间

  function cleanup(){
    clearTimeout(longPressTimer);
    longPressTimer=null;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    item.style.transform='';
    document.querySelectorAll('.song.dragging').forEach(el=>{
      el.classList.remove('dragging');
      const ph=el.nextElementSibling;
      if(ph && ph.classList.contains('drag-placeholder')) ph.remove();
    });
    document.querySelectorAll('.drag-placeholder').forEach(el=>el.remove());
    dragging=false;
  }

  async function finishDrag(){
    const dragEl=document.querySelector('.song.dragging');
    const ph=document.querySelector('.drag-placeholder');
    if(dragEl && ph){
      // 新位置 = 剔除被拖动元素后，占位符所处的索引
      const others=[...box.querySelectorAll('.song')].filter(el=>el!==dragEl);
      const newIndex=others.indexOf(ph);
      if(newIndex>-1 && newIndex!==index){
        const moved=currentQueue.splice(index,1)[0];
        currentQueue.splice(newIndex,0,moved);
        // 保持正在播放的歌曲跟随移动
        if(currentTrack===index) currentTrack=newIndex;
        else if(index<currentTrack && newIndex>=currentTrack) currentTrack--;
        else if(index>currentTrack && newIndex<=currentTrack) currentTrack++;
        await dbPut('currentList','queue',currentQueue);
      }
    }
    cleanup();
    renderPlaylist();
    highlight();
    // click 事件在 pointerup 之后才派发，因此留到下一个宏任务再解除屏蔽
    setTimeout(()=>{ dragSuppressClick=false; }, 0);
  }

  function onMove(e){
    if(!dragging)return;
    const ph=document.querySelector('.drag-placeholder');
    if(!ph)return;
    // 条目以 fixed 定位悬浮并跟随指针，不占据布局空间。
    // 坐标换算到包含块系：fixed 的包含块未必是视口（见 startDrag）
    item.style.top=(itemTop0 + (e.clientY-startY) - containOriginY)+'px';
    const songs=[...box.querySelectorAll('.song:not(.dragging):not(.drag-placeholder)')];
    for(const s of songs){
      const r=s.getBoundingClientRect();
      if(e.clientY < r.top + r.height/2){
        box.insertBefore(ph, s);
        return;
      }
    }
    box.appendChild(ph);
  }

  let startY=0, itemTop0=0, itemLeft0=0, containOriginX=0, containOriginY=0;
  function startDrag(e){
    dragging=true;
    startY=e.clientY;
    const r=item.getBoundingClientRect();
    itemTop0=r.top;
    itemLeft0=r.left;
    // 用占位符顶住原位置
    placeholder=document.createElement('div');
    placeholder.className='song drag-placeholder';
    placeholder.style.height=r.height+'px';
    box.insertBefore(placeholder, item.nextSibling);
    item.classList.add('dragging');
    // 条目脱离文档流悬浮，避免列表凭空多出一行
    item.style.width=r.width+'px';
    item.style.position='fixed';
    item.style.margin=0;
    // fixed 元素的包含块未必是视口：祖先上的 contain: layout、transform、filter
    // 都会让它成为包含块（#playlist 上就有 contain: layout style）。
    // 直接把视口坐标写进 left/top，浮层会整体偏移一个「包含块原点」的量，
    // 偏移量随容器在页面上的位置而变，看起来就是浮层位置随机漂移。
    // 这里先把条目钉到 0,0 量出包含块原点，再把目标坐标换算进包含块系。
    item.style.left='0px';
    item.style.top='0px';
    const cbRect=item.getBoundingClientRect();
    containOriginX=cbRect.left;
    containOriginY=cbRect.top;
    item.style.left=(itemLeft0-containOriginX)+'px';
    item.style.top=(itemTop0-containOriginY)+'px';
    item.style.zIndex=1000;
    dragSuppressClick=true; // 松手后的 click 属于拖动，不能当播放点击
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    e.preventDefault();
  }

  function onUp(){
    if(dragging){ finishDrag(); }
    else { cleanup(); }
  }

  function onDown(e){
    if(e.button!==undefined && e.button!==0)return;
    // 长按或移动超过阈值才进入拖动状态，避免误触
    longPressTimer=setTimeout(()=>{
      longPressTimer=null;
      startDrag(e);
    }, LONG_PRESS_MS);
    const startX=e.clientX, startY=e.clientY;
    const onEarlyMove=(ev)=>{
      if(Math.abs(ev.clientX-startX)>DRAG_THRESHOLD || Math.abs(ev.clientY-startY)>DRAG_THRESHOLD){
        clearTimeout(longPressTimer);
        longPressTimer=null;
        document.removeEventListener('pointermove', onEarlyMove);
        document.removeEventListener('pointerup', onEarlyUp);
      }
    };
    const onEarlyUp=()=>{
      clearTimeout(longPressTimer);
      longPressTimer=null;
      document.removeEventListener('pointermove', onEarlyMove);
      document.removeEventListener('pointerup', onEarlyUp);
    };
    document.addEventListener('pointermove', onEarlyMove);
    document.addEventListener('pointerup', onEarlyUp);
  }

  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('dragstart', e=>e.preventDefault());
  // 点击把手本身不应触发播放
  handle.addEventListener('click', e=>e.stopPropagation());
  // 触摸设备上禁止把手区域触发页面滚动
  handle.style.touchAction='none';
}

function highlight(){
  document.querySelectorAll('#playlist .song').forEach((d,i)=>d.classList.toggle('playing',i===currentTrack));
}

// Fisher-Yates 洗牌：就地打乱（数组引用保持不变，调用方持有的别名随之更新）
function shuffleArrayInPlace(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = trueRandom(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function currentPlayMode(){
  const el = document.getElementById('playMode');
  return el ? el.value : 'sequential';
}

// 以编程方式切换播放模式。直接给 <select> 的 value 赋值不会触发 change 事件，
// 因此这里需要自行写入设置，否则刷新页面后会恢复成原来的模式。
async function setPlayMode(mode){
  const el = document.getElementById('playMode');
  if(!el || el.value === mode) return;
  el.value = mode;
  await dbPut('setting', 'playMode', mode);
}

async function shuffleQueue(){
  // 队列被打乱之后，播放模式必须跟着变成随机：
  // 否则「顺序」模式播完最后一首后会跳回队首，与刚洗好的队列不一致。
  await setPlayMode('random');
  if(currentQueue.length <= 1) return;
  shuffleArrayInPlace(currentQueue);
  currentTrack = 0;
  await dbPut('currentList', 'queue', currentQueue);
  renderPlaylist();
  playTrack(0);
}

async function cacheSong(name){
  if(await getMusic(name))return;
  const r=await fetch('/music_play?file='+encodeURIComponent(name));
  const b=await r.arrayBuffer();
  saveMusic(name,b);
  // 大小、添加时间与时长异步记录，不阻塞播放
  recordSongMeta(name, { size: b.byteLength, blob: new Blob([b],{type:'audio/mpeg'}) });
}

// 时长：任何一首歌（缓存或在线流）读出 metadata 后立即记录。
// 未缓存的在线歌曲只有播放过才有时长，这里补的正是这一类。
audio.addEventListener('loadedmetadata', () => {
  const name = currentQueue[currentTrack];
  if(!name || !isFinite(audio.duration) || audio.duration <= 0) return;
  const meta = songMetaMap[name];
  if(meta && meta.duration != null) return;
  recordSongMeta(name, { duration: audio.duration });
});

async function refreshList(){
  try {
    const response = await fetch('/music_list');
    if (!response.ok) throw new Error('获取失败');
    const serverTracks = await response.json();
    const savedTracks = await dbGet('playlist', 'all');
    const mergedTracks = sortSongsInPlace([...new Set([...(savedTracks?.data || []), ...serverTracks])]);
    tracks = mergedTracks;
    await dbPut('playlist', 'all', tracks);
    await dbPut('customLists', '全部歌曲', tracks);
    // 更新已缓存集合
    await updateCachedSongsSet();
    renderManageList();
    await uiAlert('列表已更新');
  } catch (error) {
    console.error('获取服务器列表失败：', error);
    const saved = await dbGet('playlist', 'all');
    if (saved) tracks = saved.data || [];
  }
}

function setVolume(value) {
  audio.volume = value / 100;
  dbPut('setting', 'volume', value);
  const v = domCache.volumeValue || document.getElementById('volumeValue');
  if(v)v.textContent=Math.round(value);
}

// 快进与快退（键盘左右方向键与系统媒体面板共用此函数）
function seekBy(seconds){
  if(!audio.src || !isFinite(audio.duration)) return;
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  updateLyricHighlight(); // 暂停时 rAF 循环没在跑，手动对齐一帧
}

