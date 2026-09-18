// ========== 系统媒体播放器控制 ==========
// ========== 系统媒体播放器控制 ==========
function setupMediaSession() {
  if ('mediaSession' in navigator) {
    // 1. 设置核心动作处理器：播放、暂停、上一首、下一首
    navigator.mediaSession.setActionHandler('play', () => {
      if (audio.paused) {
        audio.play().catch(err=>{ console.warn('play() 被中断:', err.name); });
        isPlaying = true;
        updateBtn();
        updateMediaSessionPlaybackState();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (!audio.paused) {
        audio.pause();
        isPlaying = false;
        updateBtn();
        updateMediaSessionPlaybackState();
      }
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPrev(); // 调用您已有的上一首函数
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext(); // 调用您已有的下一首函数
    });

    // 2. 新增：支持快进/快退 (Seek)
    // 当用户点击系统面板的快进/快退按钮时触发
    try {
      navigator.mediaSession.setActionHandler('seekbackward', (event) => {
        // 如果事件带有偏移量（秒），则使用它，否则默认快退 10 秒
        const skipTime = event.seekOffset || 10;
        audio.currentTime = Math.max(0, audio.currentTime - skipTime);
      });

      navigator.mediaSession.setActionHandler('seekforward', (event) => {
        // 如果事件带有偏移量（秒），则使用它，否则默认快进 10 秒
        const skipTime = event.seekOffset || 10;
        audio.currentTime = Math.min(audio.duration, audio.currentTime + skipTime);
      });

      // 3. 新增：支持进度条拖拽 (Scrubbing)
      // 监听系统面板的拖拽事件
      navigator.mediaSession.setActionHandler('seekto', (event) => {
        if (event.fastSeek && 'fastSeek' in audio) {
          // 如果浏览器支持快速定位（不触发 timeupdate）
          audio.fastSeek(event.seekTime);
          return;
        }
        // 普通定位
        audio.currentTime = event.seekTime;
      });

    } catch (error) {
      console.warn("部分媒体会话功能（快进/快退/拖拽）可能不受支持:", error);
    }

    // 初始化播放状态
    updateMediaSessionPlaybackState();
  }
}
function updateMediaSessionPositionState() {
  if ('mediaSession' in navigator && audio.duration) {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate,
      position: audio.currentTime
    });
  }
}


function updateMediaSessionMetadata(songName, artist, album, coverUrl) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: songName,
      artist: artist || '未知歌手',
      album: album || '',
      artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }
}

function updateMediaSessionPlaybackState() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }
}

// 更新歌词到系统通知（歌曲名显示歌词，歌手栏显示"歌曲名 - 歌手"）
function updateMediaSessionLyrics(currentLineText) {
  if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
    const originalTitle = navigator.mediaSession.metadata.title;
    const originalArtist = navigator.mediaSession.metadata.artist;
    
    // 保存原始信息（首次调用时）
    if (!window.originalMediaInfo) {
      window.originalMediaInfo = {
        title: originalTitle,
        artist: originalArtist
      };
    }
    
    // 歌曲名栏显示当前歌词，歌手栏显示"歌曲名 - 歌手"
    if (currentLineText && currentLineText.trim()) {
      navigator.mediaSession.metadata.title = currentLineText;
      navigator.mediaSession.metadata.artist = `${window.originalMediaInfo.title} - ${window.originalMediaInfo.artist}`;
    } else {
      // 恢复原始显示
      navigator.mediaSession.metadata.title = window.originalMediaInfo.title;
      navigator.mediaSession.metadata.artist = window.originalMediaInfo.artist;
    }
  }
}



