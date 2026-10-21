// ========== 歌词解析 ==========
function parseTimeToSeconds(timeStr) {
  const match = timeStr.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\]/);
  if (!match) return null;
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  const milliseconds = parseInt(match[3].padEnd(3, '0'));
  return minutes * 60 + seconds + milliseconds / 1000;
}

// 最后一行没有「下一行」可供参照，其结束时间使用下面的兜底时长（秒）
const LAST_LINE_FALLBACK = 3;

// 把一行 LRC 按「每个时间戳后跟一段文字」切分成片段。
// 增强型（逐字 / 逐词）歌词正是这一结构；译文行与普通行则只有一段文字。
function splitLrcSlots(rawLine, matches) {
  const slots = [];
  for (let j = 0; j < matches.length; j++) {
    const startIdx = matches[j].index + matches[j][0].length;
    const endIdx = j < matches.length - 1 ? matches[j + 1].index : rawLine.length;
    slots.push(rawLine.substring(startIdx, endIdx).trim());
  }
  return slots;
}

// 片段清洗：去除尾部标点，并去除中文字符之间多余的空格（沿用原有实现）
function cleanLyricText(text) {
  return text
    .replace(/[,\?\.!\s]+$/, '')
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
}

// 把逐词片段拼回整行文本。
// 旧实现直接执行 textContent += word，英文歌词会连成 `Helloworld`；
// 这里仅当「前后均为 ASCII 可见字符」时补一个空格，中文之间与中英交界处均不补（与原有行为一致）。
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
  const entries = [];      // 解析出的歌词行（含暂时无法判定身份的译文候选）
  const candidates = [];   // 时间范围型翻译候选，循环结束后统一关联
  
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

    // 非空片段数 ≥ 2 才算逐词 / 逐字行 —— 这是区分「逐词中文行」与「译文行」的关键判据：
    //   [00:12.00]好[00:12.00]吗  → 2 段文字，属于逐字行
    //   [00:38.62][00:38.62]译文  → 只有 1 段文字，才是译文行
    // 若仅按「首尾时间戳相同」判断，前者会被整行当作译文吞掉，既不显示也不高亮。
    const slots = splitLrcSlots(rawLine, matches);
    const textSlots = slots.filter(s => s);

    // ---- 译文行候选：先统一挂起，循环结束后再关联（关联成功即从歌词中移除） ----
    // 形态分三类，判据只依赖该行自身的结构：
    //   dup    同一行出现两个相同时间戳且正文只有一块 —— 译文行的典型写法
    //   single 单个时间戳的纯中文行 —— A2 扩展格式
    //   range  两个不同时间戳且正文只有一块 —— 格式 A（译文行以一段区间覆盖原文行）
    // 逐词行（textSlots >= 2）绝不能归入此类，否则整行会被当作译文吞掉。
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
      rawSlotCount: textSlots.length,  // 该行包含几段非空文字（1 段即可能是「单字行」）
      seq: entries.length      // 文件里的先后次序，关联 dup/single 时要用
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
      // 普通行（含 [t1]原文[t2] 这类只带一段文字、时间戳成对出现的行）
      lineObj.text = cleanLyricText(contentWithoutTags);
    }
    
    entries.push(lineObj);
    if (candKind) {
      lineObj.kind = candKind;
      // 译文文案原样保留：中文之间的空格常用于作者断句，
      // 原有实现同样是把 contentWithoutTags 直接赋给 translate，不做清洗
      lineObj.text = contentWithoutTags;
      candidates.push(lineObj);
    }
  }

  // ---- 关联译文行：三类形态分别匹配；关联不上的退回普通行显示，不丢失内容 ----
  const COVER_EPS = 0.05;   // 容差（秒）：兼顾几毫秒的舍入误差，同时排除仅相邻或部分重叠的普通文件
  const NEAR_LIMIT = 5;     // dup 形态兜底配对时允许的最大时间距离（秒）

  const distTo = (line, t) => t < line.rangeStart ? line.rangeStart - t
                           : (t > line.rangeEnd ? t - line.rangeEnd : 0);

  candidates.forEach(cand => {
    if (cand.claimed) return;   // 它自己已经是别人的原文了，要保留显示
    const pool = entries.filter(l => l !== cand && !l.translate && !l.claimed);
    let target = null;

    if (cand.kind === 'range') {
      // 格式 A：译文行以一段区间覆盖原文行。判据是起点不晚于原文、结束不早于原文。
      // 两端都必须容差，因为实际文件里译文的时间戳只是照抄原文的近似值：
      //   起点：与原文完全相同是最常见的写法
      //        ([00:46.761]Good...[00:49.882] 配 [00:46.761]无论早晚...[00:50.540])
      //   结束：LDDC 生成的逐字歌词中，译文结束普遍比原文结束早 1~9 ms，也可能完全相等
      //        ([00:16.423]...hot[00:17.992] 配 [00:16.423]烈焰燃起...[00:17.990])
      //        末行 [03:04.110]Link[03:04.796] 配 [03:04.110]相连[03:04.796]，起止全等
      // 容差仅 50 ms，因此首尾相接的普通文件不会被互相误判：
      // 相邻两行的结束时间相差整整一行，远超容差。
      let best = null;
      for (const line of pool) {
        if (cand.rangeStart <= line.rangeStart + COVER_EPS &&
            cand.rangeEnd >= line.rangeEnd - COVER_EPS) {
          const span = line.rangeEnd - line.rangeStart;
          if (!best || span > best.span) best = { line, span };
        }
      }
      if (best) target = best.line;
    } else {
      // dup / single：只在「文件中位于译文之前」的行里查找 —— 译文行总是紧跟其原文之后，
      // 这是 LDDC 等工具的统一写法。若不限制方向，会遇到这样的实际样本：
      //   [03:20.095]藏文原句[03:26.713]
      //   [03:27.074]你留下什么[03:27.074]     ← 译文，时间戳标在「下一句」的起点上
      //   [03:27.075]下一句藏文[03:34.473]
      // 207.074 与下一句起点 207.075 仅相差 1 ms，不限方向的精确匹配会把译文
      // 配给下一句，正好配反。因此译文必须向前查找。
      const before = pool.filter(l => l.seq < cand.seq);
      const exact = before.filter(l => Math.abs(l.startTime - cand.rangeStart) <= 0.01);
      const scope = exact;
      if (scope.length) {
        target = scope[scope.length - 1];
      } else if (cand.kind === 'dup') {
        // 重复时间戳这一形态本身已表明它是译文行，但其时间戳常常不等于原文起点
        // （可能取原文的结束时刻，也可能像上例那样标在下一句的起点），因此退一步处理：
        // 在之前的行中挂载到时间上最近的那一行。
        let near = null, nearD = Infinity;
        for (const line of before) {
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

  // ---- 逐字风格统一：单字行同样按逐字渲染 ----
  // 当整首以逐字（逐词）歌词为主时，只有「一个字 / 一个词」的行若仍走普通行样式，
  // 就会成为全曲唯一缺少字级进度填充的一行（仅整行变色，视觉上像漏掉了一个字）。
  // 实际样本：LDDC 输出的单音节行 [01:36.034]Link[01:36.962]，
  // 以及带译文的 [03:04.110]Link[03:04.796] + [03:04.110]相连[03:04.796]。
  const wordLines = lyrics.filter(l => l.words.length > 0).length;
  const isWordDominated = wordLines >= 2 && wordLines * 2 > lyrics.length;
  if (isWordDominated) {
    lyrics.forEach(line => {
      if (line.type !== 'normal') return;
      if (line.words.length === 1) {
        // 已具备时间戳、只是上面被判为普通行的单字行：改类型即可
        line.type = 'word-by-word';
        return;
      }
      // 只有一段文字的普通行：文本需「短到一个单位」才升级 ——
      // 否则整句普通行会被当作一个字，进度填充会一次拉满整行。
      if (line.words.length === 0 && line.rawSlotCount <= 1 && line.text && !/\s/.test(line.text)) {
        const end = line.rangeEnd > line.startTime ? line.rangeEnd : line.startTime;
        line.words = [{ text: line.text, startTime: line.startTime, endTime: end }];
        line.type = 'word-by-word';
      }
    });
  }

  // ---- 统一补齐 endTime ----
  // 高亮时长不再固定为 3 秒，而是持续到下一行开始；最后一行才使用兜底时长
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    const nextStart = i + 1 < lyrics.length ? lyrics[i + 1].startTime : null;
    line.endTime = (nextStart !== null && nextStart > line.startTime)
      ? nextStart
      : line.startTime + LAST_LINE_FALLBACK;

    // 逐字行最后一个字之后已无时间戳，需补齐到下一行开始，
    // 否则它要么瞬间跳满，要么（前后时间戳相同时）完全不亮。
    // 兜底值要从「这个字自身的起点」向后推算：当整行只有一个字、
    // 且行的起点早于该字起点时，用行起点加 3 秒会算出早于其起点的结束时间。
    if (line.words.length) {
      const last = line.words[line.words.length - 1];
      if (!(last.endTime > last.startTime)) {
        last.endTime = (nextStart !== null && nextStart > last.startTime)
          ? nextStart
          : last.startTime + LAST_LINE_FALLBACK;
      }
    }

    // 清掉只在解析期用到的内部标记
    delete line.remove; delete line.claimed; delete line.kind; delete line.seq; delete line.rawSlotCount;
  }

  return lyrics;
}

// ========== 封面设置（用 Blob URL，不用 btoa） ==========
// 旧实现用 btoa(String.fromCharCode(...)) 拼接 base64：
// 一张几百 KB 的封面意味着几十万次字符串拼接，切歌时能明显感到掉帧；
// Blob URL 只是零拷贝的引用，几乎没有内存与 CPU 开销
let coverObjectUrl = null;

function setCover(picture) {
  const img = document.getElementById('coverImage');
  const placeholder = document.getElementById('coverPlaceholder');

  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);   // 释放上一张，否则每切一首就泄漏一份
    coverObjectUrl = null;
  }

  if (picture && picture.data && picture.data.length) {
    const blob = new Blob([new Uint8Array(picture.data)], { type: picture.format || 'image/jpeg' });
    coverObjectUrl = URL.createObjectURL(blob);
    img.src = coverObjectUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    // 封面就绪后提取主色，驱动背景色斑（见 ambience.js）
    extractAmbientFrom(img);
    return coverObjectUrl;
  }

  img.removeAttribute('src');
  img.style.display = 'none';
  placeholder.style.display = 'block';
  resetAmbient();
  return null;
}

function loadSongMetadata(songName, audioUrl) {
  // 读取标签失败时的统一回落：标题显示文件名，隐藏封面，清空歌词
  const showPlainMetadata = function() {
    const title = domCache.songTitle || document.getElementById('songTitle');
    const artistAlbum = domCache.songArtistAlbum || document.getElementById('songArtistAlbum');
    title.textContent = songName;
    artistAlbum.textContent = '';
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

  // jsmediatags 的 XHRFileReader 只接受绝对 http(s) URL。
  // 若传入相对路径（例如 /music_play?file=x.mp3），它会在「挑选读取器」这一步**同步抛出**
  // “No suitable file reader found”，进而中断 playTrack 中后续的 cacheSong / play() / UI 更新，
  // 表现为「未缓存的歌曲点击后不播放，按钮状态也不刷新」。这里统一补全为绝对 URL。
  let src = audioUrl;
  if (typeof src === 'string' && !/^(blob:|data:|https?:)/i.test(src)) {
    try { src = new URL(src, location.href).href; } catch (e) { /* 保持原值 */ }
  }

  try {
    jsmediatags.read(src, {
      onSuccess: function(tag) {
        const tags = tag.tags;
        const title = domCache.songTitle || document.getElementById('songTitle');
        const artistAlbum = domCache.songArtistAlbum || document.getElementById('songArtistAlbum');
        title.textContent = tags.title || songName;
        artistAlbum.textContent =
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
    // 读取器与解析环节的异常都不应影响播放，退化为「只显示文件名」即可
    console.warn('读取音频标签失败，回落到文件名：', e && e.message);
    showPlainMetadata();
  }
}

// ========== 歌词渲染（引用一次性建成，之后只按索引访问） ==========
// 把某一行的中线对齐到容器中线。用视口坐标求差值，
// 与 offsetTop / padding / 容器定位方式（竖屏 fixed、横屏 static）无关。
function centerOffsetFor(row) {
  const box = document.getElementById('lyricsContainer');
  if (!box || !row) return null;
  const boxRect = box.getBoundingClientRect();
  const rowRect = row.el.getBoundingClientRect();
  return (rowRect.top + rowRect.height / 2) - (boxRect.top + boxRect.height / 2);
}

// 换行时滚动：仅在歌词行切换时调用，不用计时器，也不因用户滚动而暂停
function scrollLyricToCenter(idx) {
  const row = lyricRows[idx];
  if (!row) return;
  const box = document.getElementById('lyricsContainer');
  const delta = centerOffsetFor(row);
  if (delta === null) return;
  box.scrollTo({
    top: Math.max(0, box.scrollTop + delta),
    behavior: 'smooth'
  });
  scheduleLyricCenterCorrection();
}

// ========== 落点二次校正 ==========
// 视口外的歌词行按 contain-intrinsic-size 的估值布局（performance.css 统一设为
// 41px），与真实行高并不一致；行滚入视口后改按真实高度重排，滚动落点因此会差
// 几像素。滚动结束后再校正一次，首行与末行才真正落在容器中线上。
// 校正幅度超过阈值时放弃：此时的偏差多半来自用户手动滚动，不应把视图拉回。
let lyricCenterFixRaf = null;
const LYRIC_CENTER_FIX_LIMIT = 24;   // 像素：超出即视为用户操作

function scheduleLyricCenterCorrection() {
  const box = document.getElementById('lyricsContainer');
  if (!box) return;
  if (lyricCenterFixRaf !== null) cancelAnimationFrame(lyricCenterFixRaf);
  let lastTop = -1;
  let stillFrames = 0;
  const tick = () => {
    const current = Math.round(box.scrollTop);
    if (current === lastTop) stillFrames++;
    else { stillFrames = 0; lastTop = current; }
    if (stillFrames >= 2) { correctLyricCenter(); return; }
    lyricCenterFixRaf = requestAnimationFrame(tick);
  };
  lyricCenterFixRaf = requestAnimationFrame(tick);
}

function correctLyricCenter() {
  lyricCenterFixRaf = null;
  const box = document.getElementById('lyricsContainer');
  if (!box || !lyricRows.length) return;

  let idx = activeLineIdx;
  if (idx < 0) idx = findActiveLineIndex(currentLyrics, audio.currentTime - lyricDelay);
  const row = lyricRows[idx >= 0 ? idx : 0];
  if (!row) return;
  const delta = centerOffsetFor(row);
  if (delta === null || Math.abs(delta) > LYRIC_CENTER_FIX_LIMIT) return;

  const prevBehavior = box.style.scrollBehavior;
  box.style.scrollBehavior = 'auto';
  box.scrollTop = Math.max(0, box.scrollTop + delta);
  box.style.scrollBehavior = prevBehavior;
}

// 打开歌词界面时立刻把当前行摆到中央：容器刚从 display:none 变为可见时
// 高度还是 0，且此时不宜做平滑动画，因此关闭 scroll-behavior 直接定位。
function alignLyricsToActive() {
  const box = document.getElementById('lyricsContainer');
  if (!box || !lyricRows.length) return;

  let idx = activeLineIdx;
  if (idx < 0) idx = findActiveLineIndex(currentLyrics, audio.currentTime - lyricDelay);
  const row = lyricRows[idx >= 0 ? idx : 0];   // 尚未进入任何一行时落到第一行
  const delta = centerOffsetFor(row);
  if (delta === null) return;

  const prevBehavior = box.style.scrollBehavior;
  box.style.scrollBehavior = 'auto';
  box.scrollTop = Math.max(0, box.scrollTop + delta);
  box.style.scrollBehavior = prevBehavior;
  // 瞬时定位同样会因行重排产生几像素偏差，下一帧再校正一次
  scheduleLyricCenterCorrection();
}

// ========== 歌词首末行居中：上下预留半高留白 ==========
// 滚动定位只能把某一行滚到容器中线：首行上方若没有留白，它最多停在容器顶部；
// 末行则受最大滚动距离限制，同样到不了中线。上下各预留半个容器高的留白后，
// 首行与末行都能被完整滚到可视区正中，中间行不受影响。
// 留白高度取容器自身高度的一半，随视口与方向变化，不使用固定值。
// 前提是容器高度与内容无关（竖屏由 inset 决定、横屏由显式高度决定），
// 否则留白会撑高容器自身，形成「留白 → 变高 → 留白」的循环。
function syncLyricsCenterSpace() {
  const box = domCache.lyricsContainer || document.getElementById('lyricsContainer');
  if (!box) return;
  // 视图不可见（display:none）或没有歌词行时不需要留白
  if (box.clientHeight <= 0 || !lyricRows.length) {
    box.style.removeProperty('--lyrics-center-space');
    return;
  }
  box.style.setProperty('--lyrics-center-space', Math.round(box.clientHeight / 2) + 'px');
}

// ========== 当前行加粗的布局预留 ==========
// 当前行加粗会加宽文字，可能使同一条歌词多折一行；行高变化会带动后续所有行
// 位移，已居中的当前行随之偏移，表现为换行时「抖一下」。
// 渲染时按「整行加粗」批量测量一次各行高度并预留为 min-height：加粗与否不再
// 改变任何行盒尺寸，滚动定位因此保持稳定。
// 歌词视图不可见时（display:none）测得的高度为 0，留待可见时再测。
function reserveBoldLineMetrics() {
  const box = domCache.lyricsContainer || document.getElementById('lyricsContainer');
  if (!box || !lyricRows.length || box.clientHeight <= 0) return;
  // 测量态：整行临时加粗，并放行被 content-visibility 跳过的行——
  // 否则屏外行只报 contain-intrinsic-size 的估值（41px），预留高度会偏小，
  // 行滚入视口时仍会跳变。先写后读发生在同一任务，不会产生可见闪烁。
  box.classList.add('lyrics-measuring');
  const heights = lyricRows.map(r => r.el.offsetHeight);
  box.classList.remove('lyrics-measuring');
  lyricRows.forEach((r, i) => { r.el.style.minHeight = heights[i] + 'px'; });
}

function renderLyrics() {
  const box = domCache.lyricsContainer || document.getElementById('lyricsContainer');
  // 歌词视图内只保留歌词行；延迟调整入口已迁至设置页
  box.replaceChildren();
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
    // 点击跳转：由闭包直接捕获下标，无需再用 data-* 属性供选择器定位
    row.addEventListener('click', () => jumpToLyric(idx));

    const textContainer = document.createElement('div');
    textContainer.className = 'lyric-text-container';

    let lineEl = null;
    const words = [];

    if (line.type === 'word-by-word' && line.words && line.words.length > 0) {
      // 逐字 / 逐词：同一个字叠放两层，底层为灰色、顶层为高亮色，用 --fill 变量裁出填充宽度
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
        // 直接持有节点引用 —— 缓存一次即可长期复用，不再依据属性字符串反查 DOM
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

    // 译文行置于行容器内部：行的缩放与透明度状态会自然作用于译文行，无需再用 nextElementSibling 兜底
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
  // 行盒尺寸先按加粗态预留，首末行留白随后同步；两者都要求容器已可见，
  // 不可见时由 ResizeObserver 在视图切换后补做
  reserveBoldLineMetrics();
  syncLyricsCenterSpace();
  updateLyricHighlight();   // 立即对齐一次（歌曲可能是以暂停状态载入的）
}

function jumpToLyric(index) {
  if (index >= currentLyrics.length) return;
  const t = currentLyrics[index].startTime;
  if (isFinite(t)) {
    audio.currentTime = t;
    audio.play().catch(err=>{ console.warn('play() 被中断：', err.name); }); isPlaying = true; updateBtn();
  }
}

// ========== 歌词高亮（rAF 驱动 + 二分查找 + 增量更新） ==========
// 某一行内的填充进度，取值 0~1
function wordFill(word, ct) {
  const span = word.endTime - word.startTime;
  // 前后时间戳相同（或倒挂）时无可插值区间，到达该时刻即整字点亮
  if (!(span > 0)) return ct >= word.startTime ? 1 : 0;
  const p = (ct - word.startTime) / span;
  return p <= 0 ? 0 : (p >= 1 ? 1 : p);
}

// 在单调递增的时间轴上找出「最后一个已开始的歌词行」，标准二分，O(log n)
function findActiveLineIndex(lines, time) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].startTime <= time) { ans = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return ans;
}

// 行内当前字：一行通常只有 5~15 个字，线性扫描比二分更划算
function findWordIndex(row, ct) {
  let wi = -1;
  for (let i = 0; i < row.words.length; i++) {
    if (ct >= row.words[i].startTime) wi = i; else break;
  }
  return wi;
}

// 写入 CSS 变量驱动填充；取值未变化时不改动样式，避免多余的样式重算
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

// 回退或跳转之后，清除其后所有行残留的高亮状态
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
  for (let i = 0; i < row.words.length; i++) setWordFill(row, i, 1);   // 已离开的行定格为「已唱完」
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
      // 向后跳转（拖动进度条或点击靠前的歌词行）：一次性清除其后所有行残留的高亮，
      // 其中也包括「正在离开的那一行」——回退之后它属于未来，不能标记为已唱完
      resetRowsFrom(lineIdx + 1);
    } else {
      // 向前跳转：把被跳过的整段（从离开的那一行到新行的前一行）全部定格为「已唱」。
      // 旧写法仅对上一行调用 clearRowState，跨越多行时中间那一段会停留在
      // 「尚未播放」的状态，表现为拖动进度条或点击靠后的歌词后，跳过的整段歌词不亮。
      // 起始位置取 max(0, activeLineIdx)：activeLineIdx 为 -1（尚未进入任何一行）时
      // 从第一行开始标记，这样「跳到第 N 行」的终态与「顺序播到第 N 行」完全一致。
      for (let i = Math.max(0, activeLineIdx); i < lineIdx; i++) {
        const skipped = lyricRows[i];
        if (skipped) clearRowState(skipped);
      }
    }

    activeLineIdx = lineIdx;
    const row = lineIdx >= 0 ? lyricRows[lineIdx] : null;

    if (row) {
      row.el.classList.add('active-line');
      row.el.classList.remove('sung-line');
      if (row.lineEl) row.lineEl.classList.add('active');
      // 译文行与原文行同时进入高亮状态
      if (row.translateEl) row.translateEl.classList.add('active');
      setLineFill(row, ct);                 // 整行按当前时间重算，跳转落点也正确
      activeWordIdx = findWordIndex(row, ct);
      scrollLyricToCenter(lineIdx);         // 只在换行时滚动
      syncMediaSessionLyric(lineIdx);
    } else {
      activeWordIdx = -1;
      updateMediaSessionLyrics('');
    }
    return;
  }

  // 同一行内：只推进「当前这个字」，其余字不再处理
  if (lineIdx < 0) return;
  const row = lyricRows[lineIdx];
  if (!row.words.length) return;

  const wi = findWordIndex(row, ct);
  if (wi < activeWordIdx) {
    // 行内回退，整行重算
    setLineFill(row, ct);
  } else if (wi > activeWordIdx + 1) {
    // 行内前跳：拖动进度条、点击歌词跳转，或某一帧跨过了好几个字
    // （逐字歌词节奏快时约 100 ms 一个字，掉一两帧就会跨过两个字以上）。
    // 此处必须整行重算：旧写法仅把 activeWordIdx 对应的那个字定格为满格，
    // 中间被跨过的字会永远停在 0，表现为「拖到句中，前面的字却没有点亮」。
    setLineFill(row, ct);
  } else if (wi !== activeWordIdx && activeWordIdx >= 0) {
    setWordFill(row, activeWordIdx, 1);      // 正常推进：上一个字定格为满格
  }
  activeWordIdx = wi;
  if (wi >= 0) setWordFill(row, wi, wordFill(row.words[wi], ct));
}

// ---- rAF 循环：仅在播放时运行，页面隐藏时由浏览器自动暂停 ----
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
// 拖动进度条或点击歌词跳转后立即对齐，无需等待下一帧循环
audio.addEventListener('seeked', () => updateLyricHighlight());

// 歌词视图的显隐由 #page-player 上的 .lyrics-on 类控制：
// 竖屏下容器定位为整屏浮层，横屏下则留在播放面板内部、替换控制区（见 css/player.css）。
// 同时在 body 上标记 lyrics-open：竖屏歌词铺满整屏，据此让底部胶囊悬浮其上。
const landscapeQuery = window.matchMedia('(orientation: landscape)');

// 按钮文案与图标取决于「当前是否显示歌词」以及视口方向：
// 竖屏下歌词覆盖整屏，按钮语义是回到封面；
// 横屏下歌词只替换右侧控制区，按钮语义是回到播放控制，图标取播放器所用的那枚。
function renderLyricToggle(showingLyrics) {
  const btn = document.getElementById('coverLyricToggle');
  const label = document.getElementById('coverLyricToggleLabel');
  if (!btn || !label) return;
  const icon = btn.querySelector('svg');

  if (!showingLyrics) {
    label.textContent = '显示歌词';
    setIcon(icon, 'file-earmark-text');
    btn.setAttribute('aria-label', '切换到歌词界面');
    return;
  }

  if (landscapeQuery.matches) {
    label.textContent = '播放控制';
    setIcon(icon, 'play-circle');
    btn.setAttribute('aria-label', '切换到播放控制');
  } else {
    label.textContent = '显示封面';
    setIcon(icon, 'image');
    btn.setAttribute('aria-label', '切换到封面界面');
  }
}

function toggleCoverLyric() {
  const page = document.getElementById('page-player');
  const showingLyrics = page.classList.toggle('lyrics-on');
  document.body.classList.toggle('lyrics-open', showingLyrics);
  renderLyricToggle(showingLyrics);

  if (showingLyrics) {
    // 容器变为可见后才有真实高度：先对齐当前行的高亮，再把该行滚到视口中央，
    // 开启瞬间直接到位，不从首行滑下来
    updateLyricHighlight();
    alignLyricsToActive();
  }
}

// 歌词开启状态下旋转设备时，按钮文案与图标需要同步切换
landscapeQuery.addEventListener('change', () => {
  const page = document.getElementById('page-player');
  if (page && page.classList.contains('lyrics-on')) renderLyricToggle(true);
});

// 容器尺寸变化时同步留白与加粗预留，并重新对齐当前行。
// 容器刚从 display:none 变为可见时高度还是 0，首次对齐用的是旧内边距；
// ResizeObserver 回调落在布局后、绘制前，补做一次同步即可同帧纠正，无闪烁。
// 观测边框盒而非内容盒：留白正是通过内边距改变内容盒，按内容盒观测会多出一轮投递。
const lyricsBoxForResize = domCache.lyricsContainer || document.getElementById('lyricsContainer');
if (lyricsBoxForResize && typeof ResizeObserver === 'function') {
  new ResizeObserver(() => {
    syncLyricsCenterSpace();
    reserveBoldLineMetrics();
    if (document.getElementById('page-player').classList.contains('lyrics-on')) {
      alignLyricsToActive();
    }
  }).observe(lyricsBoxForResize, { box: 'border-box' });
}
