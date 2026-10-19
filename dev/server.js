/**
 * server.js —— 开发调试用的静态服务器（不属于扩展本身）
 * 用法：node dev/server.js
 * 然后打开：
 *   http://localhost:4173/dev/result-preview.html
 *   http://localhost:4173/dev/ui-preview.html
 *   http://localhost:4173/dev/collector-test.html
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(root, urlPath === '/' ? 'dev/result-preview.html' : urlPath);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('403 Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(port, () => {
    console.log(`开发预览已启动：http://localhost:${port}/`);
    console.log(`  结果页   http://localhost:${port}/dev/result-preview.html`);
    console.log(`  悬浮按钮 http://localhost:${port}/dev/ui-preview.html`);
    console.log(`  引擎自测 http://localhost:${port}/dev/collector-test.html`);
  });
