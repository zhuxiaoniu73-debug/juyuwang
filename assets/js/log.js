/* 影视收藏馆 · 运行日志
 * ------------------------------------------------------------------
 * 出问题时能看到「刚才发生了什么」,而不是对着白屏猜。
 *
 * - 自动记录:JS 报错、未处理的 Promise 失败、console.error/warn、每次开页
 * - 手动记录:app.js 和 admin.js 里的关键动作(存盘、导出、批量写入、链接被拒…)
 * - 存在浏览器本地(localStorage),最多留 300 条,不联网、不上传
 * - 在录入台底部可以看、可以一键复制、可以清空
 *
 * 这个文件必须在其它脚本之前加载 —— 否则连 data.js 自己的语法错误都抓不到。
 * 它自身用 try/catch 兜死:日志坏了绝不能把页面带崩。
 */
(function () {
  'use strict';

  var KEY = 'mc-log';
  var MAX = 300;          // 超出后丢最老的
  var buf = [];
  var saveTimer = null;
  var errorCount = 0;

  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) buf = saved.slice(-MAX);
  } catch (e) { buf = []; }

  function now() {
    var d = new Date(), p = function (n, w) { return String(n).padStart(w || 2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
           p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
  }

  function page() {
    try {
      return (document.body && document.body.dataset.page) ||
             location.pathname.split('/').pop() || '?';
    } catch (e) { return '?'; }
  }

  function save() {
    clearTimeout(saveTimer);
    // 攒一下再写,避免连续几十条日志把 localStorage 敲爆
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(buf));
      } catch (e) {
        // 存不下就砍掉一半再试一次,再不行就只留在内存里
        try { buf = buf.slice(-Math.floor(MAX / 2)); localStorage.setItem(KEY, JSON.stringify(buf)); }
        catch (e2) { /* 内存里还有,够用 */ }
      }
    }, 400);
  }

  function trim(v, n) {
    var s;
    try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { s = String(v); }
    if (s == null) s = '';
    return s.length > (n || 500) ? s.slice(0, n || 500) + '…(截断)' : s;
  }

  function add(level, msg, detail) {
    try {
      buf.push({ t: now(), lv: level, p: page(), m: trim(msg, 300),
                 d: detail === undefined ? '' : trim(detail, 700) });
      if (buf.length > MAX) buf = buf.slice(-MAX);
      if (level === 'error') { errorCount++; badge(); }
      save();
    } catch (e) { /* 日志自己不能出事 */ }
  }

  /* ---------------------------------------------------- 出错时的小角标 */
  function badge() {
    try {
      if (document.getElementById('mc-log-badge') || !document.body) return;
      // 单文件版里没有录入台页面,只做提示、不给链接(打包时会置上这个标记)
      var single = !!window.MC_SINGLE;
      var a = document.createElement(single ? 'span' : 'a');
      a.id = 'mc-log-badge';
      if (!single) a.href = 'admin.html#log';
      a.textContent = single ? '出错了(详见控制台)' : '出错了 · 看日志';
      a.title = '页面出了错,已记录到运行日志';
      a.style.cssText = 'position:fixed;left:12px;bottom:calc(76px + env(safe-area-inset-bottom));' +
        'z-index:80;padding:7px 13px;border-radius:999px;background:#e5563f;color:#fff;' +
        'font-size:12.5px;font-weight:500;text-decoration:none;box-shadow:0 8px 22px rgba(0,0,0,.45);' +
        'font-family:system-ui,sans-serif';
      document.body.appendChild(a);
    } catch (e) {}
  }

  /* ---------------------------------------------------- 自动捕获 */
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && e.target.src) {
      add('error', '资源加载失败', e.target.tagName + ' ' + e.target.src);
      return;
    }
    add('error', (e && e.message) || '未知错误',
        ((e && e.filename) || '') + (e && e.lineno ? ':' + e.lineno + ':' + e.colno : ''));
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    add('error', 'Promise 未处理的失败', (r && (r.stack || r.message)) || String(r));
  });

  ['error', 'warn'].forEach(function (kind) {
    var orig = console[kind];
    console[kind] = function () {
      try {
        add(kind === 'error' ? 'error' : 'warn', '[console] ' +
            Array.prototype.map.call(arguments, function (x) { return trim(x, 200); }).join(' '));
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });

  /* ---------------------------------------------------- 对外接口 */
  window.MCLog = {
    info:  function (m, d) { add('info', m, d); },
    warn:  function (m, d) { add('warn', m, d); },
    error: function (m, d) { add('error', m, d); },
    all:   function () { return buf.slice(); },
    errors: function () { return buf.filter(function (x) { return x.lv === 'error'; }); },
    clear: function () {
      buf = [];
      errorCount = 0;
      try { localStorage.removeItem(KEY); } catch (e) {}
      var b = document.getElementById('mc-log-badge');
      if (b) b.remove();
    },
    /** 复制给别人看的纯文本 */
    text: function () {
      var head = [
        '影视收藏馆 · 运行日志',
        '导出时间: ' + now(),
        '浏览器: ' + navigator.userAgent,
        '屏幕: ' + (window.innerWidth + '×' + window.innerHeight),
        '条目数: ' + buf.length + '(其中错误 ' + buf.filter(function (x) { return x.lv === 'error'; }).length + ' 条)',
        '打开方式: ' + location.protocol + '//' + (location.host || '(本地文件)'),
        '─'.repeat(40)
      ].join('\n');
      var body = buf.map(function (x) {
        return '[' + x.t + '] ' + x.lv.toUpperCase().padEnd(5) + ' ' + (x.p || '?') + ' · ' + x.m +
               (x.d ? '\n        ' + x.d : '');
      }).join('\n');
      return head + '\n' + (body || '(还没有记录)') + '\n';
    }
  };

  // 开页就记一条,方便对时间线
  add('info', '打开页面', location.pathname + location.search + location.hash);
})();
