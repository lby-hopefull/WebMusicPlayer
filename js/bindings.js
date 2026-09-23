// ========== DOM 事件接线（统一入口） ==========
// 页面上所有交互只在这里绑定一次。
// 之前是"HTML 内联 onclick/oninput/onchange"和"JS addEventListener"两套写法混用:
// 内联写法会往全局作用域塞代码、无法解绑、不利于 CSP,参数还得手动转义字符串。
// 现在统一收口到本文件 —— 想知道某个按钮点了会发生什么,只看这一个文件。
// 加载顺序:必须在所有业务模块之后、init.js 之前。

// ---- 底部导航 ----
document.getElementById('navPlayer').addEventListener('click', () => showPage('player'));
document.getElementById('navLists').addEventListener('click', () => showPage('lists'));
document.getElementById('navStats').addEventListener('click', () => showPage('stats'));
document.getElementById('navManage').addEventListener('click', () => showPage('manage'));

// ---- 播放控制 ----
document.getElementById('prevBtn').addEventListener('click', () => playPrev());
document.getElementById('playPauseBtn').addEventListener('click', () => togglePlayPause());
document.getElementById('nextBtn').addEventListener('click', () => playNext());
document.getElementById('shuffleBtn').addEventListener('click', () => shuffleQueue());
document.getElementById('volumeSlider').addEventListener('input', function() { setVolume(this.value); });
document.getElementById('playMode').addEventListener('change', async function() {
  await dbPut('setting', 'playMode', this.value);
});

// ---- 歌词界面 ----
document.getElementById('coverLyricToggle').addEventListener('click', () => toggleCoverLyric());
document.getElementById('lyricDelayMinus').addEventListener('click', () => adjustLyricDelay(-0.05));
document.getElementById('lyricDelayPlus').addEventListener('click', () => adjustLyricDelay(0.05));

// ---- 歌单页 ----
document.getElementById('createListBtn').addEventListener('click', () => createList());
document.getElementById('confirmAddSongsBtn').addEventListener('click', () => confirmAddSongs());
document.getElementById('cancelAddSongsBtn').addEventListener('click', () => closeDialog());

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
// 空格 = 播放/暂停,← / → = 快退/快进 5 秒
const SEEK_STEP = 5;

document.addEventListener('keydown', e => {
  // 带修饰键的组合留给浏览器(如 Ctrl+← 切换标签页)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  // 正在输入框/下拉框里操作时不抢键:空格、方向键在表单控件里另有含义
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;

  // 有模态框打开时不响应,避免在对话框上按空格把歌给播了
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
