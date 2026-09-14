// ========== 歌词解析 ==========
function parseTimeToSeconds(timeStr) {
  const match = timeStr.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\]/);
  if (!match) return null;
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  const milliseconds = parseInt(match[3].padEnd(3, '0'));
  return minutes * 60 + seconds + milliseconds / 1000;
}

function parseLyrics(lyricText) {
  if (!lyricText || typeof lyricText !== 'string') return [];
  
  const lines = lyricText.split('\n');
  const lyrics = [];
  let lastMainLine = null;
  
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    
    // 提取所有时间戳
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const matches = [...rawLine.matchAll(timeRegex)];
    
    if (matches.length === 0) continue;
    
    // 判断是否为翻译行：
    // 1. 行首行尾时间戳相同 [00:38.62]...[00:38.62]
    // 2. 或者内容全是中文（不含英文字母）
    const firstTag = matches[0][0];
    const lastTag = matches[matches.length - 1][0];
    const contentWithoutTags = rawLine.replace(/\[.*?\]/g, '').trim();
    const isChineseOnly = /^[\u4e00-\u9fa5\s，。？！、：""''（）]+$/.test(contentWithoutTags);
    const isTranslateLine = (firstTag === lastTag && matches.length > 1) || (isChineseOnly && matches.length === 1 && lastMainLine && Math.abs(parseTimeToSeconds(firstTag) - lastMainLine.startTime) < 0.01);
    
    if (isTranslateLine && lastMainLine) {
      // 这是翻译行，附加到上一行
      lastMainLine.translate = contentWithoutTags;
      continue;
    }
    
    // 解析原文行
    const lineObj = {
      type: 'normal',
      startTime: parseInt(matches[0][1]) * 60 + parseInt(matches[0][2]) + parseInt(matches[0][3].padEnd(3, '0')) / 1000,
      text: '',
      translate: null,
      words: []
    };
    
    // 判断是否为逐词/逐字歌词（多个时间戳）
    if (matches.length > 1) {
      // 逐词解析
      let textContent = '';
      for (let j = 0; j < matches.length; j++) {
        const match = matches[j];
        const time = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3].padEnd(3, '0')) / 1000;
        
        // 提取该时间戳后的文本，直到下一个时间戳或行尾
        const startIdx = match.index + match[0].length;
        const endIdx = j < matches.length - 1 ? matches[j + 1].index : rawLine.length;
        let word = rawLine.substring(startIdx, endIdx).trim();
        
        // 清理尾部标点
        word = word.replace(/[,\?\.!\s]+$/, '');
        // 删除中文间不必要的空格
        word = word.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
        
        if (word) {
          lineObj.words.push({
            text: word,
            startTime: time,
            endTime: j < matches.length - 1 ? 
              parseInt(matches[j + 1][1]) * 60 + parseInt(matches[j + 1][2]) + parseInt(matches[j + 1][3].padEnd(3, '0')) / 1000 :
              time 
          });
          textContent += word;
        }
      }
      
      lineObj.text = textContent;
      lineObj.type = lineObj.words.length > 1 ? 'word-by-word' : 'normal';
      if (lineObj.words.length > 0) {
        lineObj.endTime = lineObj.words[lineObj.words.length - 1].endTime;
      }
    } else {
      // 普通行，单个时间戳
      lineObj.text = contentWithoutTags;
      // 删除中文间不必要的空格
      lineObj.text = lineObj.text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
      lineObj.endTime = lineObj.startTime + 3;
    }
    
    lyrics.push(lineObj);
    lastMainLine = lineObj;
  }
  
  return lyrics.sort((a, b) => a.startTime - b.startTime);
}

