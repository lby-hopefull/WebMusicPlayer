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
    // 显示值按步长累加，并消除浮点累积误差
    lyricDelay += delta;
    lyricDelay = Math.round(lyricDelay * 100) / 100;
    
    const actualDelayToSave = lyricDelay;
    
    document.getElementById('lyricDelayValue').textContent = lyricDelay.toFixed(2) + 's';
    
    await dbPut('setting', 'lyricDelay', actualDelayToSave);
    // 延迟变化后当帧即需重算；rAF 只在播放时运行，暂停状态下手动刷新一次
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
// 优先使用浏览器提供的密码学安全随机源，并通过拒绝采样消除取模偏差，
// 使每个下标被选中的概率严格相等（旧的 sin 取模写法既非真随机，也存在偏差）
function trueRandom(max) {
  if (!(max > 0)) return 0;
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max; // 落在 [limit, 2^32) 的值会引入偏差，丢弃重抽
    let v;
    do {
      crypto.getRandomValues(buf);
      v = buf[0];
    } while (v >= limit);
    return v % max;
  }
  return Math.floor(Math.random() * max); // 浏览器不支持 crypto 时的降级路径
}

// ========== 歌曲名排序 ==========
// 自然序：numeric:true 使「第2首」排在「第10首」之前；zh-CN 使中文按拼音排序
function compareSongNames(a, b) {
  return String(a).localeCompare(String(b), 'zh-CN', { numeric: true, sensitivity: 'base' });
}

// 就地排序：保持数组引用不变，这样 tracks / lists['全部歌曲'] 这些别名指向同一份数据
function sortSongsInPlace(list) {
  if (Array.isArray(list)) list.sort(compareSongNames);
  return list;
}

// ========== 歌曲排序：名称 / 时长 / 添加时间 / 文件大小 ==========
// 歌曲列表页与管理页各有一份排序状态，默认为「名称 升序」，即本次改造前的显示顺序
let listSortKey = 'name', listSortDir = 'asc';
let manageSortKey = 'name', manageSortDir = 'asc';

// 取排序用的数值(名称以外的三项都来自 songmeta.js 里的 songMetaMap)
function songMetaValue(name, key){
  const m = songMetaMap[name];
  if(!m) return null;
  const v = m[key];
  return (typeof v === 'number' && isFinite(v)) ? v : null;
}

// 缺少元信息的歌曲（既未缓存也未播放过）恒定排在末尾，升序降序均如此；
// 否则降序排列时未知项会排到最前，与直觉不符。
function compareSongsBy(a, b, key, dir){
  const desc = dir === 'desc';
  if(key === 'name'){
    const c = compareSongNames(a, b);
    return desc ? -c : c;
  }
  const va = songMetaValue(a, key), vb = songMetaValue(b, key);
  if(va === null || vb === null){
    if(va === null && vb === null) return compareSongNames(a, b);
    return va === null ? 1 : -1;
  }
  let c = va - vb;
  if(c === 0) c = compareSongNames(a, b);   // 同值时按名称，顺序稳定可预期
  return desc ? -c : c;
}

// 生成排好序的副本。不动原数组：歌单里的顺序是用户数据，排序只影响显示。
function sortSongsForView(list, key, dir){
  return [...(list || [])].sort((a, b) => compareSongsBy(a, b, key, dir));
}

// ========== 通用对话框（替代 alert / confirm） ==========
// 原生 alert/confirm 会阻塞渲染线程，这里统一改用 <dialog>；
// 文案一律通过 textContent 输出 —— 歌名与歌单名不会被当作 HTML 解析执行
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
  // 按 ESC 关闭等同于「取消」，否则 Promise 会一直挂起
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
  dialogResolve = null;   // 先清空，close 事件就不会重复结算
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

// 只有一个「确定」按钮的提示框
function uiAlert(message, options) {
  return openDialog(message, options).then(() => undefined);
}

// 带「取消 / 确定」的确认框，resolve(true) 表示确认
function uiConfirm(message, options) {
  return openDialog(message, Object.assign({ confirm: true }, options || {}));
}
