/**
 * core.js —— 全局命名空间、常量与通用工具
 * 说明：content script 与结果页都以「普通脚本 + 全局命名空间」的方式复用本文件，
 *      因此不依赖任何打包器，直接「加载已解压的扩展程序」即可运行。
 */
(function () {
  'use strict';

  const EMI = (window.EMI = window.EMI || {});

  /* ------------------------------------------------------------------ */
  /* 常量                                                                */
  /* ------------------------------------------------------------------ */

  EMI.DEBUG = false; // 打开后会在控制台输出提取过程日志
  EMI.STORAGE_PREFIX = 'emi:job:';
  EMI.MAX_JOBS = 8; // 最多保留的历史任务数

  EMI.MIN_SIDE = 100; // 忽略短边小于 100px 的图片（图标、占位）
  EMI.MAX_SCROLL_ROUNDS = 14; // 触发懒加载的最大滚动轮次
  EMI.IMAGE_WAIT_MS = 2200; // 等待图片解码的最长时间

  /* ------------------------------------------------------------------ */
  /* 日志                                                                */
  /* ------------------------------------------------------------------ */

  EMI.log = function (...args) {
    if (EMI.DEBUG) console.log('%c[图片提取]', 'color:#ff5000;font-weight:bold', ...args);
  };

  EMI.warn = function (...args) {
    if (EMI.DEBUG) console.warn('[图片提取]', ...args);
  };

  /* ------------------------------------------------------------------ */
  /* 工具函数                                                            */
  /* ------------------------------------------------------------------ */

  /** 明显的噪音图（图标、logo、占位、1px 埋点等） */
  const NOISE_URL_RE =
    /(^|[/_.-])(icons?|logos?|sprite|sprites|avatar|emoji|loading|placeholder|blank|spacer|transparent|1x1|pixel|qrcode|erweima|share|favicon)([/_.-]|$)/i;

  const utils = {
    /**
     * 把各种形态的地址（// 开头、相对路径、带引号、带换行）统一成 https 绝对地址。
     * @param {string} raw
     * @param {string} [base]
     * @returns {string} 无法识别时返回空字符串
     */
    absoluteUrl(raw, base) {
      if (!raw) return '';
      let url = String(raw).trim().replace(/^['"]+|['"]+$/g, '').replace(/\\/g, '/');
      if (!url) return '';
      if (/^(data|blob|javascript|about|chrome-extension):/i.test(url)) return '';
      if (url.startsWith('//')) url = 'https:' + url;
      if (/^http:\/\//i.test(url)) url = 'https://' + url.slice(7);
      if (/^https?:\/\//i.test(url)) return url;
      try {
        return new URL(url, base || location.href).href;
      } catch (err) {
        return '';
      }
    },

    /** 是否是噪音图（只看 URL，不看尺寸） */
    isNoiseUrl(url) {
      return NOISE_URL_RE.test(url);
    },

    /**
     * 去重键：同域名 + 同路径即视为同一张图，忽略 query 与尺寸后缀。
     * @param {string} url
     */
    dedupeKey(url) {
      try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase().replace(/^(img|i|s|g|t)\d+\./i, '$1.');
        return host + u.pathname.toLowerCase();
      } catch (err) {
        return url.toLowerCase();
      }
    },

    /** 去掉文件名里的非法字符，用于生成下载文件名 */
    sanitizeFilename(name, maxLength = 48) {
      const cleaned = String(name || '')
        .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
        .replace(/[. ]+$/, '');
      return cleaned || 'image';
    },

    /** 解析 srcset，返回声明尺寸最大的那个地址 */
    parseSrcset(srcset) {
      if (!srcset) return '';
      const parts = String(srcset)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      let bestUrl = '';
      let bestScore = -1;
      for (const part of parts) {
        const [url, descriptor = ''] = part.split(/\s+/);
        if (!url) continue;
        const match = descriptor.match(/([\d.]+)([wx])/);
        const score = match ? parseFloat(match[1]) : 1;
        if (score > bestScore) {
          bestScore = score;
          bestUrl = url;
        }
      }
      return bestUrl;
    },

    /** 数字补零：3 -> "003" */
    pad(num, width = 2) {
      return String(num).padStart(width, '0');
    },

    /** 简易节流 */
    throttle(fn, wait) {
      let last = 0;
      let timer = null;
      return function (...args) {
        const now = Date.now();
        const remain = wait - (now - last);
        if (remain <= 0) {
          last = now;
          fn.apply(this, args);
        } else if (!timer) {
          timer = setTimeout(() => {
            timer = null;
            last = Date.now();
            fn.apply(this, args);
          }, remain);
        }
      };
    },
  };

  EMI.utils = utils;

  /* ------------------------------------------------------------------ */
  /* 站点注册表（结果页用：拿到该站点应该带的 Referer）                    */
  /* ------------------------------------------------------------------ */

  EMI.SITES = {
    taobao: { id: 'taobao', name: '淘宝 / 天猫', referer: 'https://item.taobao.com/' },
    jd: { id: 'jd', name: '京东', referer: 'https://item.jd.com/' },
    pinduoduo: { id: 'pinduoduo', name: '拼多多商家版', referer: 'https://mms.pinduoduo.com/' },
    generic: { id: 'generic', name: '通用页面', referer: '' },
  };

  /** 结果页用的站点信息兜底 */
  EMI.getSite = function (siteId) {
    return EMI.SITES[siteId] || EMI.SITES.generic;
  };
})();
