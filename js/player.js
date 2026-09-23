// ========== 播放控制 ==========
async function playTrack(i){
  if(i<0||i>=currentQueue.length) return;
  // 防重入:两次切换并发时只让最新的一次生效
  const seq = (playTrack._seq = (playTrack._seq||0) + 1);
  await dbPut('currentList', 'lastSong', currentQueue[i]);
  if(seq !== playTrack._seq) return; // 已有更新的切换,放弃本次
  currentTrack=i;
  const name=currentQueue[i];
  
  trackedSongs[name] = false;
  
  // 切歌前先显式暂停,避免旧的 play() promise 被 AbortError 打断
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
  } else {
    audioUrl = '/music_play?file='+encodeURIComponent(name);
    audio.src = audioUrl;
    loadSongMetadata(name, audioUrl);
    cacheSong(name);
  }
  
  // 设置媒体会话（添加在这里）
  setupMediaSession();
  updateMediaSessionMetadata(name, '未知歌手', '', null);
  window.originalMediaInfo = null;
  
  // play() 返回 promise,捕获 AbortError 等中断,保证自动切歌不被打断
  audio.play().catch(err=>{ console.warn('play() 被中断:', err.name); });
  isPlaying=true;updateBtn();highlight();
  
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
  // 以音频真实状态为准,避免连点后 isPlaying 标志与实际不同步
  if(audio.paused){
    audio.play().catch(err=>{ console.warn('play() 被中断:', err.name); });
    isPlaying=true;
  }else{
    audio.pause();
    isPlaying=false;
  }
  updateBtn();
  updateMediaSessionPlaybackState(); 
}

function updateBtn(){
  const btn=document.getElementById('playPauseBtn');
  btn.textContent=isPlaying?'⏸':'▶';
  // 按钮内容只有符号,无障碍名必须跟着状态走
  btn.setAttribute('aria-label', isPlaying?'暂停':'播放');
}

async function playNext(){
  await saveCurrentProgress();
  if(currentQueue.length === 0) return;
  const mode=document.getElementById('playMode').value;
  if(mode==='random'){
    let n;
    if(currentQueue.length === 1) {
      n = 0;
    } else {
      do{n=trueRandom(currentQueue.length);}while(n===currentTrack);
    }
    await playTrack(n);
  }else if(mode==='loop'){
    await playTrack(currentTrack);
  }else if(currentTrack<currentQueue.length-1){
    await playTrack(currentTrack+1);
  } else {
    await playTrack(0);
  }
}

async function playPrev(){
  await saveCurrentProgress();
  if(currentQueue.length === 0) return;
  const mode=document.getElementById('playMode').value;
  if(mode==='random'){
    let n;
    if(currentQueue.length === 1) {
      n = 0;
    } else {
      do{n=trueRandom(currentQueue.length);}while(n===currentTrack);
    }
    await playTrack(n);
  }else{
    await playTrack((currentTrack-1+currentQueue.length)%currentQueue.length);
  }
}

