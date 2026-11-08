// ========== 动画辅助（全站统一入口） ==========
// CSS 能表达的（入场、悬停、按压、旋转）一律放在 css/animations.css；
// 本文件只承担需要测量布局或等待结束才能改状态的部分：
// 折叠展开、对话框关闭、列表交错入场、导航指示器。
// 所有helper都尊重 prefers-reduced-motion：命中时直接落到终态，不播放动画。

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function prefersReducedMotion() {
  return reducedMotionQuery.matches;
}

// 重放一次 CSS 动画类（先移除、强制回流、再添加）
function restartAnimation(el, className) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  if (!prefersReducedMotion()) el.classList.add(className);
}

// 容器直接子元素的交错入场：写入 --i 序号后加类，动画结束后移除类，
// 避免容器后续新增子元素时被再次套上动画
function staggerChildren(container, options) {
  if (!container || prefersReducedMotion()) return;
  const opts = options || {};
  const cap = opts.cap != null ? opts.cap : 12;
  const step = opts.step != null ? opts.step : 32;
  const duration = opts.duration != null ? opts.duration : 380;
  const kids = container.children;
  for (let i = 0; i < kids.length; i++) {
    kids[i].style.setProperty('--i', String(Math.min(i, cap)));
  }
  container.classList.remove('stagger-children');
  void container.offsetWidth;
  container.classList.add('stagger-children');
  clearTimeout(container._staggerTimer);
  container._staggerTimer = setTimeout(() => {
    container.classList.remove('stagger-children');
  }, cap * step + duration + 80);
}

// 高度折叠/展开（歌单歌曲区等无内边距的容器）。
// 展开的终态是 display:block + 自然高度，收起的终态是 display:none；
// 动画期间用 overflow:hidden 裁切，结束后恢复内联样式。
const collapseAnims = new WeakMap();
function expandCollapse(el, expanded) {
  const prev = collapseAnims.get(el);
  if (prev) { prev.cancel(); collapseAnims.delete(el); }
  if (prefersReducedMotion()) {
    el.style.display = expanded ? 'block' : 'none';
    return Promise.resolve();
  }
  el.style.overflow = 'hidden';
  let anim;
  if (expanded) {
    el.style.display = 'block';
    const h = el.scrollHeight;
    anim = el.animate(
      [{ height: '0px', opacity: '0' }, { height: h + 'px', opacity: '1' }],
      { duration: 320, easing: 'cubic-bezier(.2,.8,.25,1)' }
    );
  } else {
    const h = el.offsetHeight;
    anim = el.animate(
      [{ height: h + 'px', opacity: '1' }, { height: '0px', opacity: '0' }],
      // forwards：终帧保持到 onfinish 里设置 display:none，避免回调前闪回全高
      { duration: 280, easing: 'cubic-bezier(.4,0,.7,.2)', fill: 'forwards' }
    );
  }
  collapseAnims.set(el, anim);
  return new Promise(resolve => {
    anim.onfinish = () => {
      if (collapseAnims.get(el) !== anim) { resolve(); return; }
      collapseAnims.delete(el);
      if (!expanded) el.style.display = 'none';
      anim.cancel();   // 释放 forwards 填充，之后展开动画从自然状态重新量起
      el.style.overflow = '';
      resolve();
    };
    // 被更新的动画取消时，样式由新动画接管，这里只放行等待方
    anim.oncancel = () => resolve();
  });
}

// 设置分组（原生 details/summary）的平滑展开收起。
// 拦截 summary 点击：展开时先置 open 再从零高压到自然高；
// 收起时压到零后再撤 open。内容区有内边距，连同 padding 一起过渡，
// 否则高度为 0 时仍会露出两条 padding。
function setupDetailsAccordion(details) {
  const summary = details.querySelector('summary');
  const content = details.querySelector('.settings-section-content');
  if (!summary || !content) return;
  let busy = false;
  summary.addEventListener('click', e => {
    e.preventDefault();
    if (busy) return;
    if (prefersReducedMotion()) { details.open = !details.open; return; }
    busy = true;
    const willOpen = !details.open;
    const style = getComputedStyle(content);
    const pt = style.paddingTop, pb = style.paddingBottom;
    details.classList.add('animating');
    let anim;
    if (willOpen) {
      details.open = true;
      const h = content.offsetHeight;
      content.style.overflow = 'hidden';
      anim = content.animate(
        [
          { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: '0' },
          { height: h + 'px', paddingTop: pt, paddingBottom: pb, opacity: '1' }
        ],
        { duration: 340, easing: 'cubic-bezier(.2,.8,.25,1)' }
      );
      staggerChildren(content);
    } else {
      // 收起动画期间 [open] 仍在，用 .closing 让箭头提前转回
      details.classList.add('closing');
      const h = content.offsetHeight;
      content.style.overflow = 'hidden';
      anim = content.animate(
        [
          { height: h + 'px', paddingTop: pt, paddingBottom: pb, opacity: '1' },
          { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: '0' }
        ],
        // forwards：终帧保持到撤掉 open 为止，避免回调前闪回全高
        { duration: 280, easing: 'cubic-bezier(.4,0,.7,.2)', fill: 'forwards' }
      );
    }
    let done = false;
    const finish = () => {
      if (done) return;   // cancel() 会再触发 oncancel，防止重入
      done = true;
      if (!willOpen) details.open = false;
      anim.cancel();   // 释放 forwards 填充
      content.style.overflow = '';
      details.classList.remove('animating', 'closing');
      busy = false;
    };
    anim.onfinish = finish;
    anim.oncancel = finish;
  });
}