function loadSongMetadata(songName, audioUrl) {
  if (typeof jsmediatags !== 'undefined') {
    jsmediatags.read(audioUrl, {
      onSuccess: function(tag) {
        const tags = tag.tags;
        document.getElementById('songTitle').textContent = tags.title || songName;
        document.getElementById('songArtistAlbum').textContent = 
          `${tags.artist || '未知歌手'}${tags.album ? ' - ' + tags.album : ''}`;
        
        // 更新媒体会话元数据（添加）
        const artist = tags.artist || '未知歌手';
        const album = tags.album || '';
        let coverUrl = null;
        
        if (tags.picture) {
          const img = document.getElementById('coverImage');
          const base64String = btoa(tags.picture.data.map(b => String.fromCharCode(b)).join(''));
          coverUrl = `data:${tags.picture.format};base64,${base64String}`;
          img.src = coverUrl;
          img.style.display = 'block';
          document.getElementById('coverPlaceholder').style.display = 'none';
        } else {
          document.getElementById('coverImage').style.display = 'none';
          document.getElementById('coverPlaceholder').style.display = 'block';
        }
        
        updateMediaSessionMetadata(tags.title || songName, artist, album, coverUrl);
        window.originalMediaInfo = {
          title: tags.title || songName,
          artist: artist
        };
        
        const uslt = tags.USLT?.data || tags.USLT;
        const lyricText = uslt?.lyrics || uslt?.text || tags.unsynchronisedLyrics?.text || tags.lyrics || '';
        currentLyrics = parseLyrics(String(lyricText));
        renderLyrics();
      },
      onError: function() {
        document.getElementById('songTitle').textContent = songName;
        document.getElementById('songArtistAlbum').textContent = '';
        document.getElementById('coverImage').style.display = 'none';
        document.getElementById('coverPlaceholder').style.display = 'block';
        
        // 更新媒体会话（添加）
        updateMediaSessionMetadata(songName, '未知歌手', '', null);
        window.originalMediaInfo = {
          title: songName,
          artist: '未知歌手'
        };
        
        currentLyrics = [];
        renderLyrics();
      }
    });
  } else {
    document.getElementById('songTitle').textContent = songName;
    document.getElementById('songArtistAlbum').textContent = '';
    
    // 更新媒体会话（添加）
    updateMediaSessionMetadata(songName, '未知歌手', '', null);
    window.originalMediaInfo = {
      title: songName,
      artist: '未知歌手'
    };
    
    currentLyrics = [];
    renderLyrics();
  }
}

function scrollLyricToCenter(idx) {
  if (isUserScrollingLyrics) return;
  const row = document.querySelector(`.lyric-line-container[data-line-idx="${idx}"]`);
  if (!row) return;
  const box = document.getElementById('lyricsContainer');
  const rowTop = row.offsetTop;
  const boxHeight = box.clientHeight;
  const rowHeight = row.offsetHeight;
  const scrollTop = rowTop - (boxHeight / 2) + (rowHeight / 2);
  
  box.scrollTo({
    top: Math.max(0, scrollTop),
    behavior: 'smooth'
  });
}

function renderLyrics() {
  const box = document.getElementById('lyricsContainer');
  // 保留延迟控制元素
  const delayControl = document.getElementById('lyricDelayControl');
  box.innerHTML = '';
  box.appendChild(delayControl);
  lyricElements = [];

  if (!currentLyrics.length) {
    const noLyrics = document.createElement('div');
    noLyrics.style.cssText = 'text-align:center;color:#999;padding-top:40vh;font-size:18px;';
    noLyrics.textContent = '暂无歌词';
    box.appendChild(noLyrics);
    return;
  }

  currentLyrics.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className = 'lyric-line-container';
    row.setAttribute('data-line-idx', idx);
    row.onclick = () => jumpToLyric(idx);

    // 原文容器
    const textContainer = document.createElement('div');
    textContainer.className = 'lyric-text-container';
    
    if (line.type === 'word-by-word' && line.words && line.words.length > 0) {
      // 逐字/逐词显示
      line.words.forEach((w, wordIdx) => {
        const wordWrapper = document.createElement('span');
        wordWrapper.className = 'lyric-word-wrapper';
        
        // 背景层（灰色）
        const bgSpan = document.createElement('span');
        bgSpan.className = 'lyric-word-bg';
        bgSpan.textContent = w.text;
        
        // 前景层（高亮色）
        const fgSpan = document.createElement('span');
        fgSpan.className = 'lyric-word-fg';
        fgSpan.textContent = w.text;
        fgSpan.dataset.startTime = w.startTime;
        fgSpan.dataset.endTime = w.endTime;
        fgSpan.dataset.text = w.text;
        
        wordWrapper.appendChild(bgSpan);
        wordWrapper.appendChild(fgSpan);
        textContainer.appendChild(wordWrapper);
        
        lyricElements.push(fgSpan);
      });
    } else {
      // 普通行
      const div = document.createElement('div');
      div.className = 'lyric-line';
      div.dataset.index = idx;
      div.textContent = line.text;
      textContainer.appendChild(div);
      lyricElements.push(div);
    }
    
    row.appendChild(textContainer);
    box.appendChild(row);

    // 翻译行（如果有）
    if (line.translate) {
      const tr = document.createElement('div');
      tr.className = 'lyric-translate';
      tr.dataset.parentIdx = idx;
      tr.textContent = line.translate;
      box.appendChild(tr);
    }
  });
}

