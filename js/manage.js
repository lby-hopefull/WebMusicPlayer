// ========== 管理页面功能 ==========
// ========== 备选：使用 getAllKeys 获取所有缓存的键名 ==========
async function updateCachedSongsSet() {
  cachedSongsSet.clear();
  
  if (!db) return;
  
  // 使用 getAllKeys 只获取所有键名（比 getAll 更高效）
  const keys = await new Promise(resolve => {
    const tx = db.transaction([storeName], 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  
  // 将键名添加到集合
  keys.forEach(key => {
    if (typeof key === 'string') {
      cachedSongsSet.add(key);
    }
  });
  
  updateCachedCount();
}

async function renderManageList() {
  await updateCachedSongsSet();
  const container = document.getElementById('manageSongList');
  container.replaceChildren();
  // 修复：不清空 selectedSongs，保留用户选择状态
  // selectedSongs.clear();  // 删除或注释掉这一行
  
  tracks.forEach((song, idx) => {
    const item = document.createElement('div');
    item.className = 'manage-song-item';
    const isCached = cachedSongsSet.has(song);

    // 节点全部手工构建:歌名里带 < > & ' " 也只会作为普通文字显示,
    // 不会再被拼进 innerHTML 或内联事件属性里当代码执行
    const nameWrap = document.createElement('div');
    nameWrap.className = 'manage-song-name';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `song_${idx}`;
    checkbox.value = String(idx);
    checkbox.checked = selectedSongs.has(idx);
    checkbox.setAttribute('aria-label', `选择 ${song}`);
    checkbox.addEventListener('change', () => toggleSongSelection(idx));

    const status = document.createElement('span');
    status.className = `cache-status ${isCached ? 'cached' : 'uncached'}`;
    status.textContent = isCached ? '已缓存' : '未缓存';

    const label = document.createElement('label');
    label.htmlFor = `song_${idx}`;
    label.style.cursor = 'pointer';
    label.style.flex = '1';
    label.textContent = song;

    nameWrap.append(checkbox, status, label);
    item.appendChild(nameWrap);

    if (isCached) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '删除';
      delBtn.setAttribute('aria-label', `删除 ${song} 的缓存`);
      delBtn.addEventListener('click', () => deleteSingleCache(song));
      item.appendChild(delBtn);
    }

    container.appendChild(item);
  });
  
  updateSelectedCount();
  // updateCachedCount(); // 移到 updateCachedSongsSet 中统一调用
}

async function deleteSingleCache(songName) {
  if(!(await uiConfirm(`确定删除 "${songName}" 的缓存吗？`))) return;
  await dbDelete(storeName, songName);
  renderManageList();
}

function toggleSongSelection(idx) {
  const checkbox = document.getElementById(`song_${idx}`);
  if(checkbox.checked) {
    selectedSongs.add(idx);
  } else {
    selectedSongs.delete(idx);
  }
  updateSelectedCount();
}

function selectAllSongs() {
  document.querySelectorAll('#manageSongList input[type=checkbox]').forEach(cb => {
    cb.checked = true;
    selectedSongs.add(parseInt(cb.value));
  });
  updateSelectedCount();
}

function deselectAllSongs() {
  document.querySelectorAll('#manageSongList input[type=checkbox]').forEach(cb => {
    cb.checked = false;
  });
  selectedSongs.clear();
  updateSelectedCount();
}

function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = `已选择: ${selectedSongs.size}`;
}

function updateCachedCount() {
  document.getElementById('cachedCount').textContent = `已缓存: ${cachedSongsSet.size}`;
}

async function downloadSelected() {
  if(selectedSongs.size === 0) {
    await uiAlert('请先选择歌曲');
    return;
  }
  
  const songsToDownload = Array.from(selectedSongs).map(idx => tracks[idx]);
  await batchDownload(songsToDownload);
}

async function downloadAll() {
  if(tracks.length === 0) {
    await uiAlert('没有歌曲可下载');
    return;
  }
  await batchDownload([...tracks]);
}

async function batchDownload(songs) {
  if (!songs || songs.length === 0) return;
  
  const container = document.getElementById('progressContainer');
  container.style.display = 'block';
  
  let completed = 0;
  const total = songs.length;
  updateProgress(completed, total);
  
  for (const song of songs) {
    try {
      // 检查是否已缓存
      const existing = await getMusic(song);
      if (existing) {
        completed++;
        updateProgress(completed, total);
        continue;
      }
      
      const response = await fetch('/music_play?file=' + encodeURIComponent(song));
      if (!response.ok) throw new Error('Download failed');
      
      const arrayBuffer = await response.arrayBuffer();
      
      // 保存到 IndexedDB:统一走 db.js 的封装,不再手写事务
      if (!await dbPut(storeName, song, arrayBuffer)) throw new Error('写入缓存失败');
      
      completed++;
      updateProgress(completed, total);
      
      // 每完成5个更新一次列表
      if (completed % 5 === 0) {
        await updateCachedSongsSet();
        renderManageList();
      }
      
    } catch (error) {
      console.error(`下载失败: ${song}`, error);
    }
  }
  
  // 最终更新
  updateProgress(completed, total);
  await updateCachedSongsSet();
  renderManageList();
  
  setTimeout(() => {
    container.style.display = 'none';
  }, 2000);
  
  if (completed === total) {
    await uiAlert('缓存完成！');
  } else {
    await uiAlert(`缓存完成: ${completed}/${total}，${total - completed} 个失败`);
  }
}

function updateProgress(current, total) {
  const progressText = document.getElementById('progressText');
  const progressBarFill = document.getElementById('progressBarFill');
  
  progressText.textContent = `进度: ${current}/${total}`;
  const percent = total > 0 ? (current / total) * 100 : 0;
  progressBarFill.style.width = `${percent}%`;
}

async function deleteSelected() {
  if(selectedSongs.size === 0) {
    await uiAlert('请先选择歌曲');
    return;
  }
  
  if(!(await uiConfirm(`确定删除选中的 ${selectedSongs.size} 首歌曲缓存并从所有列表中移除吗？`))) return;
  
  const songsToDelete = Array.from(selectedSongs).map(idx => tracks[idx]);
  
  // 从所有列表中删除这些歌曲
  const lists = await loadLists();
  for(const song of songsToDelete) {
    // 从所有自定义列表中删除
    for(const listName in lists) {
      if(listName !== '全部歌曲' && lists[listName]) {
        const idx = lists[listName].indexOf(song);
        if(idx > -1) {
          lists[listName].splice(idx, 1);
        }
      }
    }
    
    // 从当前播放队列中删除
    const queueIdx = currentQueue.indexOf(song);
    if(queueIdx > -1) {
      currentQueue.splice(queueIdx, 1);
      if(currentTrack >= queueIdx && currentTrack > 0) {
        currentTrack--;
      }
    }
    
    // 从tracks中删除
    const trackIdx = tracks.indexOf(song);
    if(trackIdx > -1) {
      tracks.splice(trackIdx, 1);
    }
    
    // 删除缓存
    await dbDelete(storeName, song);
  }
  
  // 更新全部歌曲列表
  lists['全部歌曲'] = tracks;
  await saveLists(lists);
  await dbPut('playlist', 'all', tracks);
  await dbPut('currentList', 'queue', currentQueue);
  
  await uiAlert('删除完成!');
  selectedSongs.clear();
  updateSelectedCount();
  renderManageList();
  renderLists();
  renderPlaylist();
}

async function clearCache(){
  if(await uiConfirm('清除所有音频缓存？')) {
    await dbClear(storeName);
    await uiAlert('已清除缓存');
    renderManageList();
  }
}

// ========== 添加本地文件夹功能 ==========
function addLocalFolder(){
  document.getElementById('localFolderInput').click();
}

async function handleLocalFolder(event){
  const files = Array.from(event.target.files || []);
  // 清空 input，允许重复选择同一文件夹
  event.target.value = '';
  
  if(!files.length){
    return;
  }
  
  // 过滤常见音频后缀名
  const audioExt = /\.(mp3|flac|wav|ogg|m4a|aac|opus|wma|ape|mp4|aif|aiff)$/i;
  const audioFiles = files.filter(f => audioExt.test(f.name));
  
  if(!audioFiles.length){
    await uiAlert('所选文件夹中未找到音频文件');
    return;
  }
  
  const progressContainer = document.getElementById('progressContainer');
  progressContainer.style.display = 'block';
  
  // 加载现有"全部歌曲"用作去重依据
  const playlistAll = await dbGet('playlist', 'all');
  const customAll = await dbGet('customLists', '全部歌曲');
  const existingSet = new Set();
  (playlistAll?.data || []).forEach(s => existingSet.add(s));
  (customAll?.data || []).forEach(s => existingSet.add(s));
  tracks.forEach(s => existingSet.add(s));
  
  // 文件名去重，保留后缀名
  const seenInBatch = new Set();
  const newFiles = audioFiles.filter(f => {
    if(seenInBatch.has(f.name)) return false;
    seenInBatch.add(f.name);
    return !existingSet.has(f.name);
  });
  
  const skipped = audioFiles.length - newFiles.length;
  const total = newFiles.length;
  let completed = 0;
  let failed = 0;
  updateProgress(0, total);
  
  for(const file of newFiles){
    try {
      const arrayBuffer = await file.arrayBuffer();
      // 同样统一走 db.js 的封装
      if(!await dbPut(storeName, file.name, arrayBuffer)) throw new Error('写入缓存失败');
      existingSet.add(file.name);
      completed++;
      updateProgress(completed, total);
      
      // 每完成 3 个更新一次管理列表（避免太频繁）
      if(completed % 3 === 0){
        await updateCachedSongsSet();
        renderManageList();
      }
    } catch(err){
      console.error(`添加失败: ${file.name}`, err);
      failed++;
    }
  }
  
  // 把新加入的歌曲名合入"两个全部歌曲"
  if(completed > 0){
    const newNames = newFiles.slice(0, completed).map(f => f.name);
    
    // 合并 playlist.all
    const mergedPlaylist = sortSongsInPlace([...new Set([...(playlistAll?.data || []), ...newNames])]);
    await dbPut('playlist', 'all', mergedPlaylist);
    
    // 合并 customLists.全部歌曲
    const mergedCustom = sortSongsInPlace([...new Set([...(customAll?.data || []), ...newNames])]);
    await dbPut('customLists', '全部歌曲', mergedCustom);
    
    // 同步全局 tracks（与 playlist.all 保持一致）
    tracks = mergedPlaylist;
  }
  
  // 收尾：刷新缓存集合与各列表
  await updateCachedSongsSet();
  renderManageList();
  renderLists();
  renderPlaylist();
  
  setTimeout(() => {
    progressContainer.style.display = 'none';
  }, 2000);
  
  if(total === 0){
    await uiAlert(`未发现新歌曲（跳过 ${skipped} 个已存在或重复）`);
  } else if(failed === 0){
    await uiAlert(`已添加 ${completed} 首本地歌曲${skipped ? `，跳过 ${skipped} 个已存在` : ''}`);
  } else {
    await uiAlert(`添加完成: ${completed} 成功，${failed} 失败${skipped ? `，${skipped} 个已跳过` : ''}`);
  }
}

