// ========== 封面主色 → 背景色斑 ==========
// 使用 ColorThief（MIT，见 NOTICE.md）从当前封面提取若干关键色，写入 --ambient-1..3，
// 由 css/base.css 的 #ambient 渲染为缓慢移动的大尺寸光斑。
// 封面来源为 IndexedDB 的 Blob URL 或同源 /music_play，均不受跨域限制。
// 无封面（或取色失败）时不绘制任何光斑，背景保持主题底色。

// 记录已取色的封面地址，避免同一张封面重复计算
let ambientSourceKey = '';

function applyAmbientColors(palette) {
  const layer = document.getElementById('ambient');
  const colors = (palette || []).slice(0, 3);

  if (!colors.length) {
    // 交给 CSS 隐藏：初始与切到无封面曲目时都回到纯主题底色
    if (layer) layer.classList.add('is-empty');
    return;
  }

  // 调色板可能不足三色，末位颜色重复补齐
  while (colors.length < 3) colors.push(colors[colors.length - 1]);
  const root = document.documentElement;
  colors.forEach((rgb, i) => {
    root.style.setProperty(`--ambient-${i + 1}`, `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`);
  });
  if (layer) layer.classList.remove('is-empty');
}

function extractAmbientFrom(img) {
  if (!img) return;
  const run = () => {
    if (!img.naturalWidth) return;
    const key = img.currentSrc || img.src;
    if (!key || key === ambientSourceKey) return;
    ambientSourceKey = key;
    try {
      applyAmbientColors(new ColorThief().getPalette(img, 6));
    } catch (err) {
      // 取色失败不影响播放，回到纯主题底色
      console.warn('封面主色提取失败，背景保持主题底色：', err && err.message);
      applyAmbientColors(null);
    }
  };
  if (img.complete) run();
  else img.addEventListener('load', run, { once: true });
}

// 切歌到无封面的曲目时复位
function resetAmbient() {
  ambientSourceKey = '';
  applyAmbientColors(null);
}
