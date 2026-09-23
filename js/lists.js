// ========== 自定义列表管理 ==========
async function loadLists(){
  const result = await dbGetAll('customLists');
  const lists = {};
  result.forEach(item => {
    lists[item.id] = sortSongsInPlace(item.data || []);
  });
  return lists;
}

// 整表原子写入:清空 + 写回在同一个事务里完成,中途失败会整体回滚,
// 不会再出现"清空了旧的、新的只写了一半"的半个歌单库。
// 顺便在这里统一按名称排序 —— 启动、建单、删单、管理歌曲全都走这一个出口
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
  if(lists[n]){await uiAlert('该列表已存在');return;}
  lists[n]=[];
  await saveLists(lists);
  document.getElementById('newListName').value = '';
}

// 打开歌曲管理窗口，自动勾选已添加的歌曲
async function showAddSongsDialog(listName){
  targetList=listName;
  const dialog=document.getElementById('songDialog');
  const container=document.getElementById('dialogSongList');
  container.replaceChildren();
  
  // 修改标题
  const title = dialog.querySelector('h3');
  if(title) title.textContent = '管理当前列表歌曲';
  
  const lists = await loadLists();
  const existingSongs = lists[listName] || [];
  allSongsCache = lists['全部歌曲'] || tracks;
  
  allSongsCache.forEach((song,i)=>{
    const label=document.createElement('label');
    const cb=document.createElement('input');
    cb.type='checkbox';
    cb.value=String(i);
    cb.checked=existingSongs.includes(song);
    // label 包住 input,点文字即勾选;歌名用 textContent,不参与 HTML 解析
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + song));
    container.appendChild(label);
  });
  dialog.showModal();
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
  // 删掉整个歌单是不可逆的,加一道确认
  if(!(await uiConfirm(`确定删除歌单「${name}」吗？`))) return;
  const lists=await loadLists();
  delete lists[name];
  await saveLists(lists);
}

// 渲染列表：删除全部歌曲的添加按钮，自建列表按钮改为管理
// 并发保护:showPage('lists') / saveLists / 删除操作都可能让两次渲染重叠。
// 原来"先清空 DOM 再 await"的写法会让两次渲染各追加一份,列表直接重影;
// 改成"先取数据、只让最新一次落地"(和 playTrack 的 _seq 同一套路)
let renderListsSeq = 0;

async function renderLists(){
  const seq = ++renderListsSeq;
  const lists = await loadLists();
  if(seq !== renderListsSeq) return;   // 已经有更新的渲染在跑,放弃本次

  const div=document.getElementById('customLists');
  div.replaceChildren();
  if(!lists['全部歌曲']){ 
    lists['全部歌曲']=tracks; 
    await saveLists(lists); 
    if(seq !== renderListsSeq) return;  // saveLists 内部又触发了一轮渲染,让新的那次落地
  }

  // 歌单标题也按名称排序,"全部歌曲"固定排在最前
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

    if(k!=='全部歌曲'){
      const btnWrap=document.createElement('span');

      const delBtn=document.createElement('button');
      delBtn.type='button';
      delBtn.textContent='删除';
      delBtn.setAttribute('aria-label',`删除歌单 ${k}`);
      // 按钮自己拦下事件,标题的展开/收起就不会被误触发(不必再判断 e.target.tagName)
      delBtn.addEventListener('click',e=>{ e.stopPropagation(); deleteList(k); });

      const manageBtn=document.createElement('button');
      manageBtn.type='button';
      manageBtn.textContent='管理';
      manageBtn.setAttribute('aria-label',`管理歌单 ${k} 的歌曲`);
      manageBtn.addEventListener('click',e=>{ e.stopPropagation(); showAddSongsDialog(k); });

      btnWrap.append(delBtn, manageBtn);
      title.appendChild(btnWrap);
    }

    title.addEventListener('click',()=>{
      const ul=title.nextElementSibling;
      ul.style.display = ul.style.display==='none'?'block':'none';
    });
    wrap.appendChild(title);

    const ul=document.createElement('div');
    ul.style.display='none';
    (lists[k]||[]).forEach((song)=>{
      const item=document.createElement('div');
      item.className='song-item';
      item.style.cursor = 'pointer';
      const songSpan=document.createElement('span');
      songSpan.textContent=song;            // 歌名走 textContent
      item.appendChild(songSpan);
      // 点歌单里的某首歌:按歌单当前顺序建队列,从这首歌开始播
      item.addEventListener('click',()=>playFromList(k,song));
      ul.appendChild(item);
    });
    wrap.appendChild(ul);
    div.appendChild(wrap);
  });
}

// 从歌单点歌:队列 = 该歌单的当前顺序(已按名称排序),起点就是点击的那首
// 原实现会把点击项提到队首再把其余随机打乱,"下一首"变得完全不可预期
async function playFromList(listName,song){
  const lists=await loadLists();
  const fullList=lists[listName] || [];
  if(fullList.length===0) return;
  currentQueue=[...fullList];
  const index=fullList.indexOf(song);
  currentTrack = index >= 0 ? index : 0;
  await dbPut('currentList', 'queue', currentQueue);
  renderPlaylist();
  playTrack(currentTrack);
}
