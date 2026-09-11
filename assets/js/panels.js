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
    /* title 只在「库里还没有这部」时给,录入台并入时据此新建条目 */
    set: function (id, resource, note, title) {
      var m = readAll();
      m[id] = { resource: resource, resourceNote: note || '' };
      if (title) m[id].title = title;
      var ok = writeAll(m);
      if (ok) LOG.info('存了一条本地链接', id + (title ? '(新建)' : '') + ' → ' + resource);
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

    return { url: url, code: code, host: host, name: pickName(text), raw: text };
  }

  /* 网盘分享那段的头一行通常带着文件名:
       通过网盘分享的文件:亮剑.2005.1080P.国语中字.mkv
     把它抠出来,再洗掉画质、字幕、集数这些噪音,就能拿去跟片库比对。 */
  function pickName(text) {
    var m = text.match(/(?:通过网盘分享的文件|我通过网盘分享的文件|分享的文件|文件名)\s*[::]?\s*(.+)/);
    var raw = m ? m[1] : '';
    if (!raw) {
      // 没有那句提示时,取第一行里不像链接、不像提取码的内容
      var first = text.split(/\n/)[0].trim();
      if (first && !/https?:|提取码|密码|^链接/.test(first)) raw = first;
    }
    return cleanName(raw);
  }

  /** 洗掉文件名里的噪音,只留片名 */
  function cleanName(s) {
    s = String(s || '').trim();
    if (!s) return '';
    s = s.split(/[\n\r]/)[0];
    s = s.replace(/\.(mkv|mp4|avi|rmvb|ts|m2ts|iso|zip|rar|7z|mov|wmv|flv)$/i, '');   // 扩展名
    s = s.replace(/等\s*\d+\s*个文件$/, '');                                          // 「等 3 个文件」
    s = s.replace(/[\[\(【（][^\]\)】）]*[\]\)】）]/g, ' ');                        // 方括号里的东西
    // 画质 / 片源 / 音轨 / 字幕 / 编码这类标记
    // 这些标记常和别的字粘在一起(BD1080P),不能要求词边界
    s = s.replace(/(2160P|1080P|1080I|720P|480P|4K|UHD|BluRay|Blu-?ray|WEB-?DL|WEBRip|HDTV|HDR(?:10)?|REMUX|x264|x265|H\.?264|H\.?265|HEVC|60FPS|DDP?5\.1)/gi, ' ');
    // 这几个短且容易误伤,要求前后是分隔符
    s = s.replace(/\b(HD|BD|DV|AAC|DTS|AC3|TC|HQ)\b/gi, ' ');
    s = s.replace(/(国语|粤语|英语|双语|中字|中英字幕|简中|繁中|内封|内嵌|无水印|高清|超清|蓝光|原盘|合集|全集|完结|未删减|修复版|导演剪辑版)/g, ' ');
    s = s.replace(/(全\s*\d+\s*集|\d+\s*集全|共\s*\d+\s*集|\d+\s*集)/g, ' ');
    s = s.replace(/(第[\s]*[0-9一二三四五六七八九十]+[\s]*季|S\d{1,2}(E\d{1,3})?|Season\s*\d+)/gi, ' ');
    s = s.replace(/\b(19|20)\d{2}\b/g, ' ');                                          // 年份
    s = s.replace(/[._\-+]+/g, ' ');                                                    // 分隔符
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }
  window.MCLinks.clean = cleanName;

  /** 拿洗过的名字去片库里找最像的一条 */
  function matchEntry(name) {
    var db = window.MEDIA_DB || [];
    if (!name || !db.length) return null;
    var n = name.toLowerCase();
    var best = null, bestLen = 0;
    for (var i = 0; i < db.length; i++) {
      var t = String(db[i].title || '');
      if (!t) continue;
      var lt = t.toLowerCase();
      // 名字里含片名,或片名里含名字,都算命中;取最长的那个,避免「亮」匹配到「亮剑」
      if ((n.indexOf(lt) > -1 || lt.indexOf(n) > -1) && t.length > bestLen) {
        best = db[i]; bestLen = t.length;
      }
    }
    return best;
  }
  window.MCLinks.match = matchEntry;
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
    var db = window.MEDIA_DB || [];

    host.innerHTML =
      '<div class="mc-field">' +
        '<label for="mc-title">片名 —— 自己填</label>' +
        '<input id="mc-title" type="text" list="mc-titles" autocomplete="off" placeholder="这条链接是哪部片子的">' +
        '<datalist id="mc-titles">' + db.map(function (x) {
          return '<option value="' + esc(x.title) + '"></option>';
        }).join('') + '</datalist>' +
        '<div class="mc-namehint" id="mc-namehint"></div>' +
      '</div>' +
      '<div class="mc-field">' +
        '<label for="mc-one">网盘链接</label>' +
        '<textarea id="mc-one" rows="3" placeholder="从网盘点「复制链接」得到的那一整段,连提取码一起粘进来"></textarea>' +
        '<div class="mc-parsed" id="mc-parsed"></div>' +
        '<div class="mc-row"><button type="button" class="btn btn-primary" id="mc-save-one" disabled>存起来</button></div>' +
      '</div>' +
      '<div class="mc-sep">或者一次填多条</div>' +
      '<div class="mc-field">' +
        '<label for="mc-bulk">一行一部:<code>片名 | 网盘地址 | 提取码</code></label>' +
        '<textarea id="mc-bulk" rows="4" placeholder="片名 | 网盘地址 | 提取码&#10;片名 | 网盘地址"></textarea>' +
        '<div class="mc-row"><button type="button" class="btn btn-primary" id="mc-save-bulk">批量存</button></div>' +
      '</div>' +
      '<div class="mc-pending" id="mc-pending"></div>';

    var nameInput = document.getElementById('mc-title');
    var nameHint = document.getElementById('mc-namehint');
    var one = document.getElementById('mc-one');
    var parsedBox = document.getElementById('mc-parsed');
    var saveBtn = document.getElementById('mc-save-one');
    var parsed = null;

    // 在详情页上就是当前这部,先替你填好(想改随时改)
    if (current) nameInput.value = current.title;

    function drawName() {
      var name = nameInput.value.trim();
      if (!name) {
        // 粘的那段里如果带文件名,给一个一键填入的提示 —— 点了才填,不自作主张
        var guess = parsed && parsed.name;
        nameHint.innerHTML = guess
          ? '这段里的文件名像是「' + esc(guess) + '」 <button type="button" class="mc-usename" id="mc-use">用这个</button>'
          : '<span class="mc-dim">先填片名,下面才存得下去</span>';
        var u = document.getElementById('mc-use');
        if (u) u.addEventListener('click', function () { nameInput.value = guess; drawName(); drawSave(); });
        return;
      }
      var hit = idOfTitle(name);
      nameHint.innerHTML = hit
        ? '<span class="mc-ok">库里已有</span>《' + esc(name) + '》—— 给它补上链接'
        : '<span class="mc-dim">库里没有</span>「' + esc(name) + '」—— 会<b>新建</b>一部';
    }

    function drawSave() {
      saveBtn.disabled = !(parsed && nameInput.value.trim());
    }

    function onLink() {
      var r = parseShare(one.value);
      parsed = r;
      parsedBox.innerHTML = r
        ? '<span class="mc-ok">认出来了</span> <code>' + esc(r.url) + '</code>' +
          (r.code ? ' · 提取码 <b>' + esc(r.code) + '</b>' : ' · 没找到提取码')
        : (one.value.trim() ? '<span class="mc-bad">没认出链接</span> —— 这段里得有个网址' : '');
      drawName();
      drawSave();
    }

    nameInput.addEventListener('input', function () { drawName(); drawSave(); });
    one.addEventListener('input', onLink);
    (current ? one : nameInput).focus();
    onLink();

    saveBtn.addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!parsed || !name) return;
      var id = idOfTitle(name) || name;
      var isNew = !idOfTitle(name);
      var note = parsed.code ? '提取码 ' + parsed.code : '';
      window.MCLinks.set(id, parsed.url, note, isNew ? name : '');
      if (window.MC_APPLY_LINK) window.MC_APPLY_LINK(id, parsed.url, note);
      one.value = '';
      if (!current) nameInput.value = '';
      parsed = null;
      onLink();
      renderPending();
      flash(isNew ? '已新建《' + name + '》并存好链接' : '已存给《' + name + '》');
    });

    document.getElementById('mc-save-bulk').addEventListener('click', function () {
      var ta = document.getElementById('mc-bulk');
      var lines = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      var okN = 0, newN = 0, bad = [];
      lines.forEach(function (line) {
        var cols = line.split(/\s*[|｜\t]\s*/);
        var title = cols[0];
        if (!title) { bad.push(line + '  ← 没有片名'); return; }
        var r = parseShare(cols.slice(1).join(' ')) || parseShare(line);
        if (!r) { bad.push(line + '  ← 没认出链接'); return; }
        var id = idOfTitle(title);
        var isNew = !id;
        if (isNew) { id = title; newN++; }
        var raw = cols[2] && !/^https?:/i.test(cols[2]) ? cols[2] : r.code;
        var note = raw ? (/提取码|密码|访问码/.test(raw) ? raw : '提取码 ' + raw) : '';
        window.MCLinks.set(id, r.url, note, isNew ? title : '');
        if (window.MC_APPLY_LINK) window.MC_APPLY_LINK(id, r.url, note);
        okN++;
      });
      ta.value = bad.join('\n');
      renderPending();
      flash(okN ? '存了 ' + okN + ' 条' + (newN ? '(其中新建 ' + newN + ' 部)' : '') +
                  (bad.length ? ',' + bad.length + ' 行没处理' : '')
                : '一条都没认出来');
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
          var v = m[id];
          return '<li><span class="mc-li-name">' + esc(v.title || titleOfId(id)) +
            (v.title ? '<em class="mc-li-new">新</em>' : '') + '</span>' +
            '<span class="mc-li-url">' + esc(v.resource) + '</span>' +
            (v.resourceNote ? '<span class="mc-li-code">' + esc(v.resourceNote) + '</span>' : '') +
            '<button type="button" class="mc-li-del" data-id="' + esc(id) + '" aria-label="删掉">×</button></li>';
        }).join('') + '</ul>' +
        '<p class="mc-hint">这些先存在浏览器里,站上已经生效。' +
        '去<b>录入台</b>点「并入草稿」再导出 data.js,才算真正存下来。</p>' +
        '<div class="mc-row"><button type="button" class="btn btn-ghost" id="mc-copy-links">复制成文本</button></div>';
      box.querySelectorAll('.mc-li-del').forEach(function (bt) {
        bt.addEventListener('click', function () { window.MCLinks.remove(bt.dataset.id); renderPending(); });
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
