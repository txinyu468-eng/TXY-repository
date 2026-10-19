/**
 * ui.js —— 页面右下角悬浮按钮（Shadow DOM 隔离，避免被宿主页面样式污染）
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});

  const ICON_IMAGE = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3"></rect>
      <circle cx="8.5" cy="8.5" r="1.6" fill="currentColor" stroke="none"></circle>
      <path d="M21 15.5l-4.5-4.5L7 20.5"></path>
    </svg>`;

  const STYLE = `
    :host {
      all: initial;
      position: fixed;
      right: 24px;
      bottom: 28px;
      z-index: 2147483647;
      font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
    }
    .toast {
      pointer-events: none;
      max-width: 260px;
      padding: 9px 14px;
      border-radius: 10px;
      background: rgba(28, 28, 32, 0.92);
      color: #fff;
      font-size: 13px;
      line-height: 1.5;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
      opacity: 0;
      transform: translateY(6px);
      transition: opacity .2s ease, transform .2s ease;
    }
    .toast[data-show="true"] { opacity: 1; transform: translateY(0); }
    .toast[data-type="error"] { background: rgba(196, 40, 40, 0.95); }

    .btn {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 48px;
      padding: 0 20px 0 16px;
      border: 0;
      border-radius: 999px;
      cursor: pointer;
      background: linear-gradient(135deg, #ff7a18 0%, #ff2d55 100%);
      color: #fff;
      font-family: inherit;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: .3px;
      white-space: nowrap;
      box-shadow: 0 10px 24px rgba(255, 70, 40, 0.36), 0 2px 6px rgba(0, 0, 0, 0.14);
      transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
      user-select: none;
    }
    .btn:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(255, 70, 40, 0.44); }
    .btn:active { transform: translateY(0) scale(0.97); }
    .btn:focus-visible { outline: 3px solid rgba(255, 255, 255, 0.85); outline-offset: 2px; }
    .btn[data-state="loading"] { cursor: progress; filter: saturate(0.85); }

    .btn .icon { display: flex; width: 20px; height: 20px; }
    .btn .icon svg { width: 20px; height: 20px; }
    .btn[data-state="loading"] .icon { display: none; }

    .spinner {
      display: none;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: emi-spin .8s linear infinite;
    }
    .btn[data-state="loading"] .spinner { display: block; }

    @keyframes emi-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .btn, .toast { transition: none; }
      .spinner { animation-duration: 1.6s; }
    }
  `;

  const ui = {
    host: null,
    button: null,
    label: null,
    toastEl: null,
    toastTimer: null,

    /**
     * 挂载悬浮按钮（重复调用无副作用）
     * @param {{onClick: Function}} options
     */
    mount(options = {}) {
      if (this.host) return;

      const host = document.createElement('div');
      host.setAttribute('data-emi-root', '');
      host.style.display = 'block';
      document.documentElement.appendChild(host);

      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>${STYLE}</style>
        <div class="wrap">
          <div class="toast" role="status" aria-live="polite"></div>
          <button class="btn" type="button" data-state="idle" title="提取本页全部商品图片">
            <span class="spinner"></span>
            <span class="icon">${ICON_IMAGE}</span>
            <span class="label">获取图片</span>
          </button>
        </div>`;

      this.host = host;
      this.button = shadow.querySelector('.btn');
      this.label = shadow.querySelector('.label');
      this.toastEl = shadow.querySelector('.toast');

      // 阻止事件冒泡到宿主页面，避免触发页面自身的点击/拖拽逻辑
      ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((type) => {
        host.addEventListener(type, (event) => event.stopPropagation());
      });

      this.button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (this.button.dataset.state === 'loading') return;
        if (typeof options.onClick === 'function') options.onClick();
      });
    },

    /** @param {boolean} visible */
    setVisible(visible) {
      if (!this.host) return;
      this.host.style.display = visible ? 'block' : 'none';
    },

    /** @param {boolean} loading */
    setLoading(loading) {
      if (!this.button) return;
      this.button.dataset.state = loading ? 'loading' : 'idle';
      this.label.textContent = loading ? '正在提取…' : '获取图片';
    },

    /**
     * 按钮上方的轻提示
     * @param {string} message
     * @param {{type?: 'info'|'error', duration?: number}} options
     */
    toast(message, options = {}) {
      if (!this.toastEl) return;
      const { type = 'info', duration = 2600 } = options;
      clearTimeout(this.toastTimer);
      this.toastEl.textContent = message;
      this.toastEl.dataset.type = type;
      this.toastEl.dataset.show = 'true';
      this.toastTimer = setTimeout(() => {
        this.toastEl.dataset.show = 'false';
      }, duration);
    },

    isMounted() {
      return Boolean(this.host);
    },
  };

  EMI.ui = ui;
})();
