// ========== 歌词解析 ==========
function parseTimeToSeconds(timeStr) {
  const match = timeStr.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\]/);
  if (!match) return null;
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  const milliseconds = parseInt(match[3].padEnd(3, '0'));
  return minutes * 60 + seconds + milliseconds / 1000;
}

// 最后一行没有"下一行"可依,用一个兜底时长
const LAST_LINE_FALLBACK = 3;

// 把一行 LRC 按"每个时间戳后面跟一段文字"切成片段。
// 增强型(逐字/逐词)歌词正是这个结构;翻译行和普通行则只有一段文字。
function splitLrcSlots(rawLine, matches) {
  const slots = [];
  for (let j = 0; j < matches.length; j++) {
    const startIdx = matches[j].index + matches[j][0].length;
    const endIdx = j < matches.length - 1 ? matches[j + 1].index : rawLine.length;
    slots.push(rawLine.substring(startIdx, endIdx).trim());
  }
  return slots;
}

// 片段清洗:去掉尾部标点、去掉中文之间多余的空格(沿用原实现)
function cleanLyricText(text) {
  return text
    .replace(/[,\?\.!\s]+$/, '')
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
}

// 把逐词片段拼回整行文本。
// 原实现直接 textContent += word,英文歌词会拼成 "Helloworld";
// 这里只在"前后都是 ASCII 可见字符"时补空格,中文之间与中英交界都不补(与原有行为一致)。
function joinWordTexts(words) {
  const isAscii = c => c && c.charCodeAt(0) < 128 && !/\s/.test(c);
  let out = '';
  for (const w of words) {
    if (out && isAscii(out[out.length - 1]) && isAscii(w[0])) out += ' ';
    out += w;
  }
  return out;
}

