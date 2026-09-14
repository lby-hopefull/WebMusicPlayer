<div align="center">

# 🎵 ESP32 音乐播放器 (Standalone Web Player) / ESP32 Music Player

**[🇨🇳 中文](#-中文版本)** &nbsp;|&nbsp; **[🇺🇸 English](#-english-version)**

*A powerful single-file Web Music Player designed for local networks and embedded devices.*

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

一个功能强大的单文件 Web 音乐播放器，专为本地网络或嵌入式设备（如 ESP32）设计，但同样适用于个人网站。它完全由前端技术驱动，支持歌词显示、后台播放、IndexedDB 缓存及本地文件夹导入。

### ✨ 核心特性

- **离线优先 & 智能缓存**：利用浏览器 IndexedDB 技术，支持将歌曲缓存至本地，即使在无网络环境下也能流畅播放。
- **高级歌词引擎**：支持逐字/逐词滚动高亮，兼容翻译行识别，提供沉浸式的视听体验。
- **系统级媒体控制**：集成 Media Session API，支持在锁屏界面、通知栏或桌面控制中心进行播放、暂停、切歌及进度拖拽。
- **全平台兼容**：响应式设计，适配手机、平板及桌面端，并支持通过文件系统 API 直接导入本地文件夹。
- **数据持久化**：自动保存播放进度、播放历史统计及队列状态，刷新页面不丢失数据。

### 🛠️ 功能亮点

| 功能模块 | 详细说明 |
| :--- | :--- |
| **播放控制** | 支持顺序、单曲循环、随机三种模式；支持音量调节与进度条拖拽。 |
| **歌词显示** | 双击封面切换歌词界面；支持歌词延迟微调（±）；点击歌词行可跳转至对应时间点。 |
| **歌单管理** | 支持创建自定义歌单，批量添加/移除歌曲；支持歌单内随机播放。 |
| **本地导入** | 点击按钮即可选择并上传整个本地文件夹，自动识别音频文件并加入曲库。 |
| **统计分析** | 自动记录每首歌的播放次数，支持按热度排序查看。 |
| **数据管理** | 支持手动清除缓存、删除单曲缓存或从所有列表中移除歌曲。 |

### 📦 技术栈

- **核心语言**：HTML5, JavaScript (ES6+)
- **前端库**：
  - `jsmediatags`：用于读取音频文件的 ID3、MP4 等元数据（封面、歌手、专辑）。
- **存储方案**：IndexedDB (通过浏览器原生 API 实现)。
- **样式布局**：原生 CSS3，采用 Flexbox 布局，无第三方 UI 框架依赖。
- **关键 API**：Media Session API (媒体控制), File System Access API (本地文件夹读取)。

### 🚀 快速开始

由于这是一个单 HTML 文件应用，部署非常简单：

#### 1. 直接运行
- 将 `music.html` 文件直接拖入浏览器即可运行。
- *注意：若需访问本地文件夹或使用高级缓存功能，建议在本地服务器环境下运行。*

#### 2. 部署在 Web 服务器 (推荐)
将文件放置于 Nginx, Apache 或任何静态文件服务器根目录下。

#### 3. 与 ESP32/ESP8266 配合使用
该项目文件名包含 `ESP32`，推测其设计初衷是作为物联网音频设备的 Web 界面。
- 将 `music.html` 代码上传至 ESP32 的 SPIFFS 或 LittleFS 文件系统。
- 启动 ESP32 的 Web Server 服务。
- 连接至 ESP32 的 Wi-Fi 热点或局域网，通过浏览器访问 IP 地址即可控制播放。

### 🎛️ 后端接口说明

*(注：根据代码分析，前端通过 Fetch API 调用特定后端接口获取文件列表和流媒体数据)*

| 接口地址 | 方法 | 说明 | 预期返回/参数 |
| :--- | :--- | :--- | :--- |
| `/music_list` | GET | 获取服务器端歌曲列表 | JSON 数组格式的文件名列表 |
| `/music_play` | GET | 播放/下载指定歌曲 | 参数 `file=文件名`，返回音频文件流 |

### 🤝 贡献指南

欢迎提交 Issue 或 Pull Request 来改进此项目：
1. Fork 仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到远程分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 依赖

- [jsmediatags](https://github.com/aadsm/jsmediatags)  
  用于读取音频文件元数据。  
  **许可证**: MIT  
  **版权**: (c) 2008 Jacob Seidelin, (c) 2009 Opera Software ASA, (c) 2010 Joshua Kifer, (c) 2015 António Afonso


### 📄 许可证

该项目为开源项目。

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

A powerful single-file Web Music Player designed for local networks or embedded devices (such as ESP32), but equally suitable for personal websites. It is entirely driven by front-end technologies, supporting lyrics display, background playback, IndexedDB caching, and local folder import.

### ✨ Core Features

- **Offline-First & Smart Caching**: Leverages browser IndexedDB technology to cache songs locally, enabling smooth playback even without a network connection.
- **Advanced Lyrics Engine**: Supports word-by-word scrolling highlights with translation line recognition, providing an immersive audio-visual experience.
- **System-Level Media Controls**: Integrates with the Media Session API, enabling playback, pause, skip, and progress scrubbing from lock screens, notification bars, or desktop control centers.
- **Cross-Platform Compatibility**: Responsive design adapted for phones, tablets, and desktops, with support for importing local folders via the File System Access API.
- **Data Persistence**: Automatically saves playback progress, play history statistics, and queue state — no data is lost on page refresh.

### 🛠️ Feature Highlights

| Module | Description |
| :--- | :--- |
| **Playback Control** | Supports sequential, single-loop, and shuffle modes; volume adjustment and progress bar scrubbing. |
| **Lyrics Display** | Double-click the cover to toggle the lyrics view; supports lyrics delay fine-tuning (±); click a lyrics line to jump to the corresponding timestamp. |
| **Playlist Management** | Create custom playlists, batch add/remove songs; supports shuffle within playlists. |
| **Local Import** | Click a button to select and upload an entire local folder, automatically recognizing audio files and adding them to the library. |
| **Statistics & Analytics** | Automatically records play counts for each song; supports sorting by popularity. |
| **Data Management** | Manually clear cache, delete individual song caches, or remove songs from all lists. |

### 📦 Tech Stack

- **Core Languages**: HTML5, JavaScript (ES6+)
- **Front-end Libraries**:
  - `jsmediatags`: Reads audio file metadata (ID3, MP4, etc.) including cover art, artist, and album.
- **Storage**: IndexedDB (implemented via native browser APIs).
- **Styling & Layout**: Native CSS3 with Flexbox layout, no third-party UI framework dependencies.
- **Key APIs**: Media Session API (media controls), File System Access API (local folder reading).

### 🚀 Quick Start

Since this is a single HTML file application, deployment is straightforward:

#### 1. Run Directly
- Drag the `music.html` file directly into a browser to run.
- *Note: To access local folders or use advanced caching features, it is recommended to run under a local server environment.*

#### 2. Deploy on a Web Server (Recommended)
Place the file in the root directory of Nginx, Apache, or any static file server.

#### 3. Use with ESP32/ESP8266
The project filename includes `ESP32`, suggesting it was originally designed as a web interface for IoT audio devices.
- Upload the `music.html` code to the ESP32's SPIFFS or LittleFS file system.
- Start the ESP32's Web Server service.
- Connect to the ESP32's Wi-Fi hotspot or LAN, and access the IP address via a browser to control playback.

### 🎛️ Backend API Reference

*(Note: Based on code analysis, the front-end calls specific backend endpoints via Fetch API to retrieve file lists and streaming data.)*

| Endpoint | Method | Description | Expected Response / Parameters |
| :--- | :--- | :--- | :--- |
| `/music_list` | GET | Retrieve the server-side song list | JSON array of filenames |
| `/music_play` | GET | Play/download a specific song | Parameter `file=filename`, returns audio file stream |

### 🤝 Contributing

Contributions via Issues or Pull Requests are welcome to improve this project:
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

This project is open-source.

<p align="center">
  <a href="#-english-version"><img src="https://img.shields.io/badge/⬆%20Back%20to%20Top-English-blue?style=flat-square" alt="Back to top"></a>
</p>
