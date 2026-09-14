// ========== 初始化 ==========
(async()=>{
  await initDB();
  
  // 加载设置
  const volumeSetting = await dbGet('setting', 'volume');
  if(volumeSetting) {
    document.getElementById('volumeSlider').value = volumeSetting.data;
    audio.volume = volumeSetting.data / 100;
  }
  const volumeValue=document.getElementById('volumeValue');
  if(volumeValue) volumeValue.textContent=Math.round(document.getElementById('volumeSlider').value);
  // 加载播放模式
  const playModeSetting = await dbGet('setting', 'playMode');
  if(playModeSetting && playModeSetting.data) {
    document.getElementById('playMode').value = playModeSetting.data;
  }
  
  // 播放模式改变时保存
  document.getElementById('playMode').addEventListener('change', async function() {
    await dbPut('setting', 'playMode', this.value);
  });  
  
  // 加载歌词延迟
  await loadLyricDelay();
  
  try {
    const response = await fetch('/music_list');
    if (response.ok) {
      const serverTracks = await response.json();
      const savedTracks = await dbGet('playlist', 'all');
      tracks = [...new Set([...(savedTracks?.data || []), ...serverTracks])];
      await dbPut('playlist', 'all', tracks);
    } else {
      throw new Error('服务器响应错误');
    }
  } catch (error) {
    console.error('获取服务器列表失败:', error);
    const saved = await dbGet('playlist', 'all');
    if (saved) tracks = saved.data || [];
    else tracks = [];
  }

  const lists = await loadLists();
  lists['全部歌曲'] = tracks;
  await saveLists(lists);
  const savedQueue = await dbGet('currentList', 'queue');
  const lastSong = await dbGet('currentList', 'lastSong');
  const lastProgress = await dbGet('currentList', 'lastProgress');
  if(savedQueue && savedQueue.data && savedQueue.data.length > 0) {
    currentQueue = savedQueue.data;
  } else {
    currentQueue = [...tracks];
    await dbPut('currentList', 'queue', currentQueue);
  }

  // 恢复上次播放的歌曲和进度
  if(lastSong && lastSong.data && currentQueue.includes(lastSong.data)) {
    currentTrack = currentQueue.indexOf(lastSong.data);
    // 加载
    const name = currentQueue[currentTrack];
    let audioUrl;
    const cached = await getMusic(name);
    if(cached){
      const blob = new Blob([cached],{type:'audio/mpeg'});
      audioUrl = URL.createObjectURL(blob);
      audio.src = audioUrl;
      loadSongMetadata(name, blob);
    } else {
      audioUrl = '/music_play?file='+encodeURIComponent(name);
      audio.src = audioUrl;
      loadSongMetadata(name, audioUrl);
    }
    
    // 恢复进度
    if(lastProgress && lastProgress.data && lastProgress.data.song === name) {
      audio.addEventListener('loadedmetadata', function onLoaded() {
        if(audio.duration && lastProgress.data.progress < audio.duration * 0.95) {
          audio.currentTime = lastProgress.data.progress;
        }
        audio.removeEventListener('loadedmetadata', onLoaded);
      });
    }
  }

  renderPlaylist();
  renderLists();
  renderStats();
  renderManageList();
})();
// 在初始化代码块末尾添加
window.addEventListener('beforeunload', async () => {
  await saveCurrentProgress();
});
