// ========== 全局变量 ==========
let currentTrack=0, isPlaying=false;
let tracks=[], currentQueue=[];
const audio=new Audio();
let db;
const dbName='MusicPlayerDB', storeName='musicCache';
const storeNames = ['musicCache', 'currentList', 'customLists', 'playlist', 'playStats', 'setting'];
let targetList = '';
let allSongsCache = [];
let trackedSongs = {};
let selectedSongs = new Set();
let isDownloading = false;
let currentLyrics = [], isUserScrollingLyrics = false;
// 歌词行 DOM 引用缓存:渲染时一次建成,之后只按索引读,不再每帧查 DOM
// 结构:[{ el, lineEl, translateEl, words:[{ wrapper, fg }] }]
let lyricRows = [];
let activeLineIdx = -1, activeWordIdx = -1, lyricRafId = null;
let lyricDelay = 0; // 歌词延迟（秒）
let cachedSongsSet = new Set(); // 已缓存歌曲集合

