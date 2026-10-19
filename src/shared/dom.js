/**
 * dom.js —— 页面 DOM 层面的采集能力：懒加载触发、候选图片收集
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});
  const utils = EMI.utils;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** 懒加载属性名，覆盖各站点常见写法 */
  const LAZY_ATTRS = [
    'data-src',
    'data-original',
    'data-lazy-src',
    'data-lazyload',
    'data-ks-lazyload',
    'data-echo',
    'data-url',
    'data-img',
    'data-image',
    'datasrc',
    'data-actualsrc',
  ];

  /** 背景图扫描时优先检查的元素特征（页面元素太多时用于缩小范围） */
  const BG_HINT_RE = /(bg|img|pic|photo|banner|thumb|cover|swiper|slide|gallery|poster)/i;

  /** 扫描背景图时直接跳过的标签 */
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'PATH']);

  const dom = {
    /**
     * 渐进式滚动整页再回到原位，触发懒加载。
     * 只做页面级滚动，遇到无限滚动会提前收敛，避免卡死。
     */
    async autoScroll(options = {}) {
      const maxRounds = options.maxRounds || EMI.MAX_SCROLL_ROUNDS;
      const stepDelay = options.stepDelay || 130;
      const startY = window.scrollY;
      let lastHeight = 0;
      let stableRounds = 0;

      for (let i = 0; i < maxRounds; i += 1) {
        const height = Math.max(
          document.body ? document.body.scrollHeight : 0,
          document.documentElement ? document.documentElement.scrollHeight : 0
        );
        const step = Math.max(window.innerHeight * 0.85, 400);
        window.scrollBy(0, step);
        await sleep(stepDelay);

        if (height === lastHeight) {
          stableRounds += 1;
          if (stableRounds >= 2) break;
        } else {
          stableRounds = 0;
        }
        lastHeight = height;

        const reachedBottom = window.scrollY + window.innerHeight >= height - 8;
        if (reachedBottom && stableRounds >= 1) break;
      }

      window.scrollTo({ top: startY, behavior: 'auto' });
      await sleep(160);
    },

    /** 等待页面上尚未完成的图片解码结束（或超时） */
    async waitForImages(timeout = EMI.IMAGE_WAIT_MS) {
      const pending = Array.from(document.images).filter((img) => !img.complete || img.naturalWidth === 0);
      if (!pending.length) return;

      await Promise.race([
        Promise.all(
          pending.map(
            (img) =>
              new Promise((resolve) => {
                let settled = false;
                const done = () => {
                  if (settled) return;
                  settled = true;
                  img.removeEventListener('load', done);
                  img.removeEventListener('error', done);
                  resolve();
                };
                img.addEventListener('load', done);
                img.addEventListener('error', done);
                setTimeout(done, timeout);
              })
          )
        ),
        sleep(timeout),
      ]);
    },

    /**
     * 收集所有 <img> 候选。
     * @returns {Array<{urls: string[], w: number, h: number, el: Element}>}
     */
    collectImgCandidates() {
      const result = [];
      const images = Array.from(document.images || []);

      for (const el of images) {
        const urls = [];
        const push = (raw) => {
          const absolute = utils.absoluteUrl(raw);
          if (absolute) urls.push(absolute);
        };

        // srcset 里通常有最大尺寸
        push(utils.parseSrcset(el.getAttribute('srcset')));
        push(utils.parseSrcset(el.getAttribute('data-srcset')));
        push(el.currentSrc);
        push(el.getAttribute('src'));
        for (const attr of LAZY_ATTRS) push(el.getAttribute(attr));

        if (!urls.length) continue;

        // 尺寸判定：优先用真实解码尺寸；图片加载失败时 naturalWidth 会是 1px 占位图，
        // 这时退回布局尺寸，避免把正常的商品图误判成图标。
        const rect = el.getBoundingClientRect();
        const naturalW = el.naturalWidth || 0;
        const naturalH = el.naturalHeight || 0;
        const layoutW = Math.round(rect.width) || 0;
        const layoutH = Math.round(rect.height) || 0;

        const w = naturalW >= 10 ? naturalW : layoutW;
        const h = naturalH >= 10 ? naturalH : layoutH;

        // 1x1 埋点图、隐藏元素：真实尺寸和布局尺寸都很小，直接丢弃
        if (w < 10 || h < 10) continue;

        result.push({ urls, w, h, el });
      }

      return result;
    },

    /**
     * 收集以 CSS 背景图方式渲染的图片（详情长图常用）。
     * 页面元素过多时只扫描「类名/样式看起来像图片容器」的元素，避免强制样式计算过慢。
     * @returns {Array<{urls: string[], w: number, h: number, el: Element}>}
     */
    collectBgCandidates() {
      const result = [];
      const elements = Array.from(document.querySelectorAll('body *'));
      const scanAll = elements.length <= 6000;
      const urlRe = /url\(\s*(['"]?)(.*?)\1\s*\)/g;

      for (const el of elements) {
        if (SKIP_TAGS.has(el.tagName)) continue;
        if (!scanAll && !BG_HINT_RE.test(el.className || '')) continue;

        let background = '';
        if (el.style && el.style.backgroundImage) {
          background = el.style.backgroundImage;
        } else {
          background = getComputedStyle(el).backgroundImage;
        }
        if (!background || background.indexOf('url(') === -1) continue;

        const urls = [];
        let match;
        urlRe.lastIndex = 0;
        while ((match = urlRe.exec(background)) !== null) {
          const absolute = utils.absoluteUrl(match[2]);
          if (absolute) urls.push(absolute);
        }
        if (!urls.length) continue;

        const rect = el.getBoundingClientRect();
        const w = Math.round(rect.width) || 0;
        const h = Math.round(rect.height) || 0;
        if (w && h && (w < EMI.MIN_SIDE || h < 20)) continue;

        result.push({ urls, w, h, el });
      }

      return result;
    },

    /** 页面标题：优先 og:title，其次商品标题 DOM，最后 document.title */
    getPageTitle() {
      const og = document.querySelector('meta[property="og:title"]');
      const ogContent = og && og.getAttribute('content');
      if (ogContent && ogContent.trim().length > 2) return ogContent.trim();

      const selectors = [
        '[class*="ItemTitle"]',
        '[class*="itemTitle"]',
        '[class*="goods-title"]',
        '[class*="goodsTitle"]',
        '[class*="sku-name"]',
        'h1',
      ];
      for (const selector of selectors) {
        const node = document.querySelector(selector);
        const text = node && node.textContent && node.textContent.trim();
        if (text && text.length > 2 && text.length < 200) return text;
      }

      return (document.title || '').replace(/\s*[-|｜].*(淘宝|天猫|京东|拼多多).*$/i, '').trim();
    },
  };

  EMI.dom = dom;
})();
