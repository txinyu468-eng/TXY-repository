/**
 * main.js —— content script 入口：判断站点、挂载按钮、驱动提取流程
 */
(function () {
  'use strict';

  const EMI = window.EMI;
  if (!EMI || window.__EMI_BOOTED__) return;
  window.__EMI_BOOTED__ = true;

  const adapter = EMI.collector.getAdapter();
  if (!adapter || adapter.id === 'generic') return;

  let running = false;

  /** 根据当前路由决定按钮是否显示（SPA 站点路由切换时复用） */
  function syncVisibility() {
    const shouldShow = EMI.collector.isDetailPage(adapter);

    if (shouldShow && !EMI.ui.isMounted()) {
      EMI.ui.mount({ onClick: run });
    }
    if (EMI.ui.isMounted()) {
      EMI.ui.setVisible(shouldShow);
    }
    return shouldShow;
  }

  /** 执行一次提取并打开结果页 */
  async function run() {
    if (running) return;
    running = true;
    EMI.ui.setLoading(true);

    try {
      const job = await EMI.collector.collect();

      if (!job.images.length) {
        EMI.ui.toast('未在本页找到可下载的图片，试试先滚动页面再点击');
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'EMI_OPEN_RESULT', job });
      if (!response || !response.ok) {
        throw new Error((response && response.error) || '无法打开结果页');
      }
      EMI.ui.toast(`已提取 ${job.images.length} 张图片`);
    } catch (err) {
      const message =
        err && /context invalidated/i.test(String(err.message))
          ? '扩展已更新，请刷新页面后重试'
          : (err && err.message) || '提取失败，请重试';
      EMI.ui.toast(message, { type: 'error' });
      EMI.warn('提取失败', err);
    } finally {
      running = false;
      EMI.ui.setLoading(false);
    }
  }

  // 点击工具栏图标 = 点击悬浮按钮
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'EMI_START') {
      run();
      sendResponse({ ok: true });
    }
  });

  // 首次判断 + 等待详情页异步渲染（最多重试 ~20 秒）
  let attempts = 0;
  const bootTimer = setInterval(() => {
    attempts += 1;
    const shown = syncVisibility();
    if (shown && attempts > 2) clearInterval(bootTimer);
    if (attempts >= 12) clearInterval(bootTimer);
  }, 1800);
  syncVisibility();

  // SPA 路由变化监听（拼多多商家版是前端路由）
  let lastHref = location.href;
  setInterval(() => {
    if (location.href === lastHref) return;
    lastHref = location.href;
    syncVisibility();
  }, 1000);
})();
