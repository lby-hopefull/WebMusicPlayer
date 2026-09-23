// ========== 播放统计 ==========
async function incStats(name){
  const stats = await dbGet('playStats', 'songs');
  let s = {};
  if(stats && stats.data) {
    s = stats.data;
  }
  s[name]=(s[name]||0)+1;
  await dbPut('playStats', 'songs', s);
  renderStats();
}

async function renderStats(){
  const stats = await dbGet('playStats', 'songs');
  const s = stats ? (stats.data || {}) : {};
  const d=document.getElementById('stats');
  d.replaceChildren();
  const sortedStats = Object.entries(s).sort((a, b) => b[1] - a[1]);
  if(sortedStats.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-hint';
    empty.textContent = '暂无播放记录';
    d.appendChild(empty);
    return;
  }
  sortedStats.forEach(([song, count]) => {
    const div = document.createElement('div');
    // 歌名一律走 textContent:文件名里的 <img onerror=...> 之类只会显示成普通文字
    const nameSpan = document.createElement('span');
    nameSpan.textContent = song;
    const countSpan = document.createElement('span');
    countSpan.textContent = `${count} 次`;
    div.append(nameSpan, countSpan);
    d.appendChild(div);
  });
}

