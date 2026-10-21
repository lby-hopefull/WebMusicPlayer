<div align="center">

# ESP32 音乐播放器（纯前端 Web 播放器）

面向局域网与嵌入式设备的纯前端音乐播放器，播放逻辑与界面均由浏览器端 JavaScript 驱动。

[中文](#中文) &nbsp;|&nbsp; [English](#english)

</div>

---

## 中文

### 简介

纯前端实现的音乐播放器，最初面向局域网与 ESP32 等嵌入式设备，同样适用于个人站点部署。
支持逐字歌词、系统媒体控制、IndexedDB 离线缓存与本地文件夹导入。

### 功能

| 模块 | 说明 |
| :--- | :--- |
| 播放控制 | 顺序、单曲循环、随机三种模式；支持音量调节与进度拖动 |
| 键盘快捷键 | 空格键播放或暂停；左右方向键快退或快进 5 秒（表单控件获得焦点时不生效） |
| 歌词 | 逐字与逐词高亮，支持译文；点击歌词行跳转；开启时自动定位当前行；延迟在设置页调整 |
| 歌单管理 | 自建歌单与批量增删；可按名称、时长、添加时间、文件大小排序 |
| 本地导入 | 选择本地文件夹后自动识别音频文件并加入曲库 |
| 统计分析 | 记录每首歌曲的播放次数，支持按热度查看 |
| 数据管理 | 清除全部缓存、删除单曲缓存，或将歌曲从所有列表中移除 |
| 外观 | 浅色与深色主题；背景色斑取自当前封面主色 |

### 界面与布局

- 播放页按视口方向切换形态：竖屏封面在上、控制区在下；横屏封面在左、控制区在右。
- 横屏下开启歌词时，仅以歌词替换封面右侧的控制区，封面保持可见；竖屏下歌词为整屏视图。
- 歌词视图隐藏滚动条，滚动能力保留。
- 歌词视口上下各留出半个视口高的空白，首行与末行均可完整滚到可视区正中；
  当前播放行以粗体显示，行高按粗体状态预留，切换时不产生位移。
- 歌单标题右侧为展开指示箭头，箭头指向与展开状态一致；
  展开状态在页面切换与列表重渲染后保持。
- 管理弹窗内的排序组件与歌曲列表页共用同一份排序状态，任一侧改动后两边同步。
  弹窗打开时背景施加模糊，下拉面板以浮层形式浮在弹窗之上。
- 播放队列支持拖动排序，拖动中的条目以毛玻璃卡片浮于列表之上。
- 播放模式、播放按钮与音量在全部视口下保持单行排列，窄屏时相应收缩。
- 底部导航为悬浮胶囊，模糊背景，不占用布局高度；当前项以淡色胶囊标记容器，
  以主色标记文字与图标。
- 卡片、列表行、对话框、滚动条与状态标签统一使用半透明底色：浅色主题为半透明黑，
  深色主题为半透明白；原本带语义色的控件（按钮、缓存状态）以原背景色作前景色。
- 各页面滚动条均固定在视口最右侧。
- 封面、按钮与面板尺寸随视口流式缩放。

### 可调参数

外观由 `css/variables.css` 中的设计令牌集中管理，修改一处即全站生效。

| 参数 | 默认值 | 位置 | 作用 |
| :--- | :--- | :--- | :--- |
| `--color-keep` | `0.85` | `css/variables.css`（半透明材质区块） | 背景色斑保留封面原色的比例，取值 0 至 1；越大越接近原色，越小越接近主题底色 |
| `--surface-1-alpha` | `0.05` | 同上 | 列表行、卡片、滚动条轨道的底透明度 |
| `--surface-2-alpha` | `0.08` | 同上 | 按钮、对话框、导航胶囊、歌词视图的底透明度 |
| `--surface-3-alpha` | `0.12` | 同上 | 悬停与当前项容器的底透明度 |
| `--page-max-width` | `1000px` | 同上（布局常量区块） | 列表、统计、设置页的内容宽度上限 |

浅色与深色主题的实际色值在 `css/responsive.css` 的主题区块中覆盖，
半透明底分别取黑与白，混合基准 `--ambient-mix` 同理。

### 技术栈

- 核心：HTML5、JavaScript（ES6+），无需构建步骤
- 依赖库：
  - jsmediatags：读取 ID3、MP4 等音频标签，提供封面、歌手与专辑
  - ColorThief：从封面提取关键色，驱动背景色斑
  - Bootstrap Icons：界面图标来源，sprite 内联于 `music.html`
- 存储：IndexedDB，直接使用浏览器原生接口
- 样式：原生 CSS3，Flexbox 布局，不依赖第三方 UI 框架
- 关键 API：Media Session API、File System Access API

### 快速开始

项目由静态文件构成，无需构建。

1. 直接运行：双击 `music.html` 即可打开。读取本地文件夹与使用缓存功能需通过服务器访问。
2. 静态服务器：将整个目录置于 Nginx、Apache 等任意静态服务器的根目录。
3. 与 ESP32 配合：将文件上传至 SPIFFS 或 LittleFS，启动 Web Server 后经局域网访问。

### 后端接口

| 接口 | 方法 | 说明 |
| :--- | :--- | :--- |
| `/music_list` | GET | 返回由歌曲文件名组成的 JSON 数组 |
| `/music_play` | GET | 参数 `file`，返回对应音频流 |

### 已知限制

- 下拉选择框的控件外观由样式表自绘；展开后的选项面板由操作系统绘制，
  样式表无法改写，仅能通过 `color-scheme` 使其配色跟随主题。

### 依赖许可

- [jsmediatags](https://github.com/aadsm/jsmediatags)：MIT
- [ColorThief](https://github.com/lokesh/color-thief)：MIT
- [Bootstrap Icons](https://github.com/twbs/icons)：MIT

本项目基于 MIT 许可发布，详见 [LICENSE.md](LICENSE.md)，第三方声明见 [NOTICE.md](NOTICE.md)。

---

## English

### Overview

A front-end only music player, originally built for local networks and embedded devices such as
the ESP32, and equally suitable for personal sites. It provides word-by-word lyrics, system media
controls, IndexedDB offline caching and local folder import.

### Features

| Module | Description |
| :--- | :--- |
| Playback | Sequential, single-loop and shuffle modes; volume control and progress seeking |
| Shortcuts | Space toggles playback; left and right arrows seek by 5 seconds (ignored while a form control has focus) |
| Lyrics | Word-level highlighting with translations; click a line to seek; opening the view jumps to the current line; the delay is tuned in Settings |
| Playlists | Custom playlists with batch edits; sorted by name, duration, added time or size |
| Local import | Select a folder and the audio files are added to the library |
| Statistics | Per-song play counts, viewable by popularity |
| Data | Clear the whole cache, delete one song's cache, or remove songs from all lists |
| Appearance | Light and dark themes; background colour blobs derive from the current cover |

### Layout

- The player switches by viewport orientation: cover above the controls in portrait, cover beside
  the controls in landscape.
- In landscape, enabling lyrics replaces only the control area to the right of the cover; the cover
  stays visible. In portrait the lyrics take the whole view.
- The lyrics view hides its scrollbar while remaining scrollable.
- The lyrics viewport reserves half a viewport of space above and below the lines, so the first and
  the last line can both be scrolled fully into the centre. The playing line is shown in bold; line
  heights are reserved for the bold state, so switching lines causes no shift.
- Every playlist title carries an expand arrow whose direction follows the expanded state; the
  expanded state survives page switches and list re-renders.
- The sort controls inside the management dialog share one state with the song list page: a change
  on either side updates both. The dialog blurs the page behind it, and its dropdown panels float
  above the dialog.
- The play queue supports drag sorting; the dragged entry floats above the list as a frosted card.
- Play mode, transport buttons and volume stay on a single line at every viewport and shrink as
  space narrows.
- The bottom navigation is a floating pill with a blurred backdrop and takes no layout height; the
  active item is marked with a tinted capsule while its label and icon use the accent colour.
- Cards, list rows, dialogs, scrollbars and status badges share one translucent background: black in
  the light theme, white in the dark theme. Controls that carried a semantic colour (buttons, cache
  badges) use that colour as their foreground.
- Every page keeps its scrollbar pinned to the right edge of the viewport.
- Cover, buttons and panels scale fluidly with the viewport.

### Tunable parameters

Appearance is driven by the design tokens in `css/variables.css`; a single edit applies everywhere.

| Parameter | Default | Location | Effect |
| :--- | :--- | :--- | :--- |
| `--color-keep` | `0.85` | `css/variables.css`, translucent-material block | Share of the cover colour kept in the background blobs, 0 to 1; higher stays closer to the source colour |
| `--surface-1-alpha` | `0.05` | same | Opacity for list rows, cards and scrollbar tracks |
| `--surface-2-alpha` | `0.08` | same | Opacity for buttons, dialogs, the navigation pill and the lyrics view |
| `--surface-3-alpha` | `0.12` | same | Opacity for hover states and the active item |
| `--page-max-width` | `1000px` | same, layout-constants block | Content width cap for the list, statistics and settings pages |

Concrete light and dark values live in the theme blocks of `css/responsive.css`, where the
translucent layer resolves to black and white respectively, as does the blend base `--ambient-mix`.

### Tech stack

- Core: HTML5, JavaScript (ES6+); no build step
- Libraries:
  - jsmediatags: reads ID3 and MP4 tags for cover art, artist and album
  - ColorThief: extracts key colours from the cover for the background blobs
  - Bootstrap Icons: icon source, inlined as a sprite in `music.html`
- Storage: IndexedDB through the browser's native interfaces
- Styling: native CSS3 with Flexbox; no third-party UI framework
- Key APIs: Media Session API, File System Access API

### Quick start

The project is a set of static files and needs no build step.

1. Run directly: open `music.html`. Reading local folders and using the cache require a server.
2. Static server: place the directory under the root of Nginx, Apache or any static file server.
3. With ESP32: upload the files to SPIFFS or LittleFS, start the web server and open its address on
   the local network.

### Backend endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/music_list` | GET | Returns a JSON array of song file names |
| `/music_play` | GET | Takes `file` and returns the audio stream |

### Known limitations

- The closed state of the select control is drawn by the stylesheet. The expanded option panel is
  rendered by the operating system and cannot be restyled; `color-scheme` only lets it follow the
  active theme.

### Licences

- [jsmediatags](https://github.com/aadsm/jsmediatags): MIT
- [ColorThief](https://github.com/lokesh/color-thief): MIT
- [Bootstrap Icons](https://github.com/twbs/icons): MIT

Released under the MIT License; see [LICENSE.md](LICENSE.md). Third-party notices are listed in
[NOTICE.md](NOTICE.md).
