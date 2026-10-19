/**
 * main.js —— 官网交互：主题切换、移动端菜单、滚动高亮、渐入动效
 * 零依赖，全部逻辑在脚本加载后执行（脚本位于 body 末尾）。
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const body = document.body;

  const themeToggle = document.getElementById('themeToggle');
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  const header = document.querySelector('.site-header');

  if (!themeToggle || !menuToggle || !nav || !header) return;

  /* ------------------------------- 主题切换 ------------------------------- */

  const storedTheme = (() => {
    try {
      return localStorage.getItem('emi-theme');
    } catch (error) {
      return null;
    }
  })();

  const media = window.matchMedia('(prefers-color-scheme: dark)');

  /** 当前生效的主题（显式设置优先，否则跟随系统） */
  function currentTheme() {
    if (root.dataset.theme === 'dark' || root.dataset.theme === 'light') return root.dataset.theme;
    return media.matches ? 'dark' : 'light';
  }

  function syncThemeLabel(theme) {
    const label = theme === 'dark' ? '切换浅色模式' : '切换深色模式';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.title = label;
    themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    syncThemeLabel(theme);
    if (!persist) return;
    try {
      localStorage.setItem('emi-theme', theme);
    } catch (error) {
      /* 隐私模式下忽略写入失败 */
    }
  }

  if (storedTheme === 'dark' || storedTheme === 'light') {
    applyTheme(storedTheme, false);
  } else {
    syncThemeLabel(currentTheme());
  }

  themeToggle.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  });

  // 用户没有手动选过主题时，跟随系统变化
  media.addEventListener('change', () => {
    if (!root.dataset.theme) syncThemeLabel(currentTheme());
  });

  /* ------------------------------ 移动端菜单 ------------------------------ */

  function closeMenu() {
    body.classList.remove('menu-open');
    menuToggle.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', '打开菜单');
  }

  menuToggle.addEventListener('click', () => {
    const open = !body.classList.contains('menu-open');
    body.classList.toggle('menu-open', open);
    menuToggle.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && body.classList.contains('menu-open')) {
      closeMenu();
      menuToggle.focus();
    }
  });

  // 视口变宽后重置菜单状态，避免桌面端残留遮罩
  const wideQuery = window.matchMedia('(min-width: 901px)');
  wideQuery.addEventListener('change', (event) => {
    if (event.matches) closeMenu();
  });

  /* ------------------------------ 顶栏与高亮 ------------------------------ */

  const navLinks = Array.from(nav.querySelectorAll('a[href^="#"]'));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;

    window.requestAnimationFrame(() => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);

      const offset = window.scrollY + 120;
      let activeId = '';
      for (const section of sections) {
        if (section.offsetTop <= offset) activeId = section.id;
      }

      for (const link of navLinks) {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${activeId}`);
      }

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ------------------------------- 渐入动效 ------------------------------- */

  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!revealItems.length || reduceMotion || !('IntersectionObserver' in window)) {
    // 不支持或用户偏好减少动画：直接显示
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  root.classList.add('reveal-ready');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
})();
