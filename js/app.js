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
let currentLyrics = [], lyricElements = [], isUserScrollingLyrics = false;
let lyricDelay = 0; 
let cachedSongsSet = new Set(); 

