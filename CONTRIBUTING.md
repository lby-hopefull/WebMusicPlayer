# Contributing

Thanks for taking the time to improve this project. The repository is a set of plain static files with no build step, so any change can be verified straight away in a browser.

## Setup Locally

```bash
git clone https://github.com/lby-hopefull/WebMusicPlayer.git
cd WebMusicPlayer
```

Then either open `music.html` directly in a browser, or serve the directory over HTTP (recommended — caching and local folder import only work properly there):

```bash
python -m http.server 8000
```

## New Contributors

All backgrounds and skill levels are welcome.

- **New to JavaScript?** Open an issue and describe what you are trying to do — we will work through it together.
- **Non-native English speakers?** Documentation is polished during PR review, so do not worry about wording.

## Conventions

- Keep styles in `css/` and logic in `js/`; do not inline either into `music.html`.
- Bind DOM events in `js/bindings.js` only; no inline `on*` attributes in the HTML.
- Render song and playlist names with `textContent`; never concatenate them into `innerHTML` or inline event attributes.
- Write comments in formal written Chinese, with a single space between Chinese and Latin text.

## Submitting Changes

1. Fork the repository and create a feature branch.
2. Before committing, exercise the full flow: playback, track switching, lyric scrolling, caching, and folder import.
3. Use a one-line commit message that states the change, e.g. `歌词：修正逐字行的译文关联`.
4. Open a Pull Request describing the motivation and how you verified the change.

## Legal Agreement

By submitting code, you agree that your contributions are licensed under the project's [MIT License](LICENSE.md). You retain copyright, and grant permission for unlimited use under that license.
