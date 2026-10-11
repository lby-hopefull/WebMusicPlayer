<div align="center">

# 🎵 ESP32 音乐播放器 (Standalone Web Player) / ESP32 Music Player

**[🇨🇳 中文](#-中文版本)** &nbsp;|&nbsp; **[🇺🇸 English](#-english-version)**

*A front-end only Web Music Player designed for local networks and embedded devices.*

</div>

---

<!-- ══════════════════════════════════════════════════════════════ -->
<!--                      中文版本                                 -->
<!-- ══════════════════════════════════════════════════════════════ -->

<h2 align="center">🇨🇳 中文版本</h2>

<p align="center">
  <a href="#-中文版本"><img src="https://img.shields.io/badge/🇨🇳%20中文-当前语言-blue?style=for-the-badge" alt="中文"></a>
  <a href="#-english-version"><img src="https://img.shields.io/badge/🇺🇸%20English-Switch-lightgrey?style=for-the-badge" alt="Switch to English"></a>
</p>

### 📖 项目简介

一个纯前端实现的 Web 音乐播放器，最初面向局域网与 ESP32 等嵌入式设备，同样适用于个人站点部署。播放逻辑与界面全部由浏览器端 JavaScript 驱动，支持逐字歌词高亮、系统媒体控制、IndexedDB 离线缓存与本地文件夹导入。

### ✨ 核心特性

- **离线优先与本地缓存**：歌曲数据写入浏览器 IndexedDB，断网后仍可正常播放。
- **逐字歌词引擎**：支持逐字与逐词滚动高亮，可识别并关联译文行。
- **系统级媒体控制**：基于 Media Session API，锁屏界面、通知栏与桌面控制中心均可播放、暂停、切歌与拖动进度。
- **多端自适应**：响应式布局覆盖手机、平板与桌面端，并可通过文件系统接口直接导入本地文件夹。
- **状态持久化**：播放进度、播放统计与队列顺序自动保存，刷新页面后继续。

### 🛠️ 功能说明

| 功能模块 | 详细说明 |
| :--- | :--- |
| **播放控制** | 顺序、单曲循环、随机三种模式；支持音量调节与进度条拖动。 |
| **键盘快捷键** | 空格键播放或暂停；← / → 快退或快进 5 秒（焦点位于输入框内时不生效）。 |
| **歌词显示** | 点击「显示歌词」按钮切换歌词界面；支持歌词延迟微调；点击歌词行跳转至对应时间点。 |
| **歌单管理** | 自建歌单，批量添加或移除歌曲；曲库与歌单按名称自然序排列，从歌单点歌按该歌单顺序播放。 |
| **本地导入** | 选择本地文件夹后自动识别音频文件并加入曲库。 |
| **统计分析** | 自动记录每首歌的播放次数，支持按热度排序查看。 |
| **数据管理** | 支持清除缓存、删除单曲缓存，或将歌曲从所有列表中移除。 |

### 📦 技术栈

- **核心语言**：HTML5、JavaScript (ES6+)
- **前端库**：
  - `jsmediatags`：读取音频文件的 ID3、MP4 等标签信息（封面、歌手、专辑）。
- **存储方案**：IndexedDB，直接调用浏览器原生接口。
- **样式布局**：原生 CSS3，Flexbox 布局，不依赖第三方 UI 框架。
- **关键 API**：Media Session API（媒体控制）、File System Access API（本地文件夹读取）。

### 🚀 快速开始

项目由一组静态文件构成，无需构建步骤，部署方式如下。

#### 1. 直接运行
- 将 `music.html` 拖入浏览器即可运行。
- *若需读取本地文件夹或使用缓存功能，建议通过本地服务器访问。*

#### 2. 部署到静态服务器（推荐）
将整个目录放置于 Nginx、Apache 或任意静态文件服务器的根目录下。

#### 3. 与 ESP32 / ESP8266 配合使用
- 将本项目的静态文件上传至 ESP32 的 SPIFFS 或 LittleFS 分区。
- 启动 ESP32 的 Web Server 服务。
- 连接 ESP32 的热点或所在局域网，通过浏览器访问其 IP 地址即可控制播放。

### 🎛️ 后端接口说明

前端通过 Fetch API 调用以下接口，获取文件列表与音频流数据。

| 接口地址 | 方法 | 说明 | 预期返回/参数 |
| :--- | :--- | :--- | :--- |
| `/music_list` | GET | 获取服务端歌曲列表 | 返回文件名组成的 JSON 数组 |
| `/music_play` | GET | 获取指定歌曲的音频流 | 参数 `file=文件名`，返回音频文件流 |

### 🤝 贡献指南

欢迎通过 Issue 或 Pull Request 参与改进：
1. Fork 仓库
2. 创建特性分支（`git checkout -b feature/AmazingFeature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到远程分支（`git push origin feature/AmazingFeature`）
5. 发起 Pull Request

### 依赖

- [jsmediatags](https://github.com/aadsm/jsmediatags)  
  用于读取音频文件元数据。  
  **许可证**：MIT  
  **版权**：(c) 2008 Jacob Seidelin, (c) 2009 Opera Software ASA, (c) 2010 Joshua Kifer, (c) 2015 António Afonso

### 📄 许可证

本项目基于 MIT 许可证开源，详见 [LICENSE.md](LICENSE.md)。

<p align="center">
  <a href="#-中文版本"><img src="https://img.shields.io/badge/⬆%20返回顶部-中文-blue?style=flat-square" alt="返回顶部"></a>
</p>

---
---

<!-- ══════════════════════════════════════════════════════════════ -->
<!--                    English Version                            -->
<!-- ══════════════════════════════════════════════════════════════ -->

<h2 align="center">🇺🇸 English Version</h2>

<p align="center">
  <a href="#-english-version"><img src="https://img.shields.io/badge/🇺🇸%20English-Current-blue?style=for-the-badge" alt="English"></a>
  <a href="#-中文版本"><img src="https://img.shields.io/badge/🇨🇳%20中文-Switch-lightgrey?style=for-the-badge" alt="Switch to Chinese"></a>
</p>

### 📖 Introduction

A front-end only Web Music Player, originally built for local networks and embedded devices such as the ESP32, and equally suitable for personal websites. Playback logic and the user interface run entirely in browser-side JavaScript, with word-by-word lyric highlighting, system media controls, IndexedDB offline caching, and local folder import.

### ✨ Core Features

- **Offline-First & Local Caching**: Songs are written to the browser's IndexedDB, so playback continues without a network connection.
- **Word-Level Lyrics Engine**: Supports word-by-word and phrase-by-phrase scrolling highlights, with translation lines recognized and attached to their source lines.
- **System-Level Media Controls**: Built on the Media Session API, so lock screens, notification bars, and desktop control centers can play, pause, skip, and scrub.
- **Cross-Platform Layout**: A responsive design covering phones, tablets, and desktops, with local folder import through the File System Access API.
- **State Persistence**: Playback progress, play statistics, and queue order are saved automatically and restored after a page refresh.

### 🛠️ Feature Highlights

| Module | Description |
| :--- | :--- |
| **Playback Control** | Sequential, single-loop, and shuffle modes; volume adjustment and progress bar scrubbing. |
| **Keyboard Shortcuts** | Space to play or pause; ← / → to seek back or forward 5 seconds (ignored while a form field has focus). |
| **Lyrics Display** | Click the "显示歌词" (Show Lyrics) button to toggle the lyrics view; the lyrics delay can be fine-tuned; click a lyrics line to jump to its timestamp. |
| **Playlist Management** | Create custom playlists and add or remove songs in batches; the library and playlists are sorted by name in natural order, and playing from a playlist follows that playlist's order. |
| **Local Import** | Select a local folder and the audio files in it are recognized and added to the library automatically. |
| **Statistics & Analytics** | Play counts are recorded per song and can be sorted by popularity. |
| **Data Management** | Clear the whole cache, delete one song's cache, or remove songs from all lists. |

### 📦 Tech Stack

- **Core Languages**: HTML5, JavaScript (ES6+)
- **Front-end Libraries**:
  - `jsmediatags`: Reads audio file tags such as ID3 and MP4, including cover art, artist, and album.
- **Storage**: IndexedDB, accessed through the browser's native interfaces.
- **Styling & Layout**: Native CSS3 with Flexbox; no third-party UI framework.
- **Key APIs**: Media Session API (media controls), File System Access API (local folder access).

### 🚀 Quick Start

The project is a set of static files and needs no build step.

#### 1. Run Directly
- Drag `music.html` into a browser to run it.
- *To read local folders or use the caching features, serve the files over a local server.*

#### 2. Deploy on a Static Server (Recommended)
Place the whole directory under the root of Nginx, Apache, or any static file server.

#### 3. Use with ESP32/ESP8266
- Upload the static files to the ESP32's SPIFFS or LittleFS partition.
- Start the Web Server service on the ESP32.
- Connect to the ESP32's hotspot or its LAN and open its IP address in a browser to control playback.

### 🎛️ Backend API Reference

The front end calls the endpoints below through the Fetch API to retrieve the file list and audio data.

| Endpoint | Method | Description | Expected Response / Parameters |
| :--- | :--- | :--- | :--- |
| `/music_list` | GET | Retrieve the server-side song list | A JSON array of filenames |
| `/music_play` | GET | Stream a specific song | Parameter `file=filename`; returns an audio stream |

### 🤝 Contributing

Contributions via Issues or Pull Requests are welcome:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Dependencies

- [jsmediatags](https://github.com/aadsm/jsmediatags)  
  Reads metadata from audio files.  
  **License**: MIT  
  **Copyright**: (c) 2008 Jacob Seidelin, (c) 2009 Opera Software ASA, (c) 2010 Joshua Kifer, (c) 2015 António Afonso

### 📄 License

Released under the MIT License; see [LICENSE.md](LICENSE.md) for details.

<p align="center">
  <a href="#-english-version"><img src="https://img.shields.io/badge/⬆%20Back%20to%20Top-English-blue?style=flat-square" alt="Back to top"></a>
</p>
