# 电商图片提取下载器

一个 Chrome 扩展（Manifest V3）：在**淘宝 / 天猫、京东、拼多多商家版**的商品详情页右下角显示「获取图片」按钮，点击后抓取该页面上的全部商品图片，在新标签页里以网格展示，勾选后批量转换为 **PNG** 下载。

## 功能一览

- 右下角悬浮按钮，Shadow DOM 隔离，不会被页面样式污染，也不干扰页面原有按钮
- 三种图源全覆盖：`<img>`（含 srcset、data-src 等懒加载属性）、CSS 背景图、页面内联大图
- 自动还原原图：去掉淘宝 `_430x430q90.jpg`、京东 `/n1/` `/s450x450_jfs/`、拼多多 `?imageView2/...` 等缩略后缀
- 去重与降噪：按「域名 + 路径」合并同一张图的不同尺寸，过滤图标、logo、1×1 埋点、base64 占位图
- 结果页：分类筛选（主图 / 详情图 / 其他）、全选 / 反选 / 清空、hover 预览、大图灯箱、键盘 ←/→/Esc 操作
- 真 PNG：用 `canvas.toBlob('image/png')` 重新编码，不是改后缀
- 批量下载：并发 4，带进度条、可取消、失败项可单独重试
- 文件名自动整理：`下载/电商图片/{站点}-{商品标题}/001.png`
- 深色模式跟随系统

## 安装（本地加载）

1. 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择本项目根目录（包含 `manifest.json` 的那一层）
4. 建议把扩展固定到工具栏，方便使用

无需 `npm install`，项目零依赖、零构建。

## 使用

1. 打开任意商品详情页，例如：
   - 淘宝：`https://item.taobao.com/item.htm?id=...`
   - 天猫：`https://detail.tmall.com/item.htm?id=...`
   - 京东：`https://item.jd.com/100012043978.html`
   - 拼多多商家版：`https://mms.pinduoduo.com/...` 的商品详情 / 编辑页
2. 等页面加载完，右下角出现「获取图片」，点击（或点工具栏里的扩展图标）
3. 扩展会自动滚动页面触发懒加载，然后打开结果页
4. 勾选需要的图片 → 点「下载 N 张 PNG」

## 目录结构

```
manifest.json                    扩展清单（MV3）
icons/                           图标（由 tools/make-icons.js 生成）
src/
  background/service-worker.js   保存任务、打开结果页、为图片请求补 Referer
  shared/core.js                 命名空间、常量、URL / 文件名工具
  shared/dom.js                  滚动触发懒加载、收集 img 与背景图候选
  adapters/
    generic.js                   适配器注册表 + 通用兜底
    taobao.js                    淘宝 / 天猫：原图还原、噪音规则、容器选择器
    jd.js                        京东：/jfs/ 还原、尺寸目录处理
    pinduoduo.js                 拼多多商家版：图片处理参数清理、SPA 路由判断
  content/
    collector.js                 提取主流程（去重、过滤、分类）
    ui.js                        右下角悬浮按钮（Shadow DOM）
    main.js                      content script 入口：路由判断与流程编排
  result/
    result.html / result.css / result.js   结果页
dev/                             开发调试用页面（不参与扩展运行）
tools/                           图标生成、适配器单元测试
```

## 工作原理

1. **提取**：`main.js` 判断当前是不是详情页 → 用户点击 → `collector` 先渐进滚动触发懒加载，等图片解码后再一次性扫 `img` 与元素背景图。
2. **还原与去重**：每个候选地址先经过站点适配器 `upgrade()` 还原成原图，再用「域名 + 路径」生成去重键，同图不同尺寸只保留一份。
3. **传递**：结果通过 `chrome.runtime.sendMessage` 交给 service worker，写入 `chrome.storage.session`，再打开 `result.html?job=xxx`（避免 URL 过长，也避开消息体大小限制）。
4. **转 PNG**：在扩展页面里 `fetch` 图片（`host_permissions` 让跨域请求免 CORS）→ `createImageBitmap` 解码 → 画到 `canvas` → `canvas.toBlob('image/png')` → `blob:` URL 交给 `chrome.downloads.download`。
5. **防盗链**：安装时写入 `declarativeNetRequest` 动态规则，把扩展自身发出的图片请求 Referer 补成对应站点；条件里用 `initiatorDomains` 限定只影响扩展自己，不干扰正常浏览。

## 开发调试

```bash
node dev/server.js                                   # 启动本地预览
node tools/test-adapters.js                          # 适配器逻辑单测（21 项）
node tools/make-icons.js                             # 重新生成图标
```

- 结果页界面：<http://localhost:4173/dev/result-preview.html>（假数据，可调样式）
- 悬浮按钮：<http://localhost:4173/dev/ui-preview.html>（可看 loading / toast 状态）
- 提取引擎：<http://localhost:4173/dev/collector-test.html>（11 项断言，页面标题显示通过数）

改完 `src/` 里的文件后，到 `chrome://extensions` 点扩展卡片上的刷新按钮，再刷新商品页即可。

## 已知限制

- 只抓当前文档：详情图渲染在跨域 iframe 里时抓不到（`all_frames: false`）
- 页面改版会让选择器失效：此时「分类」可能不准，但通用扫描仍能抓到图，改 `src/adapters/*.js` 里的 `gallerySelectors` 即可
- 超大图（长边超过浏览器 canvas 上限）会转换失败，会计入「失败」并可重试
- 部分 CDN 对 Referer / 登录态校验很严，少数图片可能下载失败，失败列表支持单独重试
- 拼多多商家版是前端路由，页面切换后按钮显隐会延迟约 1 秒
- 扩展不收集、不上传任何数据，全部处理在本地完成

## 上架前注意

如果想要发布到 Chrome Web Store：`permissions` 里的 `declarativeNetRequestWithHostAccess` 与站点权限都属于敏感权限，需要在隐私说明里解释用途（仅用于下载用户自己正在浏览的商品图片）。
