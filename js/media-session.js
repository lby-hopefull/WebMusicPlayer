// ========== 系统媒体播放器控制 ==========
function setupMediaSession() {
  if ('mediaSession' in navigator) {
    // 注册核心动作处理器：播放、暂停、上一首、下一首
    navigator.mediaSession.setActionHandler('play', () => {
      if (audio.paused) {
        audio.play().catch(err=>{ console.warn('play() 被中断：', err.name); });
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
      playPrev();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNext();
    });

    // 快进与快退：点击系统面板的快进或快退按钮时触发
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

      // 进度拖拽：响应系统面板上的拖动定位
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
      console.warn("部分媒体会话功能（快进 / 快退 / 拖拽）可能不受支持：", error);
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

// 把当前歌词同步到系统通知：标题栏显示歌词，歌手栏显示「歌曲名 - 歌手」
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
    
    // 标题栏显示当前歌词，歌手栏显示「歌曲名 - 歌手」
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



