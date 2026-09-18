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
}

async function loadLyricDelay() {
  const saved = await dbGet('setting', 'lyricDelay');
  if(saved && saved.data !== undefined) {
    lyricDelay = saved.data;
    document.getElementById('lyricDelayValue').textContent = lyricDelay.toFixed(2) + 's';
  }
}

// ========== 真随机数生成 ==========
function trueRandom(max) {
  if(max <= 0) return 0;
  const seed = Date.now() + Math.random() * 10000;
  return Math.floor((Math.abs(Math.sin(seed)) * 10000) % max);
}

