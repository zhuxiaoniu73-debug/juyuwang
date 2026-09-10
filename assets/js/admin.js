/* 影视收藏馆 · 录入台(本地工具,不属于对外站点)
 * ------------------------------------------------------------------
 * 作用:把片子和资源链接填进来,最后生成一份新的 assets/js/data.js。
 * 数据先存在浏览器 localStorage 里,导出覆盖 data.js 才算真正落盘。
 * 不联网、不上传,关掉页面草稿还在。 */
(function () {
  'use strict';

  var KEY = 'mc-admin-draft';
  /* data.js 解析失败时 window.MEDIA_DB 是 undefined。这时候草稿会是空的,
     一旦导出就会用空文件盖掉原数据 —— 必须先拦住。 */
  var SOURCE_OK = Array.isArray(window.MEDIA_DB);
  var CATEGORIES = (window.MC && window.MC.CATEGORIES) || [];
  var BASE = window.MEDIA_DB || [];

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function toast(msg, bad) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast is-on' + (bad ? ' is-bad' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ------------------------------------------------------------ 草稿 */
  var draft;
  try {
    draft = JSON.parse(localStorage.getItem(KEY));
  } catch (e) { draft = null; }
  // 注意只认「有没有存过草稿」,不能拿长度判断 —— 否则手动删空之后一刷新又被灌回来
  if (!Array.isArray(draft)) draft = JSON.parse(JSON.stringify(BASE));

  /** 源文件坏了、而且手上没有草稿时,导出会造成数据丢失 —— 先问一句 */
  function exportGuard() {
    if (SOURCE_OK) return true;
    return confirm('assets/js/data.js 没能正常读取(多半是写出了语法错误)。\n\n' +
      '现在导出的内容不包含原文件里的片子,覆盖过去会把它们弄丢。\n' +
      '建议先按 F12 看控制台报错、把 data.js 改对,再回来导出。\n\n' +
      '仍要继续吗?');
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch (e) {
      toast('浏览器存不下了 —— 海报图太多的话,先导出一次 data.js', true);
    }
  }

  function findByTitle(t) {
    t = String(t).trim();
    for (var i = 0; i < draft.length; i++) if (draft[i].title === t) return draft[i];
    return null;
  }
  function makeId(title, year) {
    // 详情页用 encodeURIComponent 传参,中文 id 完全可用,所以默认就拿片名当 id
    var base = String(title).trim();
    var taken = function (v) {
      return draft.some(function (x) { return x.id === v && x !== editing; });
    };
    if (!taken(base)) return base;
    if (year && !taken(base + '-' + year)) return base + '-' + year;
    var n = 2;
    while (taken(base + '-' + n)) n++;
    return base + '-' + n;
  }

  /* ------------------------------------------------------------ 表单 */
  var editing = null;          // 正在编辑的条目,null 表示新增
  var posterData = '';         // 当前表单里的海报(URL 或 data URI)

  var f = {
    title: $('#f-title'), category: $('#f-category'), year: $('#f-year'),
    region: $('#f-region'), rating: $('#f-rating'), director: $('#f-director'),
    actors: $('#f-actors'), desc: $('#f-desc'), res: $('#f-res'),
    note: $('#f-note'), added: $('#f-added'), hot: $('#f-hot'), id: $('#f-id')
  };

  // 分类下拉
  CATEGORIES.forEach(function (c) {
    var o = document.createElement('option');
    o.value = o.textContent = c.name;
    f.category.appendChild(o);
  });

  var pickedGenres = [];
  function renderGenres() {
    var cfg = null;
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].name === f.category.value) cfg = CATEGORIES[i];
    var offered = (cfg ? cfg.genres : []).slice();
    pickedGenres.forEach(function (g) { if (offered.indexOf(g) === -1) offered.push(g); });
    $('#genre-chips').innerHTML = offered.map(function (g) {
      return '<button type="button" class="chip' + (pickedGenres.indexOf(g) > -1 ? ' is-on' : '') +
             '" data-g="' + esc(g) + '">' + esc(g) + '</button>';
    }).join('');
  }
  $('#genre-chips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip');
    if (!c) return;
    var g = c.dataset.g, i = pickedGenres.indexOf(g);
    if (i > -1) pickedGenres.splice(i, 1); else pickedGenres.push(g);
    renderGenres();
  });
  f.category.addEventListener('change', renderGenres);

  $('#genre-add').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    var v = this.value.trim();
    if (v && pickedGenres.indexOf(v) === -1) pickedGenres.push(v);
    this.value = '';
    renderGenres();
  });

  /* --------------------------------------------------------- 海报处理 */
  function setPoster(v) {
    posterData = v || '';
    var box = $('#poster-preview');
    if (posterData) {
      box.innerHTML = '<img src="' + esc(posterData) + '" alt="海报预览">';
      box.classList.add('has-img');
      $('#poster-clear').hidden = false;
      var kb = Math.round(posterData.length / 1024);
      $('#poster-hint').textContent = posterData.indexOf('data:') === 0
        ? '已嵌入图片,约 ' + kb + ' KB(直接存进 data.js)'
        : '使用图片地址';
    } else {
      box.innerHTML = '<span class="poster-empty">留空 → 自动生成配色海报</span>';
      box.classList.remove('has-img');
      $('#poster-clear').hidden = true;
      $('#poster-hint').textContent = '';
    }
  }
  $('#poster-clear').addEventListener('click', function () { setPoster(''); $('#f-poster-url').value = ''; });
  $('#f-poster-url').addEventListener('change', function () { setPoster(this.value.trim()); });

  /** 本地图片压到 400×600 以内再转 data URI,免得 data.js 撑爆 */
  function compress(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var W = 400, H = 600;
        var scale = Math.min(W / img.width, H / img.height, 1);
        var cw = Math.round(img.width * scale), ch = Math.round(img.height * scale);
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
        cb(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = function () { toast('这个图片读不出来', true); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  var drop = $('#poster-drop');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
  });
  drop.addEventListener('drop', function (e) {
    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && /^image\//.test(file.type)) compress(file, setPoster);
  });
  $('#f-poster-file').addEventListener('change', function () {
    if (this.files[0]) compress(this.files[0], setPoster);
  });
  // 直接 Ctrl+V 粘贴截图
  document.addEventListener('paste', function (e) {
    if (!e.clipboardData) return;
    var items = e.clipboardData.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === 0) {
        compress(items[i].getAsFile(), setPoster);
        toast('已把剪贴板里的图片设为海报');
        e.preventDefault();
        return;
      }
    }
  });

  /* --------------------------------------------------------- 读写表单 */
  function clearForm() {
    editing = null;
    pickedGenres = [];
    f.title.value = ''; f.year.value = ''; f.region.value = '中国';
    f.rating.value = ''; f.director.value = ''; f.actors.value = '';
    f.desc.value = ''; f.res.value = ''; f.note.value = '';
    f.added.value = today(); f.hot.checked = false; f.id.value = '';
    f.category.value = CATEGORIES.length ? CATEGORIES[0].name : '';
    $('#f-poster-url').value = '';
    setPoster('');
    renderGenres();
    $('#form-title').textContent = '新增一条';
    $('#btn-del').hidden = true;
  }

  function loadForm(item) {
    editing = item;
    pickedGenres = (item.genres || []).slice();
    f.title.value = item.title || '';
    f.category.value = item.category || '';
    f.year.value = item.year || '';
    f.region.value = item.region || '';
    f.rating.value = item.rating == null ? '' : item.rating;
    f.director.value = item.director || '';
    f.actors.value = (item.actors || []).join('、');
    f.desc.value = item.description || '';
    f.res.value = item.resource || '';
    f.note.value = item.resourceNote || '';
    f.added.value = item.added || today();
    f.hot.checked = !!item.hot;
    f.id.value = item.id || '';
    $('#f-poster-url').value = (item.poster && item.poster.indexOf('data:') !== 0) ? item.poster : '';
    setPoster(item.poster || '');
    renderGenres();
    $('#form-title').textContent = '编辑:' + item.title;
    $('#btn-del').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** 补全裸域名(pan.quark.cn/s/x → https://pan.quark.cn/s/x),并挡掉 javascript: 之类 */
  function tidyUrl(v) {
    if (window.MC && window.MC.safeUrl) return window.MC.safeUrl(v);
    return String(v == null ? '' : v).trim();
  }

  function splitList(s) {
    return String(s).split(/[、,,\/\|\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  $('#entry-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = f.title.value.trim();
    if (!title) { toast('片名不能空', true); return; }

    var year = parseInt(f.year.value, 10);
    var obj = {
      id: f.id.value.trim() || makeId(title, year),
      title: title,
      category: f.category.value,
      genres: pickedGenres.slice(),
      year: isNaN(year) ? new Date().getFullYear() : year,
      region: f.region.value.trim() || '中国',
      actors: splitList(f.actors.value),
      description: f.desc.value.trim(),
      resource: tidyUrl(f.res.value),
      added: f.added.value || today(),
      hot: f.hot.checked
    };
    if (posterData) obj.poster = posterData;
    if (f.director.value.trim()) obj.director = f.director.value.trim();
    var r = parseFloat(f.rating.value);
    if (!isNaN(r)) obj.rating = r;
    if (f.note.value.trim()) obj.resourceNote = f.note.value.trim();

    if (editing) {
      draft[draft.indexOf(editing)] = obj;
      toast('已更新:' + title);
    } else {
      draft.unshift(obj);
      toast('已添加:' + title);
    }
    persist();
    clearForm();
    renderList();
  });

  $('#btn-clear').addEventListener('click', clearForm);
  $('#btn-del').addEventListener('click', function () {
    if (!editing) return;
    if (!confirm('删掉「' + editing.title + '」?')) return;
    draft.splice(draft.indexOf(editing), 1);
    persist();
    clearForm();
    renderList();
    toast('已删除');
  });

  /* ------------------------------------------------------- 批量粘贴 */
  function isUrl(s) {
    s = String(s).trim();
    // 带协议的,或者看着就是个域名的(pan.quark.cn/s/xxx),都算链接
    return /^(https?:\/\/|magnet:|ed2k:|thunder:|ftp:|\/\/)/i.test(s) ||
           /^[\w.-]+\.[a-z]{2,}[\/?#]/i.test(s);
  }

  $('#bulk-run').addEventListener('click', function () {
    var lines = $('#bulk-text').value.split('\n')
      .map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) { toast('先粘贴几行进来', true); return; }

    var updated = 0, added = 0, bad = [];
    lines.forEach(function (line) {
      var cols = line.split(/\s*[|｜\t]\s*/).map(function (c) { return c.trim(); });
      var title = cols[0];
      if (!title) { bad.push(line); return; }

      // 「片名 | 链接」或「片名 | 链接 | 提取码」→ 只给已有条目补链接
      if (cols.length <= 3 && isUrl(cols[1])) {
        var hit = findByTitle(title);
        if (hit) {
          hit.resource = tidyUrl(cols[1]);
          if (cols[2]) hit.resourceNote = cols[2];
          updated++;
        } else {
          draft.unshift({
            id: makeId(title), title: title, category: CATEGORIES[0].name, genres: [],
            year: new Date().getFullYear(), region: '中国', actors: [], description: '',
            resource: tidyUrl(cols[1]), resourceNote: cols[2] || '', added: today(), hot: false
          });
          added++;
        }
        return;
      }

      // 完整格式:片名 | 分类 | 年份 | 地区 | 类型 | 链接 | 提取码
      if (cols.length >= 3) {
        var y = parseInt(cols[2], 10);
        var obj = {
          id: makeId(title, y), title: title,
          category: cols[1] || CATEGORIES[0].name,
          genres: cols[4] ? splitList(cols[4]) : [],
          year: isNaN(y) ? new Date().getFullYear() : y,
          region: cols[3] || '中国',
          actors: [], description: '',
          resource: tidyUrl(cols[5] || ''), added: today(), hot: false
        };
        if (cols[6]) obj.resourceNote = cols[6];
        var exist = findByTitle(title);
        if (exist) {
          // 已有的只补链接,不覆盖已经写好的信息
          if (obj.resource) exist.resource = obj.resource;
          if (obj.resourceNote) exist.resourceNote = obj.resourceNote;
          updated++;
        } else {
          draft.unshift(obj);
          added++;
        }
        return;
      }
      bad.push(line);
    });

    persist();
    renderList();
    var msg = '补链接 ' + updated + ' 条,新增 ' + added + ' 条';
    if (bad.length) msg += ',' + bad.length + ' 行没认出来';
    toast(msg, bad.length > 0);
    if (!bad.length) $('#bulk-text').value = '';
    else $('#bulk-text').value = bad.join('\n');
  });

  /* ---------------------------------------------------------- 列表 */
  var filterText = '', onlyMissing = false;

  $('#list-search').addEventListener('input', function () {
    filterText = this.value.trim().toLowerCase();
    renderList();
  });
  $('#only-missing').addEventListener('change', function () {
    onlyMissing = this.checked;
    renderList();
  });

  function renderList() {
    var list = draft.filter(function (i) {
      if (onlyMissing && i.resource) return false;
      if (!filterText) return true;
      return (i.title + ' ' + i.category + ' ' + (i.genres || []).join(' ')).toLowerCase()
             .indexOf(filterText) > -1;
    });

    var missing = draft.filter(function (i) { return !i.resource; }).length;
    $('#stat-total').textContent = draft.length;
    $('#stat-missing').textContent = missing;

    $('#list').innerHTML = list.map(function (i) {
      var idx = draft.indexOf(i);
      var flags = [];
      if (!i.resource) flags.push('<b class="flag-miss">缺链接</b>');
      if (!i.description) flags.push('<b class="flag-warn">缺简介</b>');
      return '<li class="row-item' + (i.resource ? '' : ' is-missing') + '" data-i="' + idx + '">' +
        '<span class="row-thumb"' + (i.poster ? ' style="background-image:url(' + esc(i.poster) + ')"' : '') + '>' +
          (i.poster ? '' : esc(i.title.charAt(0))) + '</span>' +
        '<span class="row-main">' +
          '<span class="row-title">' + esc(i.title) + '</span>' +
          '<span class="row-meta">' + esc(i.year) + ' · ' + esc(i.category) +
            (i.genres && i.genres.length ? ' · ' + esc(i.genres.join('/')) : '') + '</span>' +
        '</span>' +
        '<span class="row-flag">' + (flags.length ? flags.join('') : '<span>齐了</span>') + '</span>' +
      '</li>';
    }).join('') || '<li class="row-empty">' +
      (draft.length ? '没有匹配的条目' : '还是空的 —— 左边填一条,或者上面批量粘贴几行链接') +
      '</li>';
  }

  $('#list').addEventListener('click', function (e) {
    var li = e.target.closest('.row-item');
    if (!li) return;
    loadForm(draft[+li.dataset.i]);
  });

  /* ---------------------------------------------------- 导出 data.js */
  var HEADER = [
    '/* 影视收藏馆 · 数据层',
    ' * ---------------------------------------------------------------',
    ' * 这里就是整站的「数据库」。想加片子,用 admin.html(录入台)或直接复制一条改内容,',
    ' * 首页、片库、详情页会自动跟着变,不需要动其它文件。',
    ' *',
    ' * 字段说明(与 Webflow CMS 集合「影视库」一一对应,见 data/webflow-cms.md):',
    ' *   id          唯一标识,详情页靠它取数据(detail.html?id=xxx)',
    ' *   title       影视名称        Title',
    ' *   poster      封面图地址      Image        留空则自动生成一张配色海报',
    ' *   category    分类           Category     电影 / 电视剧 / 综艺 / 纪录片',
    ' *   genres      类型标签        Genre        数组,第一个是主类型',
    ' *   year        年份           Year',
    ' *   region      地区           Region',
    ' *   actors      演员           Actors       数组',
    ' *   director    导演           (可选)',
    ' *   rating      评分           (可选,0-10)',
    ' *   description 简介           Description',
    ' *   resource    资源入口链接    Resource URL 留空则详情页按钮置灰',
    ' *   resourceNote 提取码/说明    Resource Note(可选,显示在资源按钮下面)',
    ' *   added       接入日期        (YYYY-MM-DD,首页「新近接入」按它排序)',
    ' *   hot         是否热门        (true 会进首页「热门影视」)',
    ' */',
    ''
  ].join('\n');

  function q(s) {
    return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      .replace(/\r/g, '').replace(/\n/g, '\\n') + "'";
  }
  function arr(a) {
    return '[' + (a || []).map(q).join(', ') + ']';
  }

  function serialize() {
    var body = draft.map(function (i) {
      var lines = [
        '    id: ' + q(i.id),
        '    title: ' + q(i.title),
        (i.poster ? '    poster: ' + q(i.poster) : null),
        '    category: ' + q(i.category),
        '    genres: ' + arr(i.genres),
        '    year: ' + (parseInt(i.year, 10) || new Date().getFullYear()),
        '    region: ' + q(i.region),
        '    actors: ' + arr(i.actors),
        (i.director ? '    director: ' + q(i.director) : null),
        (i.rating != null && i.rating !== '' ? '    rating: ' + Number(i.rating) : null),
        '    description: ' + q(i.description || ''),
        '    resource: ' + q(i.resource || ''),
        (i.resourceNote ? '    resourceNote: ' + q(i.resourceNote) : null),
        '    added: ' + q(i.added || today()),
        '    hot: ' + (i.hot ? 'true' : 'false')
      ].filter(Boolean);
      return '  {\n' + lines.join(',\n') + '\n  }';
    }).join(',\n');
    return HEADER + '\nwindow.MEDIA_DB = [\n' + body + '\n];\n';
  }

  function sizeNote(text) {
    var kb = Math.round(text.length / 1024);
    return kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB';
  }

  $('#btn-copy').addEventListener('click', function () {
    if (!exportGuard()) return;
    var text = serialize();
    var done = function () { toast('已复制(' + sizeNote(text) + ')—— 覆盖 assets/js/data.js 即可'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  });

  function fallbackCopy(text, done) {
    var ta = $('#export-text');
    ta.hidden = false;
    ta.value = text;
    ta.select();
    try {
      document.execCommand('copy') ? done() : toast('自动复制没成功,下面的文本框里全选复制', true);
    } catch (e) {
      toast('自动复制没成功,下面的文本框里全选复制', true);
    }
  }

  $('#btn-download').addEventListener('click', function () {
    if (!exportGuard()) return;
    var text = serialize();
    try {
      var blob = new Blob([text], { type: 'text/javascript;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'data.js';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('已下载 data.js(' + sizeNote(text) + ')');
    } catch (e) {
      toast('下载被拦了,用「复制」那个按钮', true);
    }
  });

  $('#btn-show').addEventListener('click', function () {
    var ta = $('#export-text');
    ta.hidden = !ta.hidden;
    if (!ta.hidden) { ta.value = serialize(); ta.select(); }
  });

  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('丢掉浏览器里的草稿,回到 data.js 文件里的内容?')) return;
    draft = JSON.parse(JSON.stringify(BASE));
    persist();
    clearForm();
    renderList();
    toast('已回到文件内容');
  });

  /* ------------------------------------------------------------ 启动 */
  clearForm();
  renderList();

  if (!SOURCE_OK) {
    var warn = document.createElement('div');
    warn.className = 'source-warn';
    warn.innerHTML = '<b>读不到 assets/js/data.js</b>' +
      '<span>多半是手动编辑时写出了语法错误。下面显示的条目不包含原文件里的内容,' +
      '这时候导出会覆盖丢数据。按 F12 看控制台第一行红字,它会指出错在哪。</span>';
    document.querySelector('.admin-wrap').before(warn);
  }
})();
