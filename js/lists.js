// ========== 歌单管理 ==========
// 各歌单的展开状态：页面切换与列表重渲染都会重建 DOM，状态记在这里，
// 渲染时据此恢复，避免切回页面后展开项莫名收起
const expandedLists = new Set();

// 展开状态同时落库：刷新页面后仍保持展开
function persistExpandedLists(){
  dbPut('setting', 'expandedLists', [...expandedLists]);
}

async function loadLists(){
  const result = await dbGetAll('customLists');
  const lists = {};
  result.forEach(item => {
    lists[item.id] = sortSongsInPlace(item.data || []);
  });
  return lists;
}

// 整表原子写入：清空与写回在同一个事务内完成，中途失败则整体回滚，
// 不会出现「旧数据已清空、新数据只写入一半」的中间状态。
// 排序也统一放在这里 —— 启动、新建、删除、增删歌曲都经由这一个出口
async function saveLists(o){
  const entries = [];
  for(const k in o){
    entries.push({ id: k, data: sortSongsInPlace(o[k]) });
  }
  await dbReplaceAll('customLists', entries);
  renderLists();
}

async function createList(){
  const n=document.getElementById('newListName').value.trim();
  if(!n)return;
  const lists=await loadLists();
  if(lists[n]){await uiAlert('该歌单已存在');return;}
  lists[n]=[];
  await saveLists(lists);
  document.getElementById('newListName').value = '';
}

// 打开歌曲选择窗口，已加入该歌单的歌曲默认勾选
async function showAddSongsDialog(listName){
  targetList=listName;
  const dialog=document.getElementById('songDialog');
  const container=document.getElementById('dialogSongList');
  container.replaceChildren();

  // 复用同一个对话框，此处替换其标题
  const title = dialog.querySelector('h3');
  if(title) title.textContent = '管理当前歌单歌曲';

  const lists = await loadLists();
  const existingSongs = lists[listName] || [];
  allSongsCache = lists['全部歌曲'] || tracks;

  dialog.showModal();
  // 弹窗内的排序组件与歌曲列表页共用同一份状态，打开时先对齐显示
  syncListSortControls();
  renderDialogSongList(existingSongs);
}

// 管理弹窗内的歌曲列表：按当前排序状态展示。
// 勾选框的值始终是歌曲在曲库中的原始下标，排序只改变显示顺序，
// 不影响「确认」时按勾选结果回写歌单的逻辑。
function renderDialogSongList(checkedSongs){
  const dialog=document.getElementById('songDialog');
  const container=document.getElementById('dialogSongList');
  if(!dialog || !container || !dialog.open) return;

  // 重排时保留已勾选状态：未传入时按当前勾选读取
  let checked;
  if(Array.isArray(checkedSongs)){
    checked=new Set(checkedSongs);
  }else{
    checked=new Set([...container.querySelectorAll('input[type=checkbox]:checked')].map(cb=>cb.value));
  }

  container.replaceChildren();
  sortSongEntriesForView(allSongsCache, listSortKey, listSortDir).forEach(({song,index})=>{
    const label=document.createElement('label');
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.value=String(index);
    cb.checked=checked.has(String(index)) || checked.has(song);
    // label 包住 input，点击文字即可勾选；歌名通过 textContent 写入，不参与 HTML 解析
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + song));
    container.appendChild(label);
  });
}

async function confirmAddSongs(){
  const checkboxes=document.querySelectorAll('#dialogSongList input[type=checkbox]');
  const lists=await loadLists();
  if(!lists[targetList]) lists[targetList]=[];

  // 整个列表按当前勾选状态重新写入(不再是只在最后追加)
  const newList=[];
  checkboxes.forEach(cb=>{
    if(cb.checked){
      const song=allSongsCache[parseInt(cb.value)];
      if(!newList.includes(song)) newList.push(song);
    }
  });
  lists[targetList]=newList;

  await saveLists(lists);
  closeDialog();
}

function closeDialog(){
  document.getElementById('songDialog').close();
}

async function deleteSongFromList(listName,idx){
  const lists=await loadLists();
  lists[listName].splice(idx,1);
  await saveLists(lists);
}

async function deleteList(name){
  if(name==='全部歌曲') return;
  // 删掉整个歌单是不可逆的，加一道确认
  if(!(await uiConfirm(`确定删除歌单「${name}」吗？`))) return;
  const lists=await loadLists();
  delete lists[name];
  await saveLists(lists);
}

// 渲染歌单列表：「全部歌曲」不提供添加入口，自建歌单的操作按钮为「管理」
// 并发保护：showPage('lists')、saveLists 与删除操作都可能让两次渲染重叠。
// 「先清空 DOM 再 await」的写法会让两次渲染各追加一份，列表出现重影；
// 这里改为「先取数据、只让最新一次落地」，与 playTrack 的 _seq 做法一致
let renderListsSeq = 0;

