/* 影视收藏馆 · 站内小模块(链接 / 日志)
 * ------------------------------------------------------------------
 * 右下角两个按钮,点开即用,不用跑去录入台:
 *
 *   链接  —— 从网盘复制的一整段直接粘进来,自动认出地址和提取码。
 *            在详情页会默认填给当前这部片子;别的页面按「片名 | 链接」批量填。
 *            填完先存在浏览器本地,站上立刻生效;去录入台点「并入草稿」再导出
 *            才算真正写进 data.js。
 *
 *   日志  —— 运行日志就地看,不用切页面。出错时按钮上会挂红点。
 */
(function () {
  'use strict';

  var KEY = 'mc-links';
  var LOG = window.MCLog || { info: function () {}, warn: function () {}, error: function () {} };

  /* ---------------------------------------------------- 本地链接暂存 */
  function readAll() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return (v && typeof v === 'object') ? v : {};
    } catch (e) { return {}; }
  }
  function writeAll(m) {
    try { localStorage.setItem(KEY, JSON.stringify(m)); return true; }
    catch (e) { LOG.error('本地链接存不下', String(e && e.message)); return false; }
  }

  window.MCLinks = {
    all: readAll,
    get: function (id) { return readAll()[id] || null; },
    count: function () { return Object.keys(readAll()).length; },
    set: function (id, resource, note) {
      var m = readAll();
      m[id] = { resource: resource, resourceNote: note || '' };
      var ok = writeAll(m);
      if (ok) LOG.info('存了一条本地链接', id + ' → ' + resource + (note ? '(' + note + ')' : ''));
      return ok;
    },
    remove: function (id) {
      var m = readAll();
      if (!(id in m)) return false;
      delete m[id]; writeAll(m);
      LOG.info('删了一条本地链接', id);
      return true;
    },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} LOG.info('清空本地链接'); },
    /** 导出成录入台批量粘贴认得的格式 */
    asText: function (titleOf) {
      var m = readAll();
      return Object.keys(m).map(function (id) {
        var v = m[id];
        return (titleOf ? titleOf(id) : id) + ' | ' + v.resource + (v.resourceNote ? ' | ' + v.resourceNote : '');
      }).join('\n');
    }
  };

  /* ---------------------------------------------------- 解析网盘分享 */
  /* 从网盘点「复制链接」得到的通常是一整段:
     开头一行说明,中间一个网址,后面跟着提取码。
     这里把地址和提取码都抠出来,不用手动拆。 */
  function parseShare(text) {
    text = String(text || '').trim();
    if (!text) return null;

    var url = '';
    var m = text.match(/(https?:\/\/[^\s"'<>，,、]+)/i);
    if (m) url = m[1];
    else {
      // 没带协议的裸地址:pan.quark.cn/s/xxxx
      var m2 = text.match(/((?:pan|yun|drive|cloud)\.[\w.-]+\.[a-z]{2,}\/[^\s"'<>，,、]+)/i);
      if (m2) url = 'https://' + m2[1];
    }
    if (!url) return null;
    url = url.replace(/[。.,,;;)）】\]]+$/, '');

    // 提取码:?pwd=xxxx 优先,其次「提取码/密码/访问码/pwd: xxxx」
    var code = '';
    var inUrl = url.match(/[?&](?:pwd|password)=([A-Za-z0-9]{3,8})/i);
    if (inUrl) code = inUrl[1];
    if (!code) {
      var c = text.match(/(?:提取码|提取碼|密码|密碼|访问码|校验码|pwd|code)\s*[::]?\s*([A-Za-z0-9]{3,8})/i);
      if (c) code = c[1];
    }

    var host = '';
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch (e) {}
    return { url: url, code: code, host: host };
  }
  window.MCLinks.parse = parseShare;

  /* ------------------------------------------------------------ 界面 */
  var built = false, current = null;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function build() {
    if (built || !document.body) return;
    // 录入台自己有面板,只借用上面的数据接口,不摆悬浮按钮
    if (document.body.dataset.page === 'admin') return;
    built = true;

    var launcher = el('div', 'mc-launcher');
    launcher.innerHTML =
      '<button type="button" class="mc-fab" data-panel="links" title="填网盘链接">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
        '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/>' +
        '<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>' +
        '<span>链接</span></button>' +
      '<button type="button" class="mc-fab" data-panel="log" title="运行日志">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">' +
        '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>' +
        '<span>日志</span><i class="mc-dot" hidden></i></button>';
    document.body.appendChild(launcher);

    var drawer = el('div', 'mc-drawer');
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="mc-drawer-mask"></div>' +
      '<div class="mc-drawer-body" role="dialog" aria-modal="true">' +
        '<div class="mc-drawer-head"><h2 id="mc-drawer-title"></h2>' +
          '<button type="button" class="mc-drawer-close" aria-label="关闭">×</button></div>' +
        '<div class="mc-drawer-content" id="mc-drawer-content"></div>' +
      '</div>';
    document.body.appendChild(drawer);

    launcher.addEventListener('click', function (e) {
      var b = e.target.closest('.mc-fab');
      if (b) open(b.dataset.panel);
    });
    drawer.querySelector('.mc-drawer-mask').addEventListener('click', close);
    drawer.querySelector('.mc-drawer-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) close();
    });

    refreshDot();
    setInterval(refreshDot, 5000);
  }

  function refreshDot() {
    try {
      var dot = document.querySelector('.mc-dot');
      if (!dot || !window.MCLog) return;
      dot.hidden = window.MCLog.errors().length === 0;
    } catch (e) {}
  }

  function close() {
    var d = document.querySelector('.mc-drawer');
    if (d) d.hidden = true;
    document.body.style.overflow = '';
  }

  function open(name) {
    var d = document.querySelector('.mc-drawer');
    if (!d) return;
    d.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('mc-drawer-title').textContent = name === 'log' ? '运行日志' : '填网盘链接';
    (name === 'log' ? renderLogPanel : renderLinkPanel)(document.getElementById('mc-drawer-content'));
  }

  /* ---------------------------------------------------- 链接面板 */
  function renderLinkPanel(host) {
    current = window.MC_CURRENT || null;
    var pending = window.MCLinks.count();

    host.innerHTML =
      (current
        ? '<div class="mc-field">' +
            '<label for="mc-one">粘贴 ——「' + esc(current.title) + '」的网盘分享</label>' +
            '<textarea id="mc-one" rows="3" placeholder="从网盘点「复制链接」得到的那一整段,连提取码一起粘进来就行"></textarea>' +
            '<div class="mc-parsed" id="mc-parsed"></div>' +
            '<div class="mc-row"><button type="button" class="btn btn-primary" id="mc-save-one">存给这部片</button></div>' +
          '</div><div class="mc-sep">或者批量填</div>'
        : '') +
      '<div class="mc-field">' +
        '<label for="mc-bulk">一行一部:<code>片名 | 链接 | 提取码</code></label>' +
        '<textarea id="mc-bulk" rows="5" placeholder="片名 | 网盘地址 | 提取码&#10;片名 | 网盘地址"></textarea>' +
        '<div class="mc-row"><button type="button" class="btn btn-primary" id="mc-save-bulk">批量存</button></div>' +
      '</div>' +
      '<div class="mc-pending" id="mc-pending"></div>';

    var one = document.getElementById('mc-one');
    if (one) {
      var show = function () {
        var r = parseShare(one.value);
        var box = document.getElementById('mc-parsed');
        box.innerHTML = r
          ? '<span class="mc-ok">认出来了</span> <code>' + esc(r.url) + '</code>' +
            (r.code ? ' · 提取码 <b>' + esc(r.code) + '</b>' : ' · 没找到提取码') +
            (r.host ? ' · ' + esc(r.host) : '')
          : (one.value.trim() ? '<span class="mc-bad">没认出链接</span> —— 里面得有个网址' : '');
      };
      one.addEventListener('input', show);
      one.focus();
      document.getElementById('mc-save-one').addEventListener('click', function () {
        var r = parseShare(one.value);
        if (!r) { document.getElementById('mc-parsed').innerHTML = '<span class="mc-bad">没认出链接</span>'; return; }
        // 光存 "q5xx" 的话,详情页上就是个没头没尾的四个字符,看不出是什么
        var note = r.code ? '提取码 ' + r.code : '';
        window.MCLinks.set(current.id, r.url, note);
        if (window.MC_APPLY_LINK) window.MC_APPLY_LINK(current.id, r.url, note);
        one.value = '';
        show();
        renderPending();
        flash('已存给「' + current.title + '」');
      });
    }

    document.getElementById('mc-save-bulk').addEventListener('click', function () {
      var ta = document.getElementById('mc-bulk');
      var lines = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var okN = 0, bad = [];
      lines.forEach(function (line) {
        var cols = line.split(/\s*[|｜\t]\s*/);
        var title = cols[0];
        var id = idOfTitle(title);
        if (!id) { bad.push(line + '  ← 库里没有这部'); return; }
        var r = parseShare(cols.slice(1).join(' ')) || parseShare(line);
        if (!r) { bad.push(line + '  ← 没认出链接'); return; }
        var raw = cols[2] && !/^https?:/i.test(cols[2]) ? cols[2] : r.code;
        var note = raw ? (/提取码|密码|访问码/.test(raw) ? raw : '提取码 ' + raw) : '';
        window.MCLinks.set(id, r.url, note);
        if (window.MC_APPLY_LINK) window.MC_APPLY_LINK(id, r.url, note);
        okN++;
      });
      ta.value = bad.join('\n');
      renderPending();
      flash(okN ? '存了 ' + okN + ' 条' + (bad.length ? ',' + bad.length + ' 行没处理' : '') : '一条都没认出来');
      if (bad.length) LOG.warn('批量填链接有没处理的行', bad.slice(0, 3).join(' / '));
    });

    renderPending();

    function renderPending() {
      var box = document.getElementById('mc-pending');
      var m = window.MCLinks.all();
      var ids = Object.keys(m);
      if (!ids.length) { box.innerHTML = '<p class="mc-hint">还没有本地填的链接。</p>'; return; }
      box.innerHTML =
        '<div class="mc-sep">本地已填 ' + ids.length + ' 条(还没写进 data.js)</div>' +
        '<ul class="mc-list">' + ids.map(function (id) {
          return '<li><span class="mc-li-name">' + esc(titleOfId(id)) + '</span>' +
            '<span class="mc-li-url">' + esc(m[id].resource) + '</span>' +
            (m[id].resourceNote ? '<span class="mc-li-code">' + esc(m[id].resourceNote) + '</span>' : '') +
            '<button type="button" class="mc-li-del" data-id="' + esc(id) + '" aria-label="删掉">×</button></li>';
        }).join('') + '</ul>' +
        '<p class="mc-hint">这些先存在浏览器里,站上已经生效。' +
        '去<b>录入台</b>点「并入草稿」再导出 data.js,才算真正存下来。</p>' +
        '<div class="mc-row"><button type="button" class="btn btn-ghost" id="mc-copy-links">复制成文本</button></div>';
      box.querySelectorAll('.mc-li-del').forEach(function (b) {
        b.addEventListener('click', function () { window.MCLinks.remove(b.dataset.id); renderPending(); });
      });
      var cp = document.getElementById('mc-copy-links');
      if (cp) cp.addEventListener('click', function () {
        var text = window.MCLinks.asText(titleOfId);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { flash('已复制,可以粘到录入台的批量框里'); },
                                                   function () { flash('复制失败,手动选一下'); });
        } else { flash('这个浏览器不支持自动复制'); }
      });
    }
  }

  function idOfTitle(t) {
    var db = window.MEDIA_DB || [];
    for (var i = 0; i < db.length; i++) if (db[i] && db[i].title === t) return db[i].id || db[i].title;
    return '';
  }
  function titleOfId(id) {
    var db = window.MEDIA_DB || [];
    for (var i = 0; i < db.length; i++) if (db[i] && (db[i].id || db[i].title) === id) return db[i].title;
    return id;
  }

  /* ---------------------------------------------------- 日志面板 */
  function renderLogPanel(host) {
    if (!window.MCLog) { host.innerHTML = '<p class="mc-hint">日志模块没加载。</p>'; return; }
    var all = window.MCLog.all();
    var errs = all.filter(function (x) { return x.lv === 'error'; }).length;

    host.innerHTML =
      '<div class="mc-row mc-log-bar">' +
        '<label class="mc-check"><input type="checkbox" id="mc-log-err"> 只看错误</label>' +
        '<span class="mc-hint">共 ' + all.length + ' 条' + (errs ? ',错误 ' + errs + ' 条' : '') + '</span>' +
        '<button type="button" class="btn btn-ghost" id="mc-log-copy">复制全部</button>' +
        '<button type="button" class="btn btn-ghost" id="mc-log-clear">清空</button>' +
      '</div><ul class="mc-log-list" id="mc-log-list"></ul>';

    var onlyErr = false;
    function draw() {
      var list = (onlyErr ? all.filter(function (x) { return x.lv === 'error'; }) : all).slice().reverse();
      document.getElementById('mc-log-list').innerHTML = list.map(function (x) {
        return '<li class="mc-log-item"><span class="mc-log-t">' + esc(x.t.slice(5, 19)) + '</span>' +
          '<span class="mc-log-lv ' + esc(x.lv) + '">' + esc(x.lv) + '</span>' +
          '<span class="mc-log-m">' + esc(x.m) + (x.d ? '<em>' + esc(x.d) + '</em>' : '') + '</span></li>';
      }).join('') || '<li class="mc-hint" style="padding:20px;text-align:center">' +
        (onlyErr ? '没有错误 —— 挺好' : '还没有记录') + '</li>';
    }
    document.getElementById('mc-log-err').addEventListener('change', function () { onlyErr = this.checked; draw(); });
    document.getElementById('mc-log-copy').addEventListener('click', function () {
      var text = window.MCLog.text();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { flash('日志已复制,可以直接发给别人'); },
                                                 function () { flash('复制失败'); });
      } else { flash('这个浏览器不支持自动复制'); }
    });
    document.getElementById('mc-log-clear').addEventListener('click', function () {
      if (!confirm('清空运行日志?(只清日志,不动你的片子)')) return;
      window.MCLog.clear(); all = []; draw(); refreshDot(); flash('日志已清空');
    });
    draw();
  }

  /* ---------------------------------------------------- 小提示 */
  function flash(msg) {
    var t = document.querySelector('.mc-flash') || el('div', 'mc-flash');
    t.textContent = msg;
    if (!t.parentNode) document.body.appendChild(t);
    t.classList.add('is-on');
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { t.classList.remove('is-on'); }, 2600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else { build(); }
})();
