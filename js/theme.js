/**
 * 深色模式管理
 */

const ThemeManager = (() => {
  const STORAGE_KEY = 'theme-mode';
  const THEMES = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
  };

  let currentTheme = THEMES.SYSTEM;

  /**
   * 初始化主题
   */
  function init() {
    // 从本地存储读取用户偏好
    const savedTheme = localStorage.getItem(STORAGE_KEY) || THEMES.SYSTEM;
    currentTheme = savedTheme;

    // 应用主题
    applyTheme(savedTheme);

    // 绑定主题按钮事件
    bindThemeButtons();

    // 监听系统主题变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (currentTheme === THEMES.SYSTEM) {
          applyTheme(THEMES.SYSTEM);
        }
      });
    }
  }

  /**
   * 绑定主题按钮
   */
  function bindThemeButtons() {
    const themeButtons = document.querySelectorAll('.theme-option');

    themeButtons.forEach(button => {
      button.addEventListener('click', function() {
        const theme = this.getAttribute('data-theme');
        setTheme(theme);
      });
    });
  }

  /**
   * 设置主题
   * @param {string} theme - 'light', 'dark', 或 'system'
   */
  function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    updateActiveButton(theme);
  }

  /**
   * 应用主题
   * @param {string} theme - 'light', 'dark', 或 'system'
   */
  function applyTheme(theme) {
    let effectiveTheme = theme;

    if (theme === THEMES.SYSTEM) {
      // 检查系统偏好
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? THEMES.DARK : THEMES.LIGHT;
    }

    // 设置 HTML 属性
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // 更新 meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      if (effectiveTheme === THEMES.DARK) {
        metaThemeColor.setAttribute('content', '#1e1e1e');
      } else {
        metaThemeColor.setAttribute('content', '#2196F3');
      }
    }

    // 更新按钮激活状态
    updateActiveButton(theme);
  }

  /**
   * 更新激活的主题按钮
   * @param {string} theme - 当前主题
   */
  function updateActiveButton(theme) {
    const themeButtons = document.querySelectorAll('.theme-option');
    themeButtons.forEach(button => {
      if (button.getAttribute('data-theme') === theme) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  return {
    init,
    setTheme,
    applyTheme
  };
})();

// 页面加载时初始化主题
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
  });
} else {
  ThemeManager.init();
}