async function renderLists(){
  const seq = ++renderListsSeq;
  const lists = await loadLists();
  if(seq !== renderListsSeq) return;   // 已经有更新的渲染在跑，放弃本次
  await loadSongMetaMap();             // 排序要用到时长/大小/添加时间
  if(seq !== renderListsSeq) return;

  const div=document.getElementById('customLists');
  div.replaceChildren();
  if(!lists['全部歌曲']){ 
    lists['全部歌曲']=tracks; 
    await saveLists(lists); 
    if(seq !== renderListsSeq) return;  // saveLists 内部又触发了一轮渲染，让新的那次落地
  }

  // 歌单标题同样按名称排序，「全部歌曲」固定排在最前
  const names=Object.keys(lists).sort((a,b)=>{
    if(a==='全部歌曲') return -1;
    if(b==='全部歌曲') return 1;
    return a.localeCompare(b,'zh-CN',{numeric:true});
  });

  names.forEach(k=>{
    const wrap=document.createElement('div');
    wrap.className='list';

    const title=document.createElement('div');
    title.className='list-title';

    const nameSpan=document.createElement('span');
    nameSpan.textContent=k;                 // 歌单名走 textContent
    title.appendChild(nameSpan);

    // 右侧操作组：删除 / 管理按钮与展开指示箭头同组，整体右对齐
    const actions=document.createElement('span');
    actions.className='list-title-actions';

    if(k!=='全部歌曲'){
      const delBtn=document.createElement('button');
      delBtn.type='button';
      delBtn.textContent='删除';
      delBtn.setAttribute('aria-label',`删除歌单 ${k}`);
      // 按钮自行拦截事件，标题的展开与收起就不会被误触发，无需再判断 e.target.tagName
      delBtn.addEventListener('click',e=>{ e.stopPropagation(); deleteList(k); });

      const manageBtn=document.createElement('button');
      manageBtn.type='button';
      manageBtn.textContent='管理';
      manageBtn.setAttribute('aria-label',`管理歌单 ${k} 的歌曲`);
      manageBtn.addEventListener('click',e=>{ e.stopPropagation(); showAddSongsDialog(k); });

      actions.append(delBtn, manageBtn);
    }

    // 展开 / 收起指示箭头：图标取全局 sprite 的 chevron-right（指向右），
    // 展开时旋转 90° 指向下，与设置分组折叠箭头同一规范。
    // 旋转方向由 .list.expanded 类统一驱动，与展开状态严格同步
    const expandBtn=document.createElement('button');
    expandBtn.type='button';
    expandBtn.className='list-expand-btn';
    const expandIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    expandIcon.setAttribute('class','icon list-expand-icon');
    expandIcon.setAttribute('aria-hidden','true');
    const expandUse=document.createElementNS('http://www.w3.org/2000/svg','use');
    expandUse.setAttribute('href','#chevron-right');
    expandIcon.appendChild(expandUse);
    expandBtn.appendChild(expandIcon);
    actions.appendChild(expandBtn);
    title.appendChild(actions);

    wrap.appendChild(title);

    const ul=document.createElement('div');
    // 按当前选择的排序方式展示（默认「名称 升序」，即原始顺序）
    sortSongsForView(lists[k]||[], listSortKey, listSortDir).forEach((song)=>{
      const item=document.createElement('div');
      item.className='song-item';
      item.style.cursor = 'pointer';
      const songSpan=document.createElement('span');
      songSpan.className='song-name';
      songSpan.textContent=song;            // 歌名走 textContent
      item.appendChild(songSpan);
      const metaSpan=document.createElement('span');
      metaSpan.className='song-meta';
      metaSpan.textContent=songMetaBrief(song);
      item.appendChild(metaSpan);
      // 点歌单里的某首歌：按歌单当前顺序建队列，从这首歌开始播
      item.addEventListener('click',()=>playFromList(k,song));
      ul.appendChild(item);
    });

    // 展开状态：重渲染后按记录恢复；箭头方向、aria 状态与实际展开情况一致
    const setExpanded=(expanded)=>{
      wrap.classList.toggle('expanded', expanded);
      ul.style.display = expanded ? 'block' : 'none';
      expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      expandBtn.setAttribute('aria-label', `${expanded?'收起':'展开'}歌单 ${k}`);
      if(expanded) expandedLists.add(k); else expandedLists.delete(k);
    };
    setExpanded(expandedLists.has(k));

    const toggle=()=>setExpanded(!wrap.classList.contains('expanded'));
    // 箭头自行拦截事件，避免与标题的展开 / 收起重复触发
    expandBtn.addEventListener('click',e=>{ e.stopPropagation(); toggle(); persistExpandedLists(); });
    title.addEventListener('click',()=>{ toggle(); persistExpandedLists(); });

    wrap.appendChild(ul);
    div.appendChild(wrap);
  });
}

// 从歌单点歌：队列取自该歌单的当前顺序，显示顺序即播放顺序，起点为被点击的那一首
// 旧实现会把点击项提到队首再打乱其余项，「下一首」的落点完全不可预期
async function playFromList(listName,song){
  const lists=await loadLists();
  const fullList=sortSongsForView(lists[listName] || [], listSortKey, listSortDir);
  if(fullList.length===0) return;
  // 随机模式：从歌单点歌时直接生成随机队列，并从点到的那一首开始播放
  if(currentPlayMode()==='random'){
    shuffleArrayInPlace(fullList);
  }
  currentQueue=[...fullList];
  const index=currentQueue.indexOf(song);
  currentTrack = index >= 0 ? index : 0;
  await dbPut('currentList', 'queue', currentQueue);
  renderPlaylist();
  playTrack(currentTrack);
}
