/**
 * collector.js —— 提取引擎主流程
 * 流程：滚动触发懒加载 -> 等待解码 -> 收集 img / 背景图 -> 还原原图 -> 去重 / 过滤 -> 分类
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});
  const utils = EMI.utils;

  /** 单次任务最多收集的张数，避免结果页被几千张图拖死 */
  const MAX_IMAGES = 400;

  const collector = {
    /** 当前页面使用的适配器 */
    getAdapter() {
      return EMI.adapters.pick(location.hostname);
    },

    /**
     * 是否是商品详情页。
     * 优先用适配器的 URL 规则；SPA（如拼多多商家版）再用页面结构和大图数量兜底。
     * @param {object} adapter
     */
    isDetailPage(adapter = this.getAdapter()) {
      if (!adapter || adapter.id === 'generic') return false;

      // 明显的列表 / 搜索页直接排除，避免误判
      const target = `${location.pathname}${location.hash}`;
      const looksLikeList = /(search|list|category|cart|order|login)/i.test(target);

      if (!looksLikeList && typeof adapter.isDetailPath === 'function' && adapter.isDetailPath(location)) {
        return true;
      }

      // 只有明确声明需要结构兜底的站点（前端路由 SPA）才继续向下判断，
      // 避免在京东/淘宝的搜索列表页上误显示按钮
      if (!adapter.fallbackToStructure || looksLikeList) return false;

      // 结构兜底：详情页标志性容器
      const markers = ['#J_UlThumb', '#spec-img', '[class*="PicGallery"]', '[class*="MainPic"]', '[class*="mainPic"]'];
      for (const selector of markers) {
        if (document.querySelector(selector)) return true;
      }

      // 最后兜底：页面上有较多大图
      const bigImages = Array.from(document.images).filter((img) => img.naturalWidth >= 400).length;
      return bigImages >= 8;
    },

    /**
     * 执行一次完整的图片提取。
     * @returns {Promise<object>} 任务对象，可直接交给结果页渲染
     */
    async collect() {
      const adapter = this.getAdapter();

      await EMI.dom.autoScroll();
      await EMI.dom.waitForImages();

      const galleryNodes = this.queryNodes(adapter.gallerySelectors);
      const detailNodes = this.queryNodes(adapter.detailSelectors);

      const candidates = [...EMI.dom.collectImgCandidates(), ...EMI.dom.collectBgCandidates()];
      EMI.log('原始候选节点数', candidates.length, '图库容器', galleryNodes.length, '详情容器', detailNodes.length);

      const map = new Map();
      let seq = 0;

      for (const item of candidates) {
        if (map.size >= MAX_IMAGES) break;

        const chosen = this.pickUrl(item.urls, adapter);
        if (!chosen) continue;

        const knownSize = item.w > 0 && item.h > 0;
        if (knownSize && (item.w < EMI.MIN_SIDE || item.h < EMI.MIN_SIDE)) continue;

        const key = utils.dedupeKey(chosen);
        const existing = map.get(key);
        if (existing) {
          // 同一张图出现多次时，保留更大的尺寸信息
          if (knownSize && item.w * item.h > existing.width * existing.height) {
            existing.width = item.w;
            existing.height = item.h;
          }
          continue;
        }

        seq += 1;
        map.set(key, {
          id: `img_${seq}`,
          url: chosen,
          thumb: typeof adapter.thumb === 'function' ? adapter.thumb(chosen) : chosen,
          width: item.w || 0,
          height: item.h || 0,
          order: seq,
          category: 'other',
          inGallery: this.insideAny(item.el, galleryNodes),
          inDetail: this.insideAny(item.el, detailNodes),
        });
      }

      const images = Array.from(map.values()).map((image) => {
        image.category = this.classify(image);
        return image;
      });

      images.sort((a, b) => {
        const weight = { main: 0, detail: 1, other: 2 };
        return weight[a.category] - weight[b.category] || a.order - b.order;
      });

      EMI.log('提取完成', images);

      return {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        siteId: adapter.id,
        siteName: adapter.name,
        referer: adapter.referer || '',
        pageUrl: location.href,
        pageTitle: EMI.dom.getPageTitle() || document.title || '未命名页面',
        createdAt: Date.now(),
        images,
      };
    },

    /**
     * 从同一个节点的多个候选地址里挑第一个可用的（已还原原图）。
     * @param {string[]} urls
     * @param {object} adapter
     * @returns {string} 没有可用地址时返回空字符串
     */
    pickUrl(urls, adapter) {
      for (const rawUrl of urls) {
        const upgraded = typeof adapter.upgrade === 'function' ? adapter.upgrade(rawUrl) : rawUrl;
        if (!upgraded) continue;
        if (!/^https?:\/\//i.test(upgraded)) continue;
        if (/\.svg([?#]|$)/i.test(upgraded)) continue;
        if (utils.isNoiseUrl(upgraded)) continue;
        if (typeof adapter.isNoise === 'function' && adapter.isNoise(upgraded)) continue;
        return upgraded;
      }
      return '';
    },

    /** 图片分类：主图 / 详情图 / 其他 */
    classify(image) {
      const { width, height, inGallery, inDetail } = image;
      const ratio = width && height ? height / width : 0;

      if (inGallery) return 'main';
      if (ratio >= 1.8) return 'detail'; // 明显是长图
      if (ratio > 0 && ratio <= 1.6 && width >= 300) return 'main';
      if (inDetail) return 'detail';
      if (ratio >= 1.4) return 'detail';
      return 'other';
    },

    /** 批量 querySelectorAll，选择器写错时跳过而不是抛错 */
    queryNodes(selectors) {
      const nodes = new Set();
      for (const selector of selectors || []) {
        try {
          document.querySelectorAll(selector).forEach((node) => nodes.add(node));
        } catch (err) {
          EMI.warn('选择器无效：', selector, err);
        }
      }
      return Array.from(nodes);
    },

    /** 元素是否位于任一容器内部 */
    insideAny(el, nodes) {
      if (!el || !nodes || !nodes.length) return false;
      return nodes.some((node) => node === el || node.contains(el));
    },
  };

  EMI.collector = collector;
})();
