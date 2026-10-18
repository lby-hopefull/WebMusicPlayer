// ========== 全局变量 ==========
let currentTrack=0, isPlaying=false;
let tracks=[], currentQueue=[];
const audio=new Audio();
let db;
const dbName='MusicPlayerDB', storeName='musicCache';
const storeNames = ['musicCache', 'currentList', 'customLists', 'playlist', 'playStats', 'setting', 'songMeta'];
let targetList = '';
let allSongsCache = [];
let trackedSongs = {};
let selectedSongs = new Set();
let isDownloading = false;
let currentLyrics = [], isUserScrollingLyrics = false;
// 歌词行 DOM 引用缓存：渲染时一次性建好，之后只按索引读取，不再逐帧查询 DOM
// 结构：[{ el, lineEl, translateEl, words:[{ wrapper, fg }] }]
let lyricRows = [];
let activeLineIdx = -1, activeWordIdx = -1, lyricRafId = null;
let lyricDelay = 0; // 歌词延迟（秒）
let cachedSongsSet = new Set(); // 已缓存歌曲集合
let songMetaMap = {};           // 歌曲名 → {addedTime, size, duration}，见 songmeta.js

// ========== 图标 ==========
// 图标 sprite 内联在 music.html 的 <!-- ICONS:START --> 块里（Bootstrap Icons）。
// HTML 里统一写 <svg class="icon" aria-hidden="true"><use href="#play-fill"/></svg>；
// JS 动态生成的节点则走下面两个函数，保证引用写法只出现一处。
const SVG_NS = 'http://www.w3.org/2000/svg';

// 换掉某个 <svg> 内 <use> 指向的图标（例如播放 ⇄ 暂停）
function setIcon(svg, name) {
  const use = svg && svg.querySelector('use');
  if (use) use.setAttribute('href', `#${name}`);
}

// 新建一个可插入 DOM 的图标节点
function iconEl(name, extraClass) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', extraClass ? `icon ${extraClass}` : 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.appendChild(document.createElementNS(SVG_NS, 'use'));
  setIcon(svg, name);
  return svg;
}

