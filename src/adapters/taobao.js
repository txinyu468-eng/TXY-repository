/**
 * taobao.js —— 淘宝 / 天猫适配器
 * 图片域名：img.alicdn.com、img*.alicdn.com、gw.alicdn.com
 * 缩略图格式：原图 + `_430x430q90.jpg` / `_q90.jpg_.webp` / `_50x50.jpg` 等后缀
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});

  const FILE_EXT = '(jpg|jpeg|png|webp)';

  EMI.adapters.register({
    id: 'taobao',
    name: '淘宝 / 天猫',
    hosts: [/(^|\.)(taobao|tmall)\.com$/i],
    referer: 'https://item.taobao.com/',

    /** 详情页判定：/item.htm?id=xxx 或 detail.tmall.com/item.htm */
    isDetailPath(location) {
      const url = `${location.pathname}${location.search}`;
      if (/\/item\.htm/i.test(url)) return true;
      if (/\/detail\.htm/i.test(url)) return true;
      // 部分新版详情页走 /detail/ 路由
      return /\/detail\//i.test(location.pathname);
    },

    gallerySelectors: [
      '#J_UlThumb',
      '.tb-thumb',
      '[class*="PicGallery"]',
      '[class*="picGallery"]',
      '[class*="mainPic"]',
      '[class*="MainPic"]',
      '[class*="Thumbnail"]',
      '[class*="thumbnail"]',
      '[class*="pic-list"]',
      '[class*="picList"]',
    ],

    detailSelectors: [
      '#J_DivItemDesc',
      '#description',
      '[class*="desc-root"]',
      '[class*="detailContent"]',
      '[class*="itemDesc"]',
      '[class*="detail-desc"]',
      '[class*="descWrap"]',
    ],

    /** 还原原图：去掉 CDN 尺寸/质量后缀 */
    upgrade(url) {
      let u = url;
      // xxx.jpg_.webp -> xxx.jpg
      u = u.replace(new RegExp(`\\.${FILE_EXT}_\\.webp$`, 'i'), '.$1');

      // 后面的后缀是「拼」在原图后面的，去掉即可还原（原图本身已带扩展名）
      const suffixRules = [
        new RegExp(`_q\\d+\\.${FILE_EXT}$`, 'i'), // xxx.jpg_q90.jpg
        new RegExp(`_\\d+x\\d+[\\da-z]*\\.${FILE_EXT}$`, 'i'), // xxx.jpg_430x430q90.jpg
        new RegExp(`_(sum|summ)\\.${FILE_EXT}$`, 'i'), // xxx.jpg_sum.jpg
      ];

      for (const rule of suffixRules) {
        const match = u.match(rule);
        if (!match) continue;
        const ext = match[match.length - 1];
        const stripped = u.slice(0, match.index);
        u = new RegExp(`\\.${FILE_EXT}$`, 'i').test(stripped) ? stripped : `${stripped}.${ext}`;
        break;
      }

      return u;
    },

    /** 缩略图：给原图拼上 400x400 的后缀，结果页渲染更快 */
    thumb(url) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(url)) return `${url}_400x400.jpg`;
      return url;
    },

    isNoise(url) {
      if (/\/\/assets\.alicdn\.com\//i.test(url)) return true; // 页面静态资源
      if (/alicdn\.com\/tps\//i.test(url)) return true; // 图标雪碧图
      if (/\/\/gtms\d*\.alicdn\.com\//i.test(url)) return true;
      return false;
    },
  });
})();
