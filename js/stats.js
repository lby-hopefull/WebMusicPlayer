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
  d.innerHTML='';
  const sortedStats = Object.entries(s).sort((a, b) => b[1] - a[1]);
  if(sortedStats.length === 0) {
    d.innerHTML = '<div style="text-align:center;color:#999;">暂无播放记录</div>';
    return;
  }
  sortedStats.forEach(([song, count]) => {
    const div = document.createElement('div');
    div.innerHTML = `<span>${song}</span><span>${count} 次</span>`;
    d.appendChild(div);
  });
}

