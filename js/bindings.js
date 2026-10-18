// ========== DOM 事件接线（统一入口） ==========
// 页面上的交互事件只在本文件绑定一次。
// 改造前，HTML 内联的 onclick / oninput / onchange 与 JS 的 addEventListener 两套写法并存：
// 内联写法会把代码塞进全局作用域，无法解绑，不利于 CSP，参数还得手工转义。
// 现在统一收口：要确认某个按钮点击后会做什么，只看本文件即可。
// 加载顺序：须排在所有业务模块之后、init.js 之前。

// ---- 底部导航 ----
document.getElementById('navPlayer').addEventListener('click', () => showPage('player'));
document.getElementById('navLists').addEventListener('click', () => showPage('lists'));
document.getElementById('navStats').addEventListener('click', () => showPage('stats'));
document.getElementById('navSettings').addEventListener('click', () => showPage('settings'));

// ---- 播放控制 ----
document.getElementById('prevBtn').addEventListener('click', () => playPrev());
document.getElementById('playPauseBtn').addEventListener('click', () => togglePlayPause());
document.getElementById('nextBtn').addEventListener('click', () => playNext());
document.getElementById('shuffleBtn').addEventListener('click', () => shuffleQueue());
document.getElementById('volumeSlider').addEventListener('input', function() { setVolume(this.value); });
document.getElementById('playMode').addEventListener('change', async function() {
  await dbPut('setting', 'playMode', this.value);
});

// 进度条与音量滑块用原生 <input type="range"> + CSS accent-color：
// 已播放的高亮段由浏览器按 value 自动绘制，这里不再需要维护 --progress / --volume 之类的变量，
// 也就不会出现「拖动能变色、播放推进时不动」的不同步问题。

// ---- 歌词界面 ----
document.getElementById('coverLyricToggle').addEventListener('click', () => toggleCoverLyric());
document.getElementById('lyricDelayMinus').addEventListener('click', () => adjustLyricDelay(-0.05));
document.getElementById('lyricDelayPlus').addEventListener('click', () => adjustLyricDelay(0.05));

// ---- 歌单页 ----
document.getElementById('createListBtn').addEventListener('click', () => createList());
document.getElementById('confirmAddSongsBtn').addEventListener('click', () => confirmAddSongs());
document.getElementById('cancelAddSongsBtn').addEventListener('click', () => closeDialog());

// ---- 排序（歌曲列表页与管理页各有一份） ----
document.getElementById('listSortKey').addEventListener('change', function() {
  listSortKey = this.value;
  renderLists();
});
document.getElementById('listSortDir').addEventListener('change', function() {
  listSortDir = this.value;
  renderLists();
});
document.getElementById('manageSortKey').addEventListener('change', function() {
  manageSortKey = this.value;
  renderManageList();
});
document.getElementById('manageSortDir').addEventListener('change', function() {
  manageSortDir = this.value;
  renderManageList();
});

// ---- 管理页 ----
document.getElementById('refreshListBtn').addEventListener('click', () => refreshList());
document.getElementById('addFolderBtn').addEventListener('click', () => addLocalFolder());
document.getElementById('localFolderInput').addEventListener('change', e => handleLocalFolder(e));
document.getElementById('selectAllBtn').addEventListener('click', () => selectAllSongs());
document.getElementById('deselectAllBtn').addEventListener('click', () => deselectAllSongs());
document.getElementById('downloadSelectedBtn').addEventListener('click', () => downloadSelected());
document.getElementById('downloadAllBtn').addEventListener('click', () => downloadAll());
document.getElementById('deleteSelectedBtn').addEventListener('click', () => deleteSelected());
document.getElementById('clearCacheBtn').addEventListener('click', () => clearCache());

// ========== 键盘快捷键 ==========
// 空格：播放或暂停；← / →：快退或快进 5 秒
const SEEK_STEP = 5;

document.addEventListener('keydown', e => {
  // 带修饰键的组合留给浏览器（例如 Ctrl+← 切换标签页）
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // 焦点在输入框或下拉框时不拦截按键：空格与方向键在表单控件中另有含义
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

  // 有模态框打开时不响应，避免在对话框上按空格误触发播放
  if (document.querySelector('dialog[open]')) return;

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();          // 否则浏览器会往下滚一屏
    togglePlayPause();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();          // 否则会滚动歌词/列表
    seekBy(-SEEK_STEP);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    seekBy(SEEK_STEP);
  }
});
