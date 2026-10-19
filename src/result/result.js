/**
 * result.js —— 结果页：渲染图片网格、选择、预览、转 PNG 下载
 */
(function () {
  'use strict';

  const EMI = window.EMI;
  if (!EMI) return;

  const utils = EMI.utils;
  const CATEGORY_LABEL = { main: '主图', detail: '详情图', other: '其他' };
  const CONCURRENCY = 4;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const state = {
    job: null,
    folder: '电商图片',
    images: [],
    visible: [],
    selected: new Set(),
    filter: 'all',
    lbIndex: -1,
    downloading: false,
    cancelRequested: false,
    failed: [],
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    pageTitle: $('pageTitle'),
    pageUrl: $('pageUrl'),
    siteBadge: $('siteBadge'),
    filters: $('filters'),
    grid: $('grid'),
    empty: $('empty'),
    emptyDesc: $('emptyDesc'),
    dock: $('dock'),
    selectedCount: $('selectedCount'),
    totalCount: $('totalCount'),
    btnSelectAll: $('btnSelectAll'),
    btnInvert: $('btnInvert'),
    btnClear: $('btnClear'),
    btnDownload: $('btnDownload'),
    btnRetry: $('btnRetry'),
    lightbox: $('lightbox'),
    lbImage: $('lbImage'),
    lbCaption: $('lbCaption'),
    lbPrev: $('lbPrev'),
    lbNext: $('lbNext'),
    lbClose: $('lbClose'),
    lbDownload: $('lbDownload'),
    progress: $('progress'),
    progressFill: $('progressFill'),
    progressMeta: $('progressMeta'),
    btnCancel: $('btnCancel'),
    toasts: $('toasts'),
  };

  /* ------------------------------------------------------------------ */
  /* 启动                                                                */
  /* ------------------------------------------------------------------ */

  async function init() {
    bindEvents();

    const jobId = new URLSearchParams(location.search).get('job');
    if (!jobId) {
      showEmpty('缺少任务信息', '请回到商品详情页，点击右下角「获取图片」重新提取。');
      return;
    }

    let stored;
    try {
      stored = await chrome.storage.session.get(EMI.STORAGE_PREFIX + jobId);
    } catch (error) {
      showEmpty('无法读取任务数据', error.message || '未知错误');
      return;
    }

    const job = stored[EMI.STORAGE_PREFIX + jobId];
    if (!job || !Array.isArray(job.images)) {
      showEmpty('任务已过期', '浏览器重启或间隔过久后任务会被清理，请重新提取一次。');
      return;
    }

    state.job = job;
    state.images = job.images;
    state.folder = buildFolderName(job);

    renderHeader();
    renderGrid();
    updateCounts();
    applyFilter('all');
    updateDock();

    el.dock.hidden = false;
    el.grid.hidden = false;
    el.filters.hidden = false;

    if (!job.images.length) {
      showEmpty('没有找到可下载的图片', '可能是页面还没加载完，回到详情页滚动一下再重新提取。');
    }
  }

  function renderHeader() {
    const { pageTitle, pageUrl, siteName } = state.job;
    const title = pageTitle || '未命名页面';
    el.pageTitle.textContent = title;
    el.pageTitle.title = title;
    document.title = `${title} · 图片提取`;

    el.siteBadge.textContent = siteName || '未知站点';
    el.siteBadge.hidden = false;

    el.pageUrl.textContent = pageUrl || '';
    el.pageUrl.href = pageUrl || '#';
  }

  function showEmpty(title, desc) {
    el.empty.hidden = false;
    el.empty.querySelector('.empty__title').textContent = title;
    el.emptyDesc.textContent = desc || '';
    el.grid.hidden = true;
    el.dock.hidden = true;
    el.filters.hidden = true;
  }

  /* ------------------------------------------------------------------ */
  /* 渲染                                                                */
  /* ------------------------------------------------------------------ */

  function renderGrid() {
    const fragment = document.createDocumentFragment();

    for (const image of state.images) {
      const card = document.createElement('article');
      card.className = 'card';
      card.dataset.id = image.id;
      card.dataset.category = image.category;
      if (image.width && image.height && image.height / image.width > 1.3) {
        card.classList.add('is-tall');
      }

      const img = document.createElement('img');
      img.className = 'card__img';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.alt = '商品图片';
      img.src = image.thumb || image.url;
      img.addEventListener(
        'error',
        () => {
          if (img.dataset.retried) {
            card.classList.add('is-broken');
            return;
          }
          img.dataset.retried = '1';
          img.src = image.url; // 缩略图挂了就退回原图
        },
        { once: false }
      );

      const check = document.createElement('span');
      check.className = 'card__check';
      check.setAttribute('aria-hidden', 'true');

      const overlay = document.createElement('div');
      overlay.className = 'card__overlay';
      const zoom = document.createElement('button');
      zoom.type = 'button';
      zoom.className = 'card__zoom';
      zoom.textContent = '预览';
      zoom.dataset.action = 'preview';
      overlay.appendChild(zoom);

      const meta = document.createElement('div');
      meta.className = 'card__meta';
      const sizeText = image.width && image.height ? `${image.width} × ${image.height}` : '尺寸未知';
      const sizeNode = document.createElement('span');
      sizeNode.textContent = sizeText;
      const tagNode = document.createElement('span');
      tagNode.className = 'card__tag';
      tagNode.textContent = CATEGORY_LABEL[image.category] || '其他';
      meta.append(sizeNode, tagNode);

      card.append(img, check, overlay, meta);
      fragment.appendChild(card);
    }

    el.grid.innerHTML = '';
    el.grid.appendChild(fragment);
  }

  function updateCounts() {
    const counts = { all: state.images.length, main: 0, detail: 0, other: 0 };
    for (const image of state.images) {
      counts[image.category] = (counts[image.category] || 0) + 1;
    }
    for (const [key, value] of Object.entries(counts)) {
      const node = el.filters.querySelector(`[data-count="${key}"]`);
      if (node) node.textContent = value;
    }
    el.totalCount.textContent = state.images.length;
  }

  function applyFilter(filter) {
    state.filter = filter;
    for (const chip of el.filters.querySelectorAll('.chip')) {
      chip.classList.toggle('is-active', chip.dataset.filter === filter);
    }

    let visibleCount = 0;
    for (const card of el.grid.children) {
      const show = filter === 'all' || card.dataset.category === filter;
      card.hidden = !show;
      if (show) visibleCount += 1;
    }

    state.visible = state.images.filter((image) => filter === 'all' || image.category === filter);
    el.empty.hidden = visibleCount > 0;
    if (!visibleCount) {
      el.empty.querySelector('.empty__title').textContent = '这个分类下没有图片';
      el.emptyDesc.textContent = '试试切换到「全部」。';
      el.grid.hidden = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 选择                                                                */
  /* ------------------------------------------------------------------ */

  function toggleSelect(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);

    const card = el.grid.querySelector(`.card[data-id="${id}"]`);
    if (card) card.classList.toggle('is-selected', state.selected.has(id));
    updateDock();
  }

  function setSelection(ids, selected) {
    for (const id of ids) {
      if (selected) state.selected.add(id);
      else state.selected.delete(id);
      const card = el.grid.querySelector(`.card[data-id="${id}"]`);
      if (card) card.classList.toggle('is-selected', state.selected.has(id));
    }
    updateDock();
  }

  function updateDock() {
    el.selectedCount.textContent = state.selected.size;
    el.btnDownload.disabled = state.downloading || state.selected.size === 0;
    el.btnDownload.textContent = state.selected.size ? `下载 ${state.selected.size} 张 PNG` : '下载 PNG';
  }

  /* ------------------------------------------------------------------ */
  /* 大图预览                                                            */
  /* ------------------------------------------------------------------ */

  function showLightboxAt(index) {
    const list = state.visible;
    if (!list.length) return;
    state.lbIndex = (index + list.length) % list.length;

    const image = list[state.lbIndex];
    el.lightbox.hidden = false;
    el.lbImage.src = image.url;
    const size = image.width && image.height ? `${image.width} × ${image.height}` : '尺寸未知';
    el.lbCaption.textContent = `${state.lbIndex + 1} / ${list.length} · ${size} · ${CATEGORY_LABEL[image.category] || '其他'}`;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    el.lightbox.hidden = true;
    state.lbIndex = -1;
    document.body.style.overflow = '';
    el.lbImage.removeAttribute('src');
  }

  /* ------------------------------------------------------------------ */
  /* 下载                                                                */
  /* ------------------------------------------------------------------ */

  function buildFolderName(job) {
    const site = utils.sanitizeFilename(job.siteName || '图片', 16);
    const title = utils.sanitizeFilename(job.pageTitle || '商品图片', 40);
    return `电商图片/${site}-${title}`;
  }

  /** 简单的并发池：最多 limit 个任务同时执行 */
  async function pool(items, limit, worker) {
    let cursor = 0;
    const size = Math.min(limit, items.length);
    const runners = [];

    for (let i = 0; i < size; i += 1) {
      runners.push(
        (async () => {
          while (cursor < items.length) {
            const current = cursor;
            cursor += 1;
            await worker(items[current], current);
          }
        })()
      );
    }

    await Promise.all(runners);
  }

  async function fetchImageBlob(url, attempt = 0) {
    const options = { credentials: 'omit', cache: 'no-store', mode: 'cors' };
    // 站点 Referer 提示（部分 CDN 会校验来源）；实际请求头由后台的 DNR 规则兜底
    if (state.job && state.job.referer) {
      options.referrer = state.job.referer;
      options.referrerPolicy = 'strict-origin-when-cross-origin';
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (!blob.size) throw new Error('返回了空内容');
      return blob;
    } catch (error) {
      if (attempt < 1) {
        await sleep(240);
        return fetchImageBlob(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * 把任意格式（webp / jpg / gif）的图片真正解码后重绘为 PNG。
   * @param {Blob} blob
   * @returns {Promise<Blob>}
   */
  async function toPngBlob(blob) {
    let bitmap = null;
    let objectUrl = '';

    try {
      bitmap = await createImageBitmap(blob);
    } catch (error) {
      const image = await loadImageElement(blob);
      bitmap = image;
      objectUrl = image.src;
    }

    const width = bitmap.width || bitmap.naturalWidth;
    const height = bitmap.height || bitmap.naturalHeight;
    if (!width || !height) throw new Error('图片尺寸无效');

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);

    const png = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('PNG 编码失败'))), 'image/png');
    });

    if (typeof bitmap.close === 'function') bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    canvas.width = 0;
    canvas.height = 0;
    return png;
  }

  function loadImageElement(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('图片解码失败'));
      };
      image.src = url;
    });
  }

  /** 用 blob: URL 交给下载管理器，等下载结束后再释放内存 */
  function saveBlob(blob, filename) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const cleanup = () => URL.revokeObjectURL(url);

      chrome.downloads.download({ url, filename, saveAs: false, conflictAction: 'uniquify' }, (downloadId) => {
        const lastError = chrome.runtime.lastError;
        if (lastError || typeof downloadId !== 'number') {
          cleanup();
          reject(new Error(lastError ? lastError.message : '下载失败'));
          return;
        }

        resolve(downloadId);

        const listener = (delta) => {
          if (delta.id !== downloadId || !delta.state) return;
          const current = delta.state.current;
          if (current === 'complete' || current === 'interrupted') {
            chrome.downloads.onChanged.removeListener(listener);
            cleanup();
          }
        };
        chrome.downloads.onChanged.addListener(listener);
        setTimeout(() => {
          try {
            chrome.downloads.onChanged.removeListener(listener);
          } catch (error) {
            /* ignore */
          }
          cleanup();
        }, 120000);
      });
    });
  }

  /**
   * @param {Array<{image: object, index: number}>} entries
   */
  async function downloadEntries(entries) {
    if (state.downloading || !entries.length) return;

    state.downloading = true;
    state.cancelRequested = false;
    state.failed = [];
    el.btnRetry.hidden = true;
    updateDock();

    const total = entries.length;
    let done = 0;
    let success = 0;
    const failed = [];

    showProgress(total);

    await pool(entries, CONCURRENCY, async (entry) => {
      if (state.cancelRequested) {
        done += 1;
        updateProgress(done, total, success, failed.length);
        return;
      }

      try {
        const blob = await fetchImageBlob(entry.image.url);
        const png = await toPngBlob(blob);
        const filename = `${state.folder}/${utils.pad(entry.index + 1, 3)}.png`;
        await saveBlob(png, filename);
        success += 1;
      } catch (error) {
        failed.push(entry);
        EMI.warn('下载失败', entry.image.url, error);
      } finally {
        done += 1;
        updateProgress(done, total, success, failed.length);
      }
    });

    const cancelled = state.cancelRequested;
    state.downloading = false;
    state.cancelRequested = false;
    state.failed = failed;

    hideProgress();
    updateDock();

    el.btnRetry.hidden = failed.length === 0;

    if (cancelled) {
      toast(`已取消，已完成 ${success} 张`);
    } else if (failed.length) {
      toast(`成功 ${success} 张，失败 ${failed.length} 张`, 'error');
    } else {
      toast(`已下载 ${success} 张 PNG 到「下载/电商图片」`);
    }
  }

  function showProgress(total) {
    el.progress.hidden = false;
    el.progressFill.style.width = '0%';
    el.progressMeta.textContent = `0 / ${total}`;
    el.btnCancel.disabled = false;
    el.btnCancel.textContent = '取消';
  }

  function updateProgress(done, total, success, failedCount) {
    const percent = total ? Math.round((done / total) * 100) : 0;
    el.progressFill.style.width = `${percent}%`;
    const failedText = failedCount ? `　失败 ${failedCount}` : '';
    el.progressMeta.textContent = `${done} / ${total}　成功 ${success}${failedText}`;
  }

  function hideProgress() {
    el.progress.hidden = true;
  }

  function selectedEntries() {
    return state.images
      .map((image, index) => ({ image, index }))
      .filter((entry) => state.selected.has(entry.image.id));
  }

  /* ------------------------------------------------------------------ */
  /* 提示                                                                */
  /* ------------------------------------------------------------------ */

  function toast(message, type = 'info') {
    const node = document.createElement('div');
    node.className = `toast${type === 'error' ? ' toast--error' : ''}`;
    node.textContent = message;
    el.toasts.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transition = 'opacity .25s ease';
      setTimeout(() => node.remove(), 260);
    }, 3600);
  }

  /* ------------------------------------------------------------------ */
  /* 事件绑定                                                            */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    el.grid.addEventListener('click', (event) => {
      const card = event.target.closest('.card');
      if (!card) return;
      const id = card.dataset.id;

      if (event.target.closest('[data-action="preview"]')) {
        const index = state.visible.findIndex((image) => image.id === id);
        if (index >= 0) showLightboxAt(index);
        return;
      }
      toggleSelect(id);
    });

    el.filters.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (chip) applyFilter(chip.dataset.filter);
    });

    el.btnSelectAll.addEventListener('click', () => {
      setSelection(
        state.visible.map((image) => image.id),
        true
      );
    });

    el.btnInvert.addEventListener('click', () => {
      const ids = state.visible.map((image) => image.id);
      const toSelect = ids.filter((id) => !state.selected.has(id));
      setSelection(ids, false);
      setSelection(toSelect, true);
    });

    el.btnClear.addEventListener('click', () => {
      setSelection(Array.from(state.selected), false);
    });

    el.btnDownload.addEventListener('click', () => downloadEntries(selectedEntries()));

    el.btnRetry.addEventListener('click', () => {
      const entries = state.failed.slice();
      el.btnRetry.hidden = true;
      downloadEntries(entries);
    });

    el.btnCancel.addEventListener('click', () => {
      state.cancelRequested = true;
      el.btnCancel.disabled = true;
      el.btnCancel.textContent = '正在取消…';
    });

    el.lbClose.addEventListener('click', closeLightbox);
    el.lbPrev.addEventListener('click', () => showLightboxAt(state.lbIndex - 1));
    el.lbNext.addEventListener('click', () => showLightboxAt(state.lbIndex + 1));
    el.lightbox.addEventListener('click', (event) => {
      if (event.target === el.lightbox || event.target === el.lightbox.querySelector('.lb__stage')) {
        closeLightbox();
      }
    });

    el.lbDownload.addEventListener('click', () => {
      const image = state.visible[state.lbIndex];
      if (!image) return;
      downloadEntries([{ image, index: state.lbIndex }]);
    });

    document.addEventListener('keydown', (event) => {
      if (!el.lightbox.hidden) {
        if (event.key === 'Escape') closeLightbox();
        else if (event.key === 'ArrowRight') showLightboxAt(state.lbIndex + 1);
        else if (event.key === 'ArrowLeft') showLightboxAt(state.lbIndex - 1);
        return;
      }
      if (event.key === 'Escape' && !el.progress.hidden) {
        el.btnCancel.click();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        el.btnSelectAll.click();
      }
    });
  }

  init();
})();
