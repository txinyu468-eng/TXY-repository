/**
 * test-adapters.js —— 适配器逻辑自测（纯 Node，不依赖浏览器）
 * 运行：node tools/test-adapters.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = { window: {}, console, URL };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const file of [
  'src/shared/core.js',
  'src/adapters/generic.js',
  'src/adapters/taobao.js',
  'src/adapters/jd.js',
  'src/adapters/pinduoduo.js',
]) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

const EMI = sandbox.window.EMI;
let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}\n       actual:   ${actual}\n       expected: ${expected}`);
  }
}

function adapterFor(host) {
  return EMI.adapters.pick(host);
}

console.log('\n[适配器选择]');
check('item.taobao.com', adapterFor('item.taobao.com').id, 'taobao');
check('detail.tmall.com', adapterFor('detail.tmall.com').id, 'taobao');
check('item.jd.com', adapterFor('item.jd.com').id, 'jd');
check('item.m.jd.com', adapterFor('item.m.jd.com').id, 'jd');
check('mms.pinduoduo.com', adapterFor('mms.pinduoduo.com').id, 'pinduoduo');
check('example.com', adapterFor('example.com').id, 'generic');

console.log('\n[淘宝：还原原图]');
const taobao = adapterFor('item.taobao.com');
check(
  '去掉 _430x430q90 后缀',
  taobao.upgrade('https://img.alicdn.com/imgextra/i1/O1CN01abc_!!0-item_pic.jpg_430x430q90.jpg'),
  'https://img.alicdn.com/imgextra/i1/O1CN01abc_!!0-item_pic.jpg'
);
check(
  '去掉 _50x50 后缀',
  taobao.upgrade('https://img.alicdn.com/imgextra/i2/abc/O1CN01x.jpg_50x50.jpg'),
  'https://img.alicdn.com/imgextra/i2/abc/O1CN01x.jpg'
);
check(
  '去掉 _.webp 后缀',
  taobao.upgrade('https://img.alicdn.com/imgextra/i3/abc/O1CN01y.jpg_.webp'),
  'https://img.alicdn.com/imgextra/i3/abc/O1CN01y.jpg'
);
check(
  '去掉 xz 后缀',
  taobao.upgrade('https://img.alicdn.com/imgextra/i4/abc/O1CN01z.png_800x800xz.png'),
  'https://img.alicdn.com/imgextra/i4/abc/O1CN01z.png'
);
check(
  '缩略图拼接',
  taobao.thumb('https://img.alicdn.com/imgextra/i4/abc/O1CN01z.png'),
  'https://img.alicdn.com/imgextra/i4/abc/O1CN01z.png_400x400.jpg'
);

console.log('\n[京东：还原原图]');
const jd = adapterFor('item.jd.com');
check(
  'n1 + 尺寸目录',
  jd.upgrade('https://img14.360buyimg.com/n1/s450x450_jfs/t1/123/45/6789/123456/abcdef.jpg'),
  'https://img14.360buyimg.com/jfs/t1/123/45/6789/123456/abcdef.jpg'
);
check(
  '去掉 !q70.dpg',
  jd.upgrade('https://img14.360buyimg.com/n0/jfs/t1/123/45/6789/123456/abcdef.jpg!q70.dpg'),
  'https://img14.360buyimg.com/jfs/t1/123/45/6789/123456/abcdef.jpg'
);
check(
  '缩略图目录',
  jd.thumb('https://img14.360buyimg.com/jfs/t1/123/abcdef.jpg'),
  'https://img14.360buyimg.com/s400x400_jfs/t1/123/abcdef.jpg'
);

console.log('\n[拼多多：还原原图]');
const pdd = adapterFor('mms.pinduoduo.com');
check(
  '去掉 imageView2 参数',
  pdd.upgrade('https://img.pddpic.com/gaudit-image/2023/abc.jpg?imageView2/2/w/800/q/70'),
  'https://img.pddpic.com/gaudit-image/2023/abc.jpg'
);
check(
  '去掉尺寸后缀',
  pdd.upgrade('https://img.pddpic.com/gaudit-image/2023/abc.jpg_800x800.jpg'),
  'https://img.pddpic.com/gaudit-image/2023/abc.jpg'
);
check(
  '保留签名参数',
  pdd.upgrade('https://img.pddpic.com/a/b.jpg?x-oss-signature=abc'),
  'https://img.pddpic.com/a/b.jpg?x-oss-signature=abc'
);

console.log('\n[去重键]');
check(
  '不同尺寸视为同一张',
  EMI.utils.dedupeKey(taobao.upgrade('https://img.alicdn.com/a/b.jpg_430x430.jpg')),
  EMI.utils.dedupeKey('https://img.alicdn.com/a/b.jpg')
);
check(
  '不同主机前缀视为同一张',
  EMI.utils.dedupeKey('https://img12.alicdn.com/a/b.jpg'),
  EMI.utils.dedupeKey('https://img01.alicdn.com/a/b.jpg')
);

console.log('\n[噪音识别]');
check('logo 图', EMI.utils.isNoiseUrl('https://img.alicdn.com/logo/main.png'), true);
check('正常商品图', EMI.utils.isNoiseUrl('https://img.alicdn.com/imgextra/i1/abc.jpg'), false);

console.log(`\n结果：${passed} 通过 / ${failed} 失败\n`);
process.exit(failed ? 1 : 0);
