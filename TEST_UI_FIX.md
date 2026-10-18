# UI 修复验证清单

## 修复内容

### 1. 底部导航栏居中 ✅

**问题描述**:
- `performance.css` 中的 `transform: translateZ(0)` 覆盖了 `base.css` 中的 `transform: translateX(-50%)`
- 导致导航栏不再居中，偏移到左侧

**修复方案**:
```css
/* performance.css */
.navbar {
  /* 组合使用两个 transform，同时实现居中和 GPU 加速 */
  transform: translateX(-50%) translateZ(0);
}
```

**验证步骤**:
1. 打开播放器页面
2. 检查底部导航栏是否居中显示
3. 在不同屏幕尺寸下测试（手机、平板、桌面）
4. 确认导航栏始终在视口底部居中

**预期结果**:
- ✅ 导航栏水平居中
- ✅ GPU 加速仍然生效
- ✅ 响应式布局正常

---

### 2. 播放器页面底部空白 ✅

**问题描述**:
- 滚动到页面底部时，内容被悬浮的导航栏胶囊遮挡
- 最后一行播放控制或歌词不可见

**修复方案**:
```css
/* player.css */
.player-page {
  /* 所有播放器内页统一底部空白 */
  padding-bottom: calc(var(--navbar-height) + var(--spacing-2xl));
}

#player-page-cover {
  /* 封面页额外的底部空白 */
  padding-bottom: calc(var(--navbar-height) + var(--spacing-xl));
}
```

**验证步骤**:

#### 测试场景 1: 封面 + 播放控制页
1. 打开播放器，显示封面和播放控制
2. 滚动到页面底部
3. 确认音量控制、播放模式选择器完全可见
4. 确认没有内容被导航栏遮挡

#### 测试场景 2: 播放队列页
1. 向下滑动到第二页（播放队列）
2. 滚动到队列底部
3. 确认最后一首歌曲完全可见
4. 确认拖动把手可以正常操作

#### 测试场景 3: 横屏模式
1. 旋转设备到横屏
2. 检查封面和控制区域布局
3. 滚动到底部，确认空白足够

#### 测试场景 4: 移动端浏览器
1. 在 iOS Safari 测试
2. 在 Android Chrome 测试
3. 检查地址栏隐藏/显示时的表现

**预期结果**:
- ✅ 底部始终有足够空白（约 96px + 32px = 128px）
- ✅ 最后一行内容完全可见
- ✅ 不会被导航栏遮挡
- ✅ 滚动体验流畅

---

## 技术细节

### Transform 组合语法
```css
/* ❌ 错误：后者覆盖前者 */
transform: translateX(-50%);
transform: translateZ(0);

/* ✅ 正确：组合在一个声明中 */
transform: translateX(-50%) translateZ(0);
```

### CSS 变量计算
```css
/* --navbar-height = 96px (css/variables.css) */
/* --spacing-xl = 24px */
/* --spacing-2xl = 32px */

padding-bottom: calc(var(--navbar-height) + var(--spacing-2xl));
/* 结果: 96px + 32px = 128px */
```

### 层级结构
```
#page-player (padding-bottom: 0)
└─ .player-page (padding-bottom: navbar-height + 2xl)
   └─ #player-page-cover (padding-bottom: navbar-height + xl)
      └─ 封面、播放控制等内容
```

---

## 回归测试

### 检查其他页面
- [ ] 歌曲列表页 - 底部空白正常
- [ ] 统计页 - 底部空白正常
- [ ] 设置页 - 底部空白正常

### 检查导航功能
- [ ] 点击导航按钮切换页面
- [ ] 当前页高亮显示正确
- [ ] 悬停效果正常
- [ ] 焦点样式正确

### 性能检查
- [ ] GPU 加速仍然生效（查看 Layers 面板）
- [ ] 没有额外的合成层
- [ ] 滚动性能流畅

---

## 已知限制

1. **底部空白固定值**
   - 使用固定的 `--navbar-height` (96px)
   - 如果导航栏高度改变，需同步更新变量

2. **横屏模式**
   - 某些设备横屏时视口高度较小
   - 可能需要进一步调整空白大小

3. **浏览器兼容性**
   - `calc()` 函数：所有现代浏览器支持
   - `transform` 组合：所有现代浏览器支持
   - CSS 变量：IE11 不支持（但项目已不考虑 IE）

---

## 调试命令

### 查看导航栏位置
```javascript
const navbar = document.querySelector('.navbar');
console.log('Left:', navbar.offsetLeft);
console.log('Width:', navbar.offsetWidth);
console.log('Viewport width:', window.innerWidth);
console.log('Centered:', (window.innerWidth - navbar.offsetWidth) / 2);
```

### 查看底部空白
```javascript
const playerPage = document.querySelector('.player-page');
const styles = getComputedStyle(playerPage);
console.log('Padding bottom:', styles.paddingBottom);
```

### 查看 transform 值
```javascript
const navbar = document.querySelector('.navbar');
console.log('Transform:', getComputedStyle(navbar).transform);
```

---

## 修复前后对比

### 修复前
```
导航栏位置: 左侧偏移
播放器底部: 内容被遮挡
```

### 修复后
```
导航栏位置: 水平居中 ✅
播放器底部: 完整显示 ✅
GPU 加速: 保持启用 ✅
```

---

## 提交记录

**Commit**: `c8e9166`

**文件变更**:
- `css/performance.css` - 导航栏 transform 组合
- `css/player.css` - 播放器页面底部空白

**影响范围**:
- 底部导航栏布局
- 播放器页面滚动体验
- GPU 渲染性能（无变化）