// 对话框关闭：先播 .dialog-closing 的出场动画，再真正 close()。
// 返回的 Promise 在关闭完成后兑现；重复调用复用同一个 Promise。
function closeDialogAnimated(dlg) {
  if (!dlg || !dlg.open) return Promise.resolve();
  if (prefersReducedMotion()) { dlg.close(); return Promise.resolve(); }
  if (dlg._closing) return dlg._closing;
  dlg._closing = new Promise(resolve => {
    dlg.classList.add('dialog-closing');
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      dlg.removeEventListener('animationend', onEnd);
      dlg.classList.remove('dialog-closing');
      if (dlg.open) dlg.close();
      dlg._closing = null;
      resolve();
    };
    // 子元素动画的 animationend 会冒泡，只认对话框自身那次
    const onEnd = e => { if (e.target === dlg) finish(); };
    dlg.addEventListener('animationend', onEnd);
    setTimeout(finish, 240);   // 兜底：动画事件未触发时也要关闭
  });
  return dlg._closing;
}

// 先淡出再 display:none（管理页进度条等临时容器）
function fadeOutHide(el) {
  if (!el) return;
  if (prefersReducedMotion()) { el.style.display = 'none'; return; }
  el.classList.add('leaving');
  setTimeout(() => {
    el.style.display = 'none';
    el.classList.remove('leaving');
  }, 200);
}

// ========== 底部导航：滑动指示胶囊 ==========
// 当前项的高亮背景由一颗绝对定位的胶囊承担，随激活按钮滑动；
// 按钮自身只保留文字/图标的主色高亮（见 animations.css）
(function setupNavIndicator() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const indicator = document.createElement('span');
  indicator.className = 'nav-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  navbar.prepend(indicator);
  const update = () => {
    const active = navbar.querySelector('button.active');
    if (!active) return;
    indicator.style.left = active.offsetLeft + 'px';
    indicator.style.top = active.offsetTop + 'px';
    indicator.style.width = active.offsetWidth + 'px';
    indicator.style.height = active.offsetHeight + 'px';
  };
  window.updateNavIndicator = update;
  window.addEventListener('resize', update);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  update();
  // 首屏字体与布局稳定后再各校准一次，避免胶囊落在旧尺寸上
  setTimeout(update, 300);
  setTimeout(update, 1000);
})();

// 设置分组的折叠动画在脚本加载时统一接管（defer 执行时 DOM 已就绪）
document.querySelectorAll('details.settings-section').forEach(setupDetailsAccordion);

// ========== 主题选择器：滑动高亮框 ==========
// 激活项的高亮框由一颗绝对定位的指示框承担，切换主题时滑动过去；按钮自身只保留
// 文字/图标主色。选择器藏在默认折叠的分组里，用 ResizeObserver 在分组展开
// （尺寸从 0 变为真实）时补定位；首次定位关闭过渡，避免从角落滑入。
(function setupThemeIndicator() {
  const selector = document.querySelector('.theme-selector');
  if (!selector) return;
  const indicator = document.createElement('span');
  indicator.className = 'theme-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  selector.prepend(indicator);
  const update = () => {
    const active = selector.querySelector('.theme-option.active');
    if (!active || !active.offsetWidth) return;   // 折叠时不可测量
    const first = !indicator.dataset.ready;
    if (first) indicator.style.transition = 'none';
    indicator.style.left = active.offsetLeft + 'px';
    indicator.style.top = active.offsetTop + 'px';
    indicator.style.width = active.offsetWidth + 'px';
    indicator.style.height = active.offsetHeight + 'px';
    indicator.style.opacity = '1';
    if (first) { void indicator.offsetWidth; indicator.style.transition = ''; indicator.dataset.ready = '1'; }
  };
  window.updateThemeIndicator = update;
  window.addEventListener('resize', update);
  if (typeof ResizeObserver === 'function') new ResizeObserver(update).observe(selector);
  update();
})();