function parseLyrics(lyricText) {
  if (!lyricText || typeof lyricText !== 'string') return [];
  
  const lines = lyricText.split('\n');
  const entries = [];      // 解析出的行(含暂时定不了身份的翻译候选)
  const candidates = [];   // 时间范围型翻译候选,循环结束后统一关联
  
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    
    // 提取所有时间戳
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
    const matches = [...rawLine.matchAll(timeRegex)];
    
    if (matches.length === 0) continue;
    
    const firstTag = matches[0][0];
    const lastTag = matches[matches.length - 1][0];
    const contentWithoutTags = rawLine.replace(/\[.*?\]/g, '').trim();
    const isChineseOnly = /^[\u4e00-\u9fa5\s，。？！、：""''（）]+$/.test(contentWithoutTags);
    const firstTime = parseTimeToSeconds(firstTag);
    const lastTime = parseTimeToSeconds(lastTag);

    // 非空片段数 ≥ 2 才是逐词/逐字行 —— 这是把"逐词中文行"和"翻译行"分开的关键判据:
    //   [00:12.00]好[00:12.00]吗  → 2 段文字,是逐字行
    //   [00:38.62][00:38.62]译文  → 1 段文字,才是翻译行
    // 只按"首尾时间戳相同"判断的话,前者会被整行当成翻译吞掉(不显示也不高亮)。
    const slots = splitLrcSlots(rawLine, matches);
    const textSlots = slots.filter(s => s);

    // ---- 翻译行候选:统一挂起,循环结束后再关联(关联上就从歌词里移除) ----
    // 形态分三类,判据只依赖这一行自己的结构:
    //   dup    同一行写了两个相同时间戳、正文只有一块 —— 翻译行的典型写法
    //   single 单个时间戳的纯中文行 —— A2 扩展格式
    //   range  两个不同时间戳、正文只有一块 —— 格式 A(翻译行用一段区间盖住原文行)
    // 逐词行(textSlots >= 2)绝不能落进这里,否则整行会被当翻译吞掉。
    let candKind = null;
    if (contentWithoutTags) {
      if (matches.length > 1 && firstTag === lastTag && textSlots.length <= 1) candKind = 'dup';
      else if (matches.length === 1 && isChineseOnly) candKind = 'single';
      else if (matches.length === 2 && firstTag !== lastTag && textSlots.length <= 1 && isChineseOnly) candKind = 'range';
    }
    
    // ---- 正文行 ----
    const lineObj = {
      type: 'normal',
      startTime: firstTime,
      endTime: null,
      text: '',
      translate: null,
      words: [],
      rangeStart: firstTime,   // 关联翻译用的时间范围(不会被后面改写的 endTime 影响)
      rangeEnd: lastTime,
      seq: entries.length      // 文件里的先后次序,关联 dup/single 时要用
    };
    
    if (textSlots.length >= 2) {
      // 逐词/逐字行
      for (let j = 0; j < matches.length; j++) {
        const word = cleanLyricText(slots[j]);
        if (!word) continue;
        lineObj.words.push({
          text: word,
          startTime: parseTimeToSeconds(matches[j][0]),
          endTime: j < matches.length - 1
            ? parseTimeToSeconds(matches[j + 1][0])
            : parseTimeToSeconds(matches[j][0])
        });
      }
      lineObj.text = joinWordTexts(lineObj.words.map(w => w.text));
      lineObj.type = lineObj.words.length > 1 ? 'word-by-word' : 'normal';
    } else {
      // 普通行(含 [t1]原文[t2] 这种只带一段文字、时间戳成对出现的行)
      lineObj.text = cleanLyricText(contentWithoutTags);
    }
    
    entries.push(lineObj);
    if (candKind) {
      lineObj.kind = candKind;
      // 翻译文案原样保留:中文之间的空格常是作者断句用的,
      // 原实现也是直接 contentWithoutTags 赋给 translate,不做清理
      lineObj.text = contentWithoutTags;
      candidates.push(lineObj);
    }
  }

  // ---- 关联翻译行:三类形态各自匹配;关联不上的退回普通行显示,不丢内容 ----
  const COVER_EPS = 0.05;   // 容忍几毫秒舍入差,同时排除"只是相邻/部分重叠"的普通文件
  const NEAR_LIMIT = 5;     // dup 兜底配对允许的最大时间距离(秒)

  const distTo = (line, t) => t < line.rangeStart ? line.rangeStart - t
                           : (t > line.rangeEnd ? t - line.rangeEnd : 0);

  candidates.forEach(cand => {
    if (cand.claimed) return;   // 它自己已经是别人的原文了,要保留显示
    const pool = entries.filter(l => l !== cand && !l.translate && !l.claimed);
    let target = null;

    if (cand.kind === 'range') {
      // 格式 A:翻译行用一段区间盖住原文行。判据 = 起点不晚于原文、结束晚于原文。
      // 起点要允许"相等":真实文件里翻译行和原文共用同一个起始时间戳是最常见写法
      // (如 [00:46.761]Good...[00:49.882] 配 [00:46.761]无论早晚...[00:50.540]),
      // 要求起点严格更早会把这种情况全部漏掉。
      // 结束必须严格更晚 —— 这样"三行首尾相接"的普通文件不会互相误判成翻译。
      let best = null;
      for (const line of pool) {
        if (cand.rangeStart <= line.rangeStart + COVER_EPS &&
            cand.rangeEnd >= line.rangeEnd + COVER_EPS) {
          const span = line.rangeEnd - line.rangeStart;
          if (!best || span > best.span) best = { line, span };
        }
      }
      if (best) target = best.line;
    } else {
      // dup / single:先找起始时间相同的那一行
      const exact = pool.filter(l => Math.abs(l.startTime - cand.rangeStart) <= 0.01);
      // single 只往前面找:两条结构一样的单时间戳中文行,谁在前谁是原文(A2 约定)。
      // 允许往后找会出现"把原文当翻译删掉、反倒留下译文"的反向错误。
      const scope = cand.kind === 'single' ? exact.filter(l => l.seq < cand.seq) : exact;
      if (scope.length) {
        target = scope[scope.length - 1];
      } else if (cand.kind === 'dup') {
        // 重复时间戳这种形态本身就说明它是翻译行,但它的时间戳常常不等于原文起点
        // (实测样本里取的是原文的结束时刻),所以退一步:挂到时间上最近的那一行。
        let near = null, nearD = Infinity;
        for (const line of pool) {
          const d = distTo(line, cand.rangeStart);
          if (d < nearD) { nearD = d; near = line; }
        }
        if (near && nearD <= NEAR_LIMIT) target = near;
      }
    }

    if (target) {
      target.translate = cand.text;
      target.claimed = true;
      cand.remove = true;
    }
  });

  const lyrics = entries.filter(e => !e.remove);
  lyrics.sort((a, b) => a.startTime - b.startTime);

  // ---- 统一补齐 endTime ----
  // 高亮不再写死 3 秒,而是"持续到下一行开始";最后一行才用兜底时长
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const nextStart = i + 1 < lyrics.length ? lyrics[i + 1].startTime : null;
    line.endTime = (nextStart !== null && nextStart > line.startTime)
      ? nextStart
      : line.startTime + LAST_LINE_FALLBACK;

    // 逐字行的最后一个字后面没有时间戳了,补到下一行开始,
    // 否则它会从"瞬间跳满"或(前后时间戳相同时)干脆不亮。
    // 注意兜底值要拿"这个字自己的起点"往后推:整行只有一个字、
    // 而行的起点又早于它时,用行起点+3 会算出比它起点还早的结束时间。
    if (line.words.length) {
      const last = line.words[line.words.length - 1];
      if (!(last.endTime > last.startTime)) {
        last.endTime = (nextStart !== null && nextStart > last.startTime)
          ? nextStart
          : last.startTime + LAST_LINE_FALLBACK;
      }
    }

    // 清掉只在解析期用到的内部标记
    delete line.remove; delete line.claimed; delete line.kind; delete line.seq;
  }

  return lyrics;
}

