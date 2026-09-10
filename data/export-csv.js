/* 把 assets/js/data.js 导出成 Webflow CMS 可导入的 CSV。
 * 用法(在项目根目录):node data/export-csv.js
 * 列名与「影视库」集合的字段一一对应,见 data/webflow-cms.md。 */
const fs = require('fs');
const path = require('path');

global.window = {};
require(path.join(__dirname, '..', 'assets', 'js', 'data.js'));

const COLS = ['Name', 'Slug', 'Image', 'Category', 'Genre', 'Year',
              'Region', 'Actors', 'Description', 'Resource URL', 'Added', 'Featured'];

const cell = v => {
  v = v == null ? '' : String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

const rows = window.MEDIA_DB.map(i => [
  i.title,
  i.id,
  i.poster || '',
  i.category,
  (i.genres || []).join('; '),
  i.year,
  i.region,
  (i.actors || []).join('; '),
  i.description,
  i.resource || '',
  i.added,
  i.hot ? 'true' : 'false'
].map(cell).join(','));

const out = path.join(__dirname, '影视库.csv');
// BOM 开头,Excel / Numbers 打开不会乱码
fs.writeFileSync(out, '﻿' + COLS.join(',') + '\n' + rows.join('\n') + '\n');
console.log('已写入 ' + out + ',共 ' + rows.length + ' 条');
