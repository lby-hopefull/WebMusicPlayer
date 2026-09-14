// ========== 自定义列表管理 ==========
async function loadLists(){
  const result = await dbGetAll('customLists');
  const lists = {};
  result.forEach(item => {
    lists[item.id] = item.data;
  });
  return lists;
}

async function saveLists(o){
  await dbClear('customLists');
  for(const k in o){
    await dbPut('customLists', k, o[k]);
  }
  renderLists();
}

async function createList(){
  const n=document.getElementById('newListName').value.trim();
  if(!n)return;
  const lists=await loadLists();
  if(lists[n]){alert('该列表已存在');return;}
  lists[n]=[];
  await saveLists(lists);
  document.getElementById('newListName').value = '';
}

// 打开歌曲管理窗口，自动勾选已添加的歌曲
async function showAddSongsDialog(listName){
  targetList=listName;
  const dialog=document.getElementById('songDialog');
  const container=document.getElementById('dialogSongList');
  container.innerHTML='';
  
  // 修改标题
  const title = dialog.querySelector('h3');
  if(title) title.textContent = '管理当前列表歌曲';
  
  const lists = await loadLists();
  const existingSongs = lists[listName] || [];
  allSongsCache = lists['全部歌曲'] || tracks;
  
  allSongsCache.forEach((song,i)=>{
    const label=document.createElement('label');
    const checked = existingSongs.includes(song) ? 'checked' : '';
    label.innerHTML=`<input type="checkbox" value="${i}" ${checked}> ${song}`;
    container.appendChild(label);
  });
  dialog.showModal();
}

async function confirmAddSongs(){
  const checkboxes=document.querySelectorAll('#dialogSongList input[type=checkbox]');
  const lists=await loadLists();
  if(!lists[targetList]) lists[targetList]=[];

  // 整个列表按当前勾选状态重新写入
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
  const lists=await loadLists();
  delete lists[name];
  await saveLists(lists);
}

// 渲染列表
async function renderLists(){
  const div=document.getElementById('customLists');
  div.innerHTML='';
  const lists=await loadLists();
  if(!lists['全部歌曲']){ 
    lists['全部歌曲']=tracks; 
    await saveLists(lists); 
  }

  for(const k in lists){
    const wrap=document.createElement('div');
    wrap.className='list';
    const title=document.createElement('div');
    title.className='list-title';
    title.innerHTML = `<span>${k}</span>` +
      (k!=='全部歌曲'?`<span><button onclick="event.stopPropagation();deleteList('${k}')">删除</button><button onclick="event.stopPropagation();showAddSongsDialog('${k}')">管理</button></span>`:'');
    title.onclick=function(e){
      if(e.target.tagName==='BUTTON') return;
      const ul=this.nextElementSibling;
      ul.style.display = ul.style.display==='none'?'block':'none';
    };
    wrap.appendChild(title);

    const ul=document.createElement('div');
    ul.style.display='none';
    lists[k].forEach((song,idx)=>{
      const item=document.createElement('div');
      item.className='song-item';
      item.style.cursor = 'pointer';
      item.innerHTML=`<span>${song}</span>`;
      item.onclick=()=>playListRandomFromSong(k,song);
      ul.appendChild(item);
    });
    wrap.appendChild(ul);
    div.appendChild(wrap);
  }
}

async function playListRandomFromSong(listName,song){
  const lists=await loadLists();
  if(!lists[listName] || lists[listName].length===0) return;
  const fullList=[...lists[listName]];
  if(fullList.length === 0) return;
  const index=fullList.indexOf(song);
  if(index<0) { 
    currentQueue = [...fullList];
    currentTrack = 0;
  } else {
    const first=fullList.splice(index,1);
    for(let i=fullList.length-1;i>0;i--){
      const j=trueRandom(i+1);
      [fullList[i],fullList[j]]=[fullList[j],fullList[i]];
    }
    currentQueue=[...first,...fullList];
    currentTrack=0;
  }
  await dbPut('currentList', 'queue', currentQueue);
  renderPlaylist();
  playTrack(currentTrack);
}

