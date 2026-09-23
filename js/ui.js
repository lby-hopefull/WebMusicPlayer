// ========== 页面切换函数 ==========
function showPage(pageName) {
  document.querySelectorAll('.page-container > section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById('page-' + pageName).classList.add('active');
  
  if(pageName === 'manage') {
    renderManageList();
  } else if(pageName === 'lists') {
    renderLists();
  } else if(pageName === 'stats') {
    renderStats();
  }
}

// ========== 歌词延迟控制 ==========
async function adjustLyricDelay(delta) {
    // 界面上的数值 += 步长
    lyricDelay += delta;
    lyricDelay = Math.round(lyricDelay * 100) / 100;
    
    // 计算需要存入数据库的数值（显示值 - 0.5）
    const actualDelayToSave = lyricDelay;
    
    document.getElementById('lyricDelayValue').textContent = lyricDelay.toFixed(2) + 's';
    
    // 保存时：存入 (显示值 - 0.5)
    await dbPut('setting', 'lyricDelay', actualDelayToSave);
    // 延迟变了当帧就该重算(rAF 只在播放时跑,暂停时手动刷一次)
    updateLyricHighlight();
}

async function loadLyricDelay() {
  const saved = await dbGet('setting', 'lyricDelay');
  if(saved && saved.data !== undefined) {
    lyricDelay = saved.data;
    document.getElementById('lyricDelayValue').textContent = lyricDelay.toFixed(2) + 's';
  }
}

// ========== 真随机数（Crypto API） ==========
// 优先用浏览器自带的密码学安全随机源;并做拒绝采样消除取模偏差,
// 保证每个下标被选中的概率完全相等(原来的 sin 取模既非真随机也有偏差)
function trueRandom(max) {
  if (!(max > 0)) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max; // 落在 [limit, 2^32) 的值会引入偏差,丢弃重抽
    let v;
    do {
      crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % max;
  }
  return Math.floor(Math.random() * max); // 极老环境降级
}

// ========== 歌曲名排序 ==========
// 自然序:numeric:true 让 "第2首" 排在 "第10首" 前面;zh-CN 让中文按拼音排
function compareSongNames(a, b) {
  return String(a).localeCompare(String(b), 'zh-CN', { numeric: true, sensitivity: 'base' });
}

// 就地排序:保持数组引用不变,这样 tracks / lists['全部歌曲'] 这些别名指向同一份数据
function sortSongsInPlace(list) {
  if (Array.isArray(list)) list.sort(compareSongNames);
  return list;
}

// ========== 通用对话框（替代 alert / confirm） ==========
// 原生 alert/confirm 会阻塞渲染线程;这里统一用 <dialog>,
// 文案一律走 textContent —— 歌名/歌单名不会被当成 HTML 执行
let appDialog = null;
let dialogResolve = null;

function ensureDialog() {
  if (appDialog) return appDialog;

  const el = document.createElement('dialog');
  el.id = 'appDialog';

  const message = document.createElement('p');
  message.className = 'dialog-message';

  const actions = document.createElement('div');
  actions.className = 'dialog-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'dialog-btn dialog-btn-cancel';
  cancelBtn.textContent = '取消';

  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'dialog-btn dialog-btn-ok';
  okBtn.textContent = '确定';

  okBtn.addEventListener('click', () => settleDialog(true));
  cancelBtn.addEventListener('click', () => settleDialog(false));
  // ESC 关闭也当作"取消",否则 Promise 会永远挂起
  el.addEventListener('cancel', e => { e.preventDefault(); settleDialog(false); });
  // 极端情况下被外部关闭时兜底
  el.addEventListener('close', () => {
    if (dialogResolve) { const r = dialogResolve; dialogResolve = null; r(false); }
  });

  actions.append(cancelBtn, okBtn);
  el.append(message, actions);
  document.body.appendChild(el);

  appDialog = { el, message, okBtn, cancelBtn };
  return appDialog;
}

function settleDialog(result) {
  if (!appDialog || !dialogResolve) return;
  const resolve = dialogResolve;
  dialogResolve = null;   // 先清空,close 事件就不会重复结算
  appDialog.el.close();
  resolve(result);
}

function openDialog(message, options) {
  const opts = options || {};
  const d = ensureDialog();
  d.message.textContent = String(message);
  d.okBtn.textContent = opts.okText || '确定';
  d.cancelBtn.textContent = opts.cancelText || '取消';
  d.cancelBtn.hidden = !opts.confirm;
  if (d.el.open) d.el.close();
  d.el.showModal();
  return new Promise(resolve => { dialogResolve = resolve; });
}

// 只有一个"确定"按钮的提示框
function uiAlert(message, options) {
  return openDialog(message, options).then(() => undefined);
}

// 带"取消/确定"的确认框,resolve(true) 表示确认
function uiConfirm(message, options) {
  return openDialog(message, Object.assign({ confirm: true }, options || {}));
}