audio.addEventListener('timeupdate',()=>{
  if(audio.duration){
    document.getElementById('progressBar').value=(audio.currentTime/audio.duration)*100;
    document.getElementById('trackProgress').textContent=format(audio.currentTime)+'/'+format(audio.duration);
    // 歌词高亮改由 requestAnimationFrame 驱动(见 lyrics.js),timeupdate 只有 ~4Hz,撑不起逐字动画
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
  console.warn('音频加载失败:', audio.currentSrc||audio.src);
  if(!currentQueue.length) return;
  if(++consecutiveFailures>Math.min(currentQueue.length,5)){
    console.warn('连续失败过多,停止自动跳过');
    consecutiveFailures=0;
    return;
  }
  setTimeout(()=>playNext(),1000);
});
audio.addEventListener('playing',()=>{ consecutiveFailures=0; });

let lastTimeupdateAt=Date.now(), lastHeardTime=-1;
audio.addEventListener('timeupdate',()=>{
  // 时间真的在走才算"活着"(防止原地重复触发)
  if(audio.currentTime!==lastHeardTime){
    lastHeardTime=audio.currentTime;
    lastTimeupdateAt=Date.now();
  }
});
// 停滞看门狗:每 5 秒检查一次,"正在播但 12 秒进度没动过"就自动切下一首
let stallTimerId=null;
function startStallWatch(){
  if(stallTimerId!==null) return;
  lastTimeupdateAt=Date.now(); // 从后台切回来必须重置,否则会立刻被误判为停滞
  stallTimerId=setInterval(()=>{
    if(isPlaying && !audio.paused && Date.now()-lastTimeupdateAt>12000){
      console.warn('播放停滞,自动切下一首');
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

// 添加新函数
async function saveCurrentProgress() {
  if(audio.src && currentQueue[currentTrack]) {
    await dbPut('currentList', 'lastProgress', {
      song: currentQueue[currentTrack],
      progress: audio.currentTime,
      timestamp: Date.now()
    });
  }
}

// 定期保存进度(每 3 秒)
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

// 计时器只在页面可见时跑:切到后台/锁屏就停表,顺便把进度落盘一次,省电也省一次无谓轮询
// (歌词的 rAF 循环浏览器本来就会自动暂停,回来时手动对齐一帧)
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
// 拖动结束后抑制紧随其后的 click,防止松手位置误触播放
let dragSuppressClick=false;
document.addEventListener('click', e=>{
  if(dragSuppressClick){ e.stopPropagation(); e.preventDefault(); }
}, true);

function renderPlaylist(){
  const box=document.getElementById('playlist');
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
    // 用 addEventListener 而不是 onclick 属性:可解绑、不与内联写法混用
    d.addEventListener('click',()=>playTrack(i));
    // 右侧拖动排序把手
    const handle=document.createElement('span');
    handle.className='drag-handle';
    handle.textContent='⣿';
    handle.title='长按拖动排序';
    handle.setAttribute('aria-label','长按拖动排序');
    d.appendChild(handle);
    attachDragSort(box, d, handle, i);
    box.appendChild(d);
  });
}

// 长按拖动手动排序(通用鼠标+触摸方案)
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
      // 新位置 = 排除拖动元素本身后占位符的索引
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
    // click 事件在 pointerup 之后才派发,留到下一个宏任务再解除抑制
    setTimeout(()=>{ dragSuppressClick=false; }, 0);
  }

  function onMove(e){
    if(!dragging)return;
    const ph=document.querySelector('.drag-placeholder');
    if(!ph)return;
    // 条目悬浮跟随指针(fixed 定位,不占布局空间)
    item.style.top=(itemTop0 + (e.clientY-startY))+'px';
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

  let startY=0, itemTop0=0;
  function startDrag(e){
    dragging=true;
    startY=e.clientY;
    const r=item.getBoundingClientRect();
    itemTop0=r.top;
    // 用占位符顶住原位置
    placeholder=document.createElement('div');
    placeholder.className='song drag-placeholder';
    placeholder.style.height=r.height+'px';
    box.insertBefore(placeholder, item.nextSibling);
    item.classList.add('dragging');
    // 条目脱离文档流悬浮,避免列表凭空多出一行
    item.style.width=r.width+'px';
    item.style.position='fixed';
    item.style.left=r.left+'px';
    item.style.top=r.top+'px';
    item.style.zIndex=1000;
    item.style.margin=0;
    dragSuppressClick=true; // 松手后的 click 属于拖动,不能当播放点击
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
    // 长按(或移动超过阈值)才进入拖动,避免误触
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

async function shuffleQueue(){
  if(currentQueue.length <= 1) return;
  // 使用真随机排序
  for(let i = currentQueue.length - 1; i > 0; i--) {
    const j = trueRandom(i + 1);
    [currentQueue[i], currentQueue[j]] = [currentQueue[j], currentQueue[i]];
  }
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
}

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
    console.error('获取服务器列表失败:', error);
    const saved = await dbGet('playlist', 'all');
    if (saved) tracks = saved.data || [];
  }
}

function setVolume(value) {
  audio.volume = value / 100;
  dbPut('setting', 'volume', value);
  const v=document.getElementById('volumeValue');
  if(v)v.textContent=Math.round(value);
}

// 快进/快退(键盘左右箭头与系统媒体面板共用)
function seekBy(seconds){
  if(!audio.src || !isFinite(audio.duration)) return;
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  updateLyricHighlight(); // 暂停时 rAF 循环没在跑,手动对齐一帧
}

