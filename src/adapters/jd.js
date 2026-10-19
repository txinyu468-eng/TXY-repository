/**
 * jd.js —— 京东适配器
 * 图片域名：img*.360buyimg.com
 * 缩略图格式：/n1/jfs/...、/s450x450_jfs/...、/da/jfs/...
 * 原图格式：  /jfs/...
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});

  EMI.adapters.register({
    id: 'jd',
    name: '京东',
    hosts: [/(^|\.)(jd\.com|jd\.hk)$/i],
    referer: 'https://item.jd.com/',

    /** 详情页判定：item.jd.com/100012043978.html */
    isDetailPath(location) {
      return /^\/\d+\.html$/i.test(location.pathname) || /^\/product\/\d+\.html$/i.test(location.pathname);
    },

    gallerySelectors: [
      '#spec-img',
      '#spec-list',
      '.spec-items',
      '[class*="preview"]',
      '[class*="thumb"]',
      '[class*="swiper"]',
      '[class*="main-img"]',
    ],

    detailSelectors: [
      '#detail',
      '#J-detail-content',
      '[class*="detail-content"]',
      '[class*="pd-detail"]',
      '[class*="p-detail"]',
    ],

    /** 还原原图：去掉 !q70.dpg 之类压缩参数，并把尺寸目录换回 /jfs/ */
    upgrade(url) {
      const base = String(url).split('!')[0];
      const match = base.match(/^(https?:\/\/[^/]+)\/(.+)$/);
      if (!match) return base;

      const [, origin, rawPath] = match;
      let rest = rawPath;
      const jfsIndex = rest.indexOf('jfs/');
      if (jfsIndex >= 0) {
        rest = rest.slice(jfsIndex);
      } else {
        rest = rest.replace(/^(n\d+|da|s\d+x\d+_jfs|imgzone)\//i, '');
      }
      return `${origin}/${rest}`;
    },

    /** 缩略图：/jfs/ -> /s400x400_jfs/ */
    thumb(url) {
      return url.replace(/^(https?:\/\/[^/]+)\/jfs\//i, '$1/s400x400_jfs/');
    },

    isNoise(url) {
      if (/\/\/static\.360buyimg\.com\//i.test(url)) return true;
      if (/360buyimg\.com\/da\//i.test(url)) return true; // 广告/装饰图
      return false;
    },
  });
})();