// ========== 封面设置（Blob URL,不用 btoa） ==========
// 原实现用 btoa(String.fromCharCode(...)) 拼 base64:
// 一张几百 KB 的封面 = 几十万次字符串拼接,切歌时肉眼可见掉帧;
// Blob URL 是零拷贝的引用,几乎没有内存和 CPU 开销
let coverObjectUrl = null;

function setCover(picture) {
  const img = document.getElementById('coverImage');
  const placeholder = document.getElementById('coverPlaceholder');

  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);   // 释放上一张,否则每切一首泄漏一份
    coverObjectUrl = null;
  }

  if (picture && picture.data && picture.data.length) {
    const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' });
    coverObjectUrl = URL.createObjectURL(blob);
    img.src = coverObjectUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    return coverObjectUrl;
  }

  img.removeAttribute('src');
  img.style.display = 'none';
  placeholder.style.display = 'block';
  return null;
}

function loadSongMetadata(songName, audioUrl) {
  // 读不到标签时的统一回落:标题用文件名,封面收掉,歌词清空
  const showPlainMetadata = function() {
    document.getElementById('songTitle').textContent = songName;
    document.getElementById('songArtistAlbum').textContent = '';
    setCover(null);
    updateMediaSessionMetadata(songName, '未知歌手', '', null);
    window.originalMediaInfo = { title: songName, artist: '未知歌手' };
    currentLyrics = [];
    renderLyrics();
  };

  if (typeof jsmediatags === 'undefined') {
    showPlainMetadata();
    return;
  }

  // jsmediatags 的 XHRFileReader 只认绝对 http(s) URL。
  // 传相对路径(例如 /music_play?file=x.mp3)时,它在"挑选读取器"这一步就会**同步抛**
  // "No suitable file reader found",把 playTrack 里后面的 cacheSong / play() / UI 更新
  // 整条链一起打断 —— 表现为"未缓存的歌点了不播、按钮状态也不刷新"。这里补成绝对 URL。
  let src = audioUrl;
  if (typeof src === 'string' && !/^(blob:|data:|https?:)/i.test(src)) {
    try { src = new URL(src, location.href).href; } catch (e) { /* 保持原值 */ }
  }

  try {
    jsmediatags.read(src, {
      onSuccess: function(tag) {
        const tags = tag.tags;
        document.getElementById('songTitle').textContent = tags.title || songName;
        document.getElementById('songArtistAlbum').textContent = 
          `${tags.artist || '未知歌手'}${tags.album ? ' - ' + tags.album : ''}`;
        
        const artist = tags.artist || '未知歌手';
        const album = tags.album || '';
        const coverUrl = setCover(tags.picture);
        
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
      onError: showPlainMetadata
    });
  } catch (e) {
    // 读取器/解析的任何异常都不该影响播放,退化成"只显示文件名"即可
    console.warn('读取音频标签失败,回落到文件名:', e && e.message);
    showPlainMetadata();
  }
}

// ========== 歌词渲染（引用一次建成,之后只按索引访问） ==========
function scrollLyricToCenter(idx) {
  if (isUserScrollingLyrics) return;
  const row = lyricRows[idx];
  if (!row) return;
  const box = document.getElementById('lyricsContainer');
  const rowTop = row.el.offsetTop;
  const boxHeight = box.clientHeight;
  const rowHeight = row.el.offsetHeight;
  const scrollTop = rowTop - (boxHeight / 2) + (rowHeight / 2);
  
  box.scrollTo({
    top: Math.max(0, scrollTop),
    behavior: 'smooth'
  });
}

function renderLyrics() {
  const box = document.getElementById('lyricsContainer');
  const delayControl = document.getElementById('lyricDelayControl');
  box.replaceChildren(delayControl);
  lyricRows = [];
  activeLineIdx = -1;
  activeWordIdx = -1;

  if (!currentLyrics.length) {
    const noLyrics = document.createElement('div');
    noLyrics.className = 'lyrics-empty';
    noLyrics.textContent = '暂无歌词';
    box.appendChild(noLyrics);
    return;
  }

  const frag = document.createDocumentFragment();

  currentLyrics.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className = 'lyric-line-container';
    // 点击跳转:闭包直接捕获下标,不需要 data-* 属性给选择器当靶子
    row.addEventListener('click', () => jumpToLyric(idx));

    const textContainer = document.createElement('div');
    textContainer.className = 'lyric-text-container';

    let lineEl = null;
    const words = [];

    if (line.type === 'word-by-word' && line.words && line.words.length > 0) {
      // 逐字/逐词:同一个字叠两层,底层灰色、顶层高亮色,靠 --fill 变量裁出宽度
      line.words.forEach(w => {
        const wrapper = document.createElement('span');
        wrapper.className = 'lyric-word-wrapper';

        const bg = document.createElement('span');
        bg.className = 'lyric-word-bg';
        bg.textContent = w.text;

        const fg = document.createElement('span');
        fg.className = 'lyric-word-fg';
        fg.textContent = w.text;

        wrapper.append(bg, fg);
        textContainer.appendChild(wrapper);
        // 直接握住节点引用 —— 这就是"死缓存用起来":不再按属性字符串反查 DOM
        words.push({ wrapper, fg, startTime: w.startTime, endTime: w.endTime, lastFill: -1 });
      });
    } else {
      const div = document.createElement('div');
      div.className = 'lyric-line';
      div.textContent = line.text;
      textContainer.appendChild(div);
      lineEl = div;
    }

    row.appendChild(textContainer);

    // 翻译行放进行容器内部:行的缩放/透明度状态天然带动翻译行,告别 nextElementSibling 兜底
    let translateEl = null;
    if (line.translate) {
      translateEl = document.createElement('div');
      translateEl.className = 'lyric-translate';
      translateEl.textContent = line.translate;
      row.appendChild(translateEl);
    }

    frag.appendChild(row);
    lyricRows.push({ el: row, lineEl, translateEl, words });
  });

  box.appendChild(frag);
  updateLyricHighlight();   // 立刻对齐一次(歌曲可能是暂停状态加载进来的)
}

