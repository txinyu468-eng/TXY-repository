/**
 * generic.js —— 适配器注册表 + 通用兜底适配器
 * 每个适配器实现：upgrade（还原原图）、thumb（缩略图）、isNoise、容器选择器。
 * 站点改版时只需要改对应适配器，通用扫描器保证不会整体失效。
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});

  const adapters = {
    list: [],
    /**
     * @param {object} adapter
     */
    register(adapter) {
      adapters.list.push(adapter);
    },
    /**
     * 按域名挑适配器，没有命中则返回通用适配器。
     * 注意：通用适配器也注册在 list 里（hosts 匹配一切），所以要先排除它。
     * @param {string} hostname
     */
    pick(hostname) {
      const host = String(hostname || '').toLowerCase();
      const matched = adapters.list.find(
        (adapter) => adapter.id !== 'generic' && adapter.hosts.some((re) => re.test(host))
      );
      return matched || adapters.list.find((adapter) => adapter.id === 'generic');
    },
  };

  /** 通用适配器：不做任何地址改写，只做基础过滤 */
  adapters.register({
    id: 'generic',
    name: '通用页面',
    hosts: [/.*/],
    referer: '',
    gallerySelectors: [
      '[class*="gallery"]',
      '[class*="Gallery"]',
      '[class*="swiper"]',
      '[class*="carousel"]',
      '[class*="thumbnail"]',
      '[class*="mainPic"]',
      '[class*="main-pic"]',
      '[class*="picList"]',
      '[class*="pic-list"]',
    ],
    detailSelectors: [
      '[class*="detail"]',
      '[class*="Detail"]',
      '[class*="desc"]',
      '[class*="Desc"]',
      '#description',
    ],
    upgrade(url) {
      return url;
    },
    thumb(url) {
      return url;
    },
    isNoise() {
      return false;
    },
  });

  EMI.adapters = adapters;
})();
