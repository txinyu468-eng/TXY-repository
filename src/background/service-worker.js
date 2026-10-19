/**
 * service-worker.js —— 后台：保存任务、打开结果页、为图片请求补上 Referer
 */
'use strict';

const JOB_PREFIX = 'emi:job:';
const JOB_INDEX_KEY = 'emi:jobs';
const MAX_JOBS = 8;

/* ------------------------------------------------------------------ */
/* Referer 规则（只作用于扩展自身发出的请求）                            */
/* ------------------------------------------------------------------ */

const REFERER_RULES = [
  {
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'referer', operation: 'set', value: 'https://item.taobao.com/' }],
    },
    condition: { requestDomains: ['alicdn.com', 'tbcdn.cn'], resourceTypes: ['xmlhttprequest', 'image', 'media', 'other'] },
  },
  {
    id: 2,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'referer', operation: 'set', value: 'https://item.jd.com/' }],
    },
    condition: { requestDomains: ['360buyimg.com', 'jdimg.com'], resourceTypes: ['xmlhttprequest', 'image', 'media', 'other'] },
  },
  {
    id: 3,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'referer', operation: 'set', value: 'https://mms.pinduoduo.com/' }],
    },
    condition: { requestDomains: ['pddpic.com', 'yangkeduo.com'], resourceTypes: ['xmlhttprequest', 'image', 'media', 'other'] },
  },
];

/**
 * 安装动态规则：条件里加上 initiatorDomains 限制为扩展自身，
 * 这样不会影响用户在网页里正常浏览图片。
 */
async function setupRefererRules() {
  if (!chrome.declarativeNetRequest) return;

  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const rules = REFERER_RULES.map((rule) => ({
      ...rule,
      condition: { ...rule.condition, initiatorDomains: [chrome.runtime.id] },
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((rule) => rule.id),
      addRules: rules,
    });
  } catch (error) {
    // 规则失败不影响主流程，只是少数防盗链图片可能下载失败
    console.warn('[图片提取] Referer 规则设置失败：', error);
  }
}

/* ------------------------------------------------------------------ */
/* 任务存取                                                            */
/* ------------------------------------------------------------------ */

async function saveJob(job) {
  const key = JOB_PREFIX + job.id;
  await chrome.storage.session.set({ [key]: job });

  const stored = await chrome.storage.session.get(JOB_INDEX_KEY);
  const index = Array.isArray(stored[JOB_INDEX_KEY]) ? stored[JOB_INDEX_KEY] : [];
  const nextIndex = [job.id, ...index.filter((id) => id !== job.id)];

  const expired = nextIndex.slice(MAX_JOBS);
  if (expired.length) {
    await chrome.storage.session.remove(expired.map((id) => JOB_PREFIX + id));
  }
  await chrome.storage.session.set({ [JOB_INDEX_KEY]: nextIndex.slice(0, MAX_JOBS) });

  return key;
}

/* ------------------------------------------------------------------ */
/* 事件                                                               */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(setupRefererRules);
chrome.runtime.onStartup.addListener(setupRefererRules);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'EMI_OPEN_RESULT') return undefined;

  (async () => {
    try {
      const job = message.job;
      if (!job || !Array.isArray(job.images)) throw new Error('任务数据无效');

      await saveJob(job);
      const tab = await chrome.tabs.create({
        url: chrome.runtime.getURL(`src/result/result.html?job=${encodeURIComponent(job.id)}`),
      });
      sendResponse({ ok: true, tabId: tab.id });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();

  return true; // 异步响应
});

/** 点击工具栏图标 -> 让当前页面的 content script 开始提取 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'EMI_START' });
  } catch (error) {
    console.warn('[图片提取] 当前页面未注入脚本：', error.message);
  }
});
