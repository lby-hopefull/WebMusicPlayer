// ========== 系统媒体播放器控制 ==========
function setupMediaSession() {
  if ('mediaSession' in navigator) {
    // 核心动作处理器：播放、暂停、上一首、下一首
    navigator.mediaSession.setActionHandler('play', () => {
      if (audio.paused) {
        audio.play();
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
      playPrev(); // 调用上一首函数
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext(); // 调用下一首函数
    });

    // 快进/快退
    try {
      navigator.mediaSession.setActionHandler('seekbackward', (event) => {
        const skipTime = event.seekOffset || 10;
        audio.currentTime = Math.max(0, audio.currentTime - skipTime);
      });

      navigator.mediaSession.setActionHandler('seekforward', (event) => {
        const skipTime = event.seekOffset || 10;
        audio.currentTime = Math.min(audio.duration, audio.currentTime + skipTime);
      });

      //进度条拖拽 (Scrubbing)
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

// 更新歌词到系统通知
function updateMediaSessionLyrics(currentLineText) {
  if ('mediaSession' in navigator && navigator.mediaSession.metadata) {
    const originalTitle = navigator.mediaSession.metadata.title;
    const originalArtist = navigator.mediaSession.metadata.artist;
    
    // 保存原始信息，初次
    if (!window.originalMediaInfo) {
      window.originalMediaInfo = {
        title: originalTitle,
        artist: originalArtist
      };
    }
    
    // 歌曲名栏显示当前歌词
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



