/**
 * pinduoduo.js —— 拼多多商家版适配器
 * 图片域名：img.pddpic.com、t00img.yangkeduo.com、omsproductionimg.yangkeduo.com
 * 缩略图参数：?imageView2/2/w/800/q/70、_800x800.jpg 等
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});

  /** 只在这些 query 前缀下才认为是可以安全去掉的图片处理参数 */
  const PROCESS_QUERY_RE = /^\??(imageView2|imageMogr2|thumbnail|imageView)\//i;

  EMI.adapters.register({
    id: 'pinduoduo',
    name: '拼多多商家版',
    hosts: [/(^|\.)mms\.pinduoduo\.com$/i, /(^|\.)pinduoduo\.com$/i],
    referer: 'https://mms.pinduoduo.com/',
    // 商家后台完全由前端路由渲染，URL 规则不够可靠，允许用页面结构兜底判断
    fallbackToStructure: true,

    /** 商家后台是 SPA，同时看 pathname 与 hash */
    isDetailPath(location) {
      const target = `${location.pathname}${location.hash}`.toLowerCase();
      return /goods|detail|product|edit/.test(target);
    },

    gallerySelectors: [
      '[class*="thumb"]',
      '[class*="Thumb"]',
      '[class*="gallery"]',
      '[class*="Gallery"]',
      '[class*="carousel"]',
      '[class*="swiper"]',
      '[class*="preview"]',
      '[class*="picList"]',
    ],

    detailSelectors: ['[class*="detail"]', '[class*="Detail"]', '[class*="desc"]', '[class*="Desc"]'],

    /** 还原原图：去掉图片处理参数与尺寸后缀 */
    upgrade(url) {
      let u = url;
      const [path, query = ''] = u.split('?');
      u = PROCESS_QUERY_RE.test(query) ? path : u;
      u = u.replace(/\.(jpg|jpeg|png|webp)_\.webp$/i, '.$1');

      const match = u.match(/_\d+x\d+\.(jpg|jpeg|png|webp)$/i);
      if (match) {
        const stripped = u.slice(0, match.index);
        u = /\.(jpg|jpeg|png|webp)$/i.test(stripped) ? stripped : `${stripped}.${match[1]}`;
      }

      return u;
    },

    /** 缩略图：走拼多多的图片处理服务 */
    thumb(url) {
      if (/\?/.test(url)) return url;
      return `${url}?imageView2/2/w/400/q/70`;
    },

    isNoise(url) {
      if (/\/\/static\.pinduoduo\.com\//i.test(url)) return true;
      return false;
    },
  });
})();