function jumpToLyric(index) {
  if (index >= currentLyrics.length) return;
  const t = currentLyrics[index].startTime;
  if (isFinite(t)) {
    audio.currentTime = t;
    audio.play().catch(err=>{ console.warn('play() 被中断:', err.name); }); isPlaying = true; updateBtn();
  }
}

let userScrollTimeout = null;
document.getElementById('lyricsContainer').addEventListener('scroll', () => {
  isUserScrollingLyrics = true;
  clearTimeout(userScrollTimeout);
  userScrollTimeout = setTimeout(() => isUserScrollingLyrics = false, 3000);
});

// ========== 歌词高亮（rAF 驱动 + 二分查找 + 增量更新） ==========
// 滑块在某一行内的填充进度:0~1
function wordFill(word, ct) {
  const span = word.endTime - word.startTime;
  // 前后时间戳相同(或倒挂):没有可插值的区间,到点直接整字点亮
  if (!(span > 0)) return ct >= word.startTime ? 1 : 0;
  const p = (ct - word.startTime) / span;
  return p <= 0 ? 0 : (p >= 1 ? 1 : p);
}

// 单调递增的时间轴上找"最后一个已开始的歌词行",标准二分,O(log n)
function findActiveLineIndex(lines, time) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].startTime <= time) { ans = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return ans;
}

// 行内某字:字通常只有 5~15 个,线性扫比二分更划算
function findWordIndex(row, ct) {
  let wi = -1;
  for (let i = 0; i < row.words.length; i++) {
    if (ct >= row.words[i].startTime) wi = i; else break;
  }
  return wi;
}

// 写 CSS 变量驱动填充;值没变就不碰样式,避免无意义的样式重算
function setWordFill(row, idx, fill) {
  const w = row.words[idx];
  if (!w) return;
  const v = fill <= 0 ? 0 : (fill >= 1 ? 1 : fill);
  if (w.lastFill === v) return;
  w.lastFill = v;
  w.fg.style.setProperty('--fill', v);
}

function setLineFill(row, ct) {
  for (let i = 0; i < row.words.length; i++) setWordFill(row, i, wordFill(row.words[i], ct));
}

// 回退/跳转后,把后面所有行的残留状态清干净
function resetRowsFrom(fromIdx) {
  for (let i = Math.max(0, fromIdx); i < lyricRows.length; i++) {
    const row = lyricRows[i];
    row.el.classList.remove('active-line', 'sung-line');
    if (row.lineEl) row.lineEl.classList.remove('active');
    if (row.translateEl) row.translateEl.classList.remove('active');
    for (let j = 0; j < row.words.length; j++) setWordFill(row, j, 0);
  }
}

