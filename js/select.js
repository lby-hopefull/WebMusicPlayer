// ========== 自定义下拉菜单 ==========
// 原生 <select> 展开后的选项面板由操作系统绘制，样式表无法改写。
// 这里保留 <select> 作为取值的唯一来源，另建「按钮 + 列表框」承担显示与交互：
// 选中后写回 select.value 并派发 change 事件，业务代码与无障碍名称均不受影响。
// 本脚本未执行时退回原生控件（闭合状态由 base.css 自绘）。

function createCustomSelect(select) {
  if (select.dataset.customized === '1') return;
  select.dataset.customized = '1';

  const widget = document.createElement('div');
  widget.className = 'select-widget';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const ariaLabel = select.getAttribute('aria-label');
  if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);

  const label = document.createElement('span');
  label.className = 'select-trigger-label';

  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('class', 'icon select-trigger-icon');
  chevron.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#chevron-right');
  chevron.appendChild(use);

  trigger.append(label, chevron);

  const list = document.createElement('ul');
  list.className = 'select-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  widget.append(trigger, list);
  select.after(widget);
  // 原生控件退出布局与焦点序列，取值仍通过 select.value 读写
  select.classList.add('select-native-hidden');
  select.setAttribute('aria-hidden', 'true');

  let activeIndex = 0;

  function renderTrigger() {
    const opt = select.options[select.selectedIndex];
    label.textContent = opt ? opt.textContent.trim() : '';
  }

  function renderList() {
    list.replaceChildren();
    Array.from(select.options).forEach((opt, index) => {
      const item = document.createElement('li');
      item.className = 'select-option';
      item.setAttribute('role', 'option');
      if (index === select.selectedIndex) item.setAttribute('aria-selected', 'true');
      item.textContent = opt.textContent.trim();
      item.addEventListener('click', () => choose(index));
      list.appendChild(item);
    });
  }

  function setActive(index) {
    const items = Array.from(list.children);
    if (!items.length) return;
    activeIndex = (index + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('is-active', i === activeIndex));
  }

  function open() {
    renderList();
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    setActive(Math.max(select.selectedIndex, 0));
    document.addEventListener('pointerdown', onPointerDownOutside, true);
    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onPointerDownOutside, true);
    document.removeEventListener('keydown', onKeydown);
  }

  function onPointerDownOutside(event) {
    if (!widget.contains(event.target)) close();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') { close(); trigger.focus(); event.preventDefault(); return; }
    if (event.key === 'ArrowDown') { setActive(activeIndex + 1); event.preventDefault(); return; }
    if (event.key === 'ArrowUp') { setActive(activeIndex - 1); event.preventDefault(); return; }
    if (event.key === 'Enter' || event.key === ' ') { choose(activeIndex); event.preventDefault(); }
  }

  function choose(index) {
    const opt = select.options[index];
    if (!opt) return;
    if (select.value !== opt.value) {
      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    renderTrigger();
    close();
    trigger.focus();
  }

  trigger.addEventListener('click', () => {
    if (list.hidden) open(); else close();
  });

  // 业务代码直接改 select.value（如启动时恢复播放模式）后同步显示
  select.addEventListener('change', renderTrigger);

  widget.syncCustomSelect = renderTrigger;
  renderTrigger();
}

function syncAllCustomSelects() {
  document.querySelectorAll('.select-widget').forEach((widget) => {
    if (typeof widget.syncCustomSelect === 'function') widget.syncCustomSelect();
  });
}

document.querySelectorAll('select').forEach(createCustomSelect);