function jumpToLyric(index) {
  if (index >= currentLyrics.length) return;
  const t = currentLyrics[index].startTime;
  if (isFinite(t)) {
    audio.currentTime = t;
    audio.play(); isPlaying = true; updateBtn();
  }
}

let userScrollTimeout = null;
document.getElementById('lyricsContainer').addEventListener('scroll', () => {
  isUserScrollingLyrics = true;
  clearTimeout(userScrollTimeout);
  userScrollTimeout = setTimeout(() => isUserScrollingLyrics = false, 3000);
});

function updateLyricHighlight() {
  if (!currentLyrics.length) return;
  const ct = audio.currentTime - lyricDelay; // 应用延迟
  let activeIdx = -1;
  let lastActiveLine = -1;

  currentLyrics.forEach((line, idx) => {
    const rowEl = document.querySelector(`.lyric-line-container[data-line-idx="${idx}"]`);
    if (!rowEl) return;

    const isActiveLine = ct >= line.startTime && ct < (line.endTime || line.startTime + 5);
    
    if (isActiveLine) {
      activeIdx = idx;
      lastActiveLine = idx;
    }

    // 逐字高亮
    if (line.type === 'word-by-word' && line.words) {
      line.words.forEach(w => {
        const fgSpan = rowEl.querySelector(`[data-start-time="${w.startTime}"]`);
        if (!fgSpan) return;
        
        if (ct < w.startTime) {
          fgSpan.style.width = '0%';
        } else if (ct >= w.endTime) {
          fgSpan.style.width = '100%';
        } else {
          const progress = (ct - w.startTime) / (w.endTime - w.startTime);
          fgSpan.style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
        }
      });
      
      // 当前行放大效果
      if (isActiveLine) {
        rowEl.style.transform = 'scale(1.03)';
        rowEl.style.opacity = '1';
      } else {
        rowEl.style.transform = 'scale(1)';
        rowEl.style.opacity = ct < line.startTime ? '0.5' : '0.7';
      }
      
    } else {
      // 普通行高亮
      const divEl = rowEl.querySelector('.lyric-line');
      if (divEl) {
        if (isActiveLine) {
          divEl.classList.add('active');
        } else {
          divEl.classList.remove('active');
        }
      }
    }

    // 翻译行高亮
    const transEl = rowEl.nextElementSibling;
    if (transEl && transEl.classList.contains('lyric-translate')) {
      if (isActiveLine) {
        transEl.classList.add('active');
      } else {
        transEl.classList.remove('active');
      }
    }
  });
  
  // 换行时才滚动
  if (activeIdx !== -1 && activeIdx !== window.lastActiveLyricIdx) {
    scrollLyricToCenter(activeIdx);
    window.lastActiveLyricIdx = activeIdx;
        // 同步歌词到系统媒体通知
    const currentLine = currentLyrics[activeIdx];
    if (currentLine) {
      const lyricText = currentLine.translate ? 
        `${currentLine.text} (${currentLine.translate})` : 
        currentLine.text;
      updateMediaSessionLyrics(lyricText);
    }
  }
}

function toggleCoverLyric() {
  const lyrics = document.getElementById('lyricsContainer');
  const btn = document.getElementById('coverLyricToggle');
  
  if (lyrics.style.display === 'none' || !lyrics.style.display || lyrics.style.display === '') {
    lyrics.style.display = 'block';
    btn.textContent = '显示封面';
    setTimeout(() => updateLyricHighlight(), 100);
  } else {
    lyrics.style.display = 'none';
    btn.textContent = '显示歌词';
  }
}