function clearRowState(row) {
  row.el.classList.remove('active-line');
  row.el.classList.add('sung-line');
  if (row.lineEl) row.lineEl.classList.remove('active');
  if (row.translateEl) row.translateEl.classList.remove('active');
  for (let i = 0; i < row.words.length; i++) setWordFill(row, i, 1);   // 离开的行整行定格为已唱完
}

function syncMediaSessionLyric(idx) {
  const line = currentLyrics[idx];
  if (!line) { updateMediaSessionLyrics(''); return; }
  updateMediaSessionLyrics(line.translate ? `${line.text} (${line.translate})` : line.text);
}

function updateLyricHighlight() {
  if (!lyricRows.length || !currentLyrics.length) return;

  const ct = audio.currentTime - lyricDelay; // 应用延迟
  const lineIdx = findActiveLineIndex(currentLyrics, ct);

  if (lineIdx !== activeLineIdx) {
    const goingBack = lineIdx < activeLineIdx;

    if (goingBack) {
      // 往前跳(拖动进度条 / 点击歌词):把后面所有行的残留高亮一次清干净,
      // 其中就包含"正在离开的那一行"—— 回退时它是未来,不能标成已唱完
      resetRowsFrom(lineIdx + 1);
    } else if (activeLineIdx >= 0) {
      const prev = lyricRows[activeLineIdx];
      if (prev) clearRowState(prev);
    }

    activeLineIdx = lineIdx;
    const row = lineIdx >= 0 ? lyricRows[lineIdx] : null;

    if (row) {
      row.el.classList.add('active-line');
      row.el.classList.remove('sung-line');
      if (row.lineEl) row.lineEl.classList.add('active');
      // 翻译行与原文行同一时刻进入高亮状态
      if (row.translateEl) row.translateEl.classList.add('active');
      setLineFill(row, ct);                 // 整行按当前时间重算,跳转落点也正确
      activeWordIdx = findWordIndex(row, ct);
      scrollLyricToCenter(lineIdx);         // 只在换行时滚动
      syncMediaSessionLyric(lineIdx);
    } else {
      activeWordIdx = -1;
      updateMediaSessionLyrics('');
    }
    return;
  }

  // 同一行内:只推进"当前这个字",其余字不再触碰
  if (lineIdx < 0) return;
  const row = lyricRows[lineIdx];
  if (!row.words.length) return;

  const wi = findWordIndex(row, ct);
  if (wi < activeWordIdx) {
    // 行内回退,整行重算
    setLineFill(row, ct);
  } else if (wi !== activeWordIdx && activeWordIdx >= 0) {
    setWordFill(row, activeWordIdx, 1);      // 上一个字定格为满格
  }
  activeWordIdx = wi;
  if (wi >= 0) setWordFill(row, wi, wordFill(row.words[wi], ct));
}

// ---- rAF 循环:只在播放时跑,顺带享受"页面隐藏自动暂停"的待遇 ----
function lyricLoop() {
  lyricRafId = requestAnimationFrame(lyricLoop);
  updateLyricHighlight();
}

function startLyricLoop() {
  if (lyricRafId === null) lyricRafId = requestAnimationFrame(lyricLoop);
}

function stopLyricLoop() {
  if (lyricRafId !== null) { cancelAnimationFrame(lyricRafId); lyricRafId = null; }
}

audio.addEventListener('play', startLyricLoop);
audio.addEventListener('playing', startLyricLoop);
audio.addEventListener('pause', () => { stopLyricLoop(); updateLyricHighlight(); });
audio.addEventListener('ended', () => { stopLyricLoop(); updateLyricHighlight(); });
// 拖动进度条、点击歌词跳转后立刻对齐,不用等下一帧循环
audio.addEventListener('seeked', () => updateLyricHighlight());

function toggleCoverLyric() {
  const lyrics = document.getElementById('lyricsContainer');
  const btn = document.getElementById('coverLyricToggle');
  
  if (lyrics.style.display === 'none' || !lyrics.style.display || lyrics.style.display === '') {
    lyrics.style.display = 'block';
    btn.textContent = '显示封面';
    btn.setAttribute('aria-label', '切换到封面界面');
    // 显示后立刻对齐(读 offsetTop 会强制一次布局,拿到的是真实位置)
    updateLyricHighlight();
  } else {
    lyrics.style.display = 'none';
    btn.textContent = '显示歌词';
    btn.setAttribute('aria-label', '切换到歌词界面');
  }
}
