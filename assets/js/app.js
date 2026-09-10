/* 影视收藏馆 · 交互层
 * 首页 / 片库 / 详情 三个页面共用这一个文件,
 * 靠 <body data-page="home|list|detail"> 决定跑哪段逻辑。
 * 零依赖、零外链,直接双击 HTML 也能用。 */
(function () {
  'use strict';

  /* 手写 data.js 时漏个字段太常见了(少写 genres: [] 之类)。
     这里统一补齐,免得一条写坏就把整个片库和详情页带崩。 */
  function normalize(raw, i) {
    var it = raw || {};
    var list = function (v) { return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); };
    var year = parseInt(it.year, 10);
    var out = {
      id:       String(it.id || it.title || ('item-' + (i + 1))),
      title:    String(it.title || '未命名'),
      poster:   it.poster || '',
      category: String(it.category || '电影'),
      genres:   list(it.genres),
      year:     isNaN(year) ? 0 : year,
      region:   String(it.region || '未填'),
      actors:   list(it.actors),
      description: String(it.description == null ? '' : it.description),
      resource: String(it.resource || ''),
      added:    String(it.added || ''),
      hot:      !!it.hot
    };
    if (it.director) out.director = String(it.director);
    if (it.resourceNote) out.resourceNote = String(it.resourceNote);
    var r = parseFloat(it.rating);
    if (!isNaN(r)) out.rating = r;
    // 检索用的字符串预先拼好并转小写 —— 否则每敲一个字都要为每条数据重拼一遍
    out._s = (out.title + ' ' + out.category + ' ' + out.genres.join(' ') + ' ' +
              out.region + ' ' + out.actors.join(' ') + ' ' + (out.director || '') + ' ' +
              out.year).toLowerCase();
    return out;
  }

  /* 区分「确实一条都没有」和「data.js 根本没读进来」。
     后者多半是手改时写出了语法错误,这时候显示「馆里还是空的」会误导人 —— 
     真实情况是数据还在文件里,只是解析失败了。 */
  var DB_OK = Array.isArray(window.MEDIA_DB);
  var DB = (DB_OK ? window.MEDIA_DB : []).map(normalize);

  var LOG = window.MCLog || { info: function () {}, warn: function () {}, error: function () {} };
  if (!DB_OK) {
    LOG.error('data.js 没读进来', 'window.MEDIA_DB 不是数组,多半是文件里有语法错误');
  } else {
    LOG.info('读取数据', DB.length + ' 条');
    // 缺字段的条目挨个记一笔,方便回头照着改
    DB.forEach(function (it, i) {
      var miss = [];
      if (!it.genres.length) miss.push('genres');
      if (!it.year) miss.push('year');
      if (!it.added) miss.push('added');
      if (miss.length) LOG.warn('第 ' + (i + 1) + ' 条「' + it.title + '」缺字段', miss.join(', ') + '(已按默认值处理)');
    });
  }

  /* ---------------------------------------------------------- 分类配置 */
  var ICONS = {
    film:  '<path d="M3 4h18v16H3z"/><path d="M7 4v16M17 4v16M3 10h18M3 14h18"/>',
    tv:    '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M8 3l4 3 4-3"/>',
    star:  '<path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/>',
    doc:   '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    home:  '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
    grid:  '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    arrow: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    play:  '<path d="M6 4l14 8-14 8z"/>',
    link:  '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    empty: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><path d="M8.5 11h5"/>'
  };

  /** 分类 → 类型标签 / 主题色 / 图标,首页入口和片库筛选都读这份配置 */
  var CATEGORIES = [
    { name: '电影',   color: '#e5322d', icon: 'film',   genres: ['恐怖', '喜剧', '动作', '科幻', '爱情'] },
    { name: '电视剧', color: '#4d7cf5', icon: 'tv',     genres: ['战争', '古装', '悬疑', '都市'] },
    { name: '综艺',   color: '#f0a13a', icon: 'star',   genres: ['真人秀', '音乐', '脱口秀'] },
    { name: '纪录片', color: '#2fb6a0', icon: 'doc',    genres: ['历史', '自然', '科技'] }
  ];

  function svg(name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
           ICONS[name] + '</svg>';
  }

  function catOf(name) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].name === name) return CATEGORIES[i];
    return CATEGORIES[0];
  }

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  /* 转义走一遍正则就够,而且大多数片名简介根本不含特殊字符,先探一下直接返回。
     600 张卡片时这里会被调用近万次,原来的五连 replace 是渲染耗时的大头之一。 */
  /** 浮层里只显示三行,截断一下,别让整段简介都进 DOM */
  function clip(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var ESC_TEST = /[&<>"']/;
  var ESC_ALL = /[&<>"']/g;
  function esc(s) {
    if (s == null) return '';
    s = String(s);
    if (!ESC_TEST.test(s)) return s;
    return s.replace(ESC_ALL, function (c) { return ESC_MAP[c]; });
  }

  /** 只放行正常的链接协议。
   *  javascript: / data:text/html 这类一律当没填 —— 从别处粘链接时可能带进来。
   *  顺带:没写协议的裸域名(pan.quark.cn/s/xxx)自动补 https:// */
  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^(https?:|magnet:|ed2k:|thunder:|ftp:|\/|\.\/|\.\.\/|#)/i.test(u)) return u;
    if (/^[\w.-]+\.[a-z]{2,}([\/?#]|$)/i.test(u)) return 'https://' + u;
    return '';
  }

  /** 图片地址:除了正常协议,再放行 data:image */
  function safeImg(u) {
    u = String(u == null ? '' : u).trim();
    if (/^data:image\//i.test(u)) return u;
    return safeUrl(u);
  }

  /* ------------------------------------------------------------ 海报 */
  /* 没有 poster 图源时,按片名算一个稳定的色相,生成一张配色海报。
     同一部片子在任何页面、任何时候颜色都一样。 */
  function hueOf(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
    return h;
  }

  /* withName:海报上要不要压片名。
     卡片下面本来就有片名,再压一遍显得啰嗦;详情页和首页头图的大海报则需要。 */
  function posterInner(item, withName) {
    var img = safeImg(item.poster);
    if (img) {
      return '<img src="' + esc(img) + '" alt="' + esc(item.title) + ' 海报" loading="lazy">';
    }
    var h = hueOf(item.title + item.category);
    var h2 = (h + 42) % 360;
    var bg = 'linear-gradient(155deg, hsl(' + h + ',44%,30%) 0%, hsl(' + h2 + ',52%,15%) 58%, hsl(' + h2 + ',48%,9%) 100%)';
    return '<div class="poster-gen" style="background:' + bg + '">' +
             '<span class="poster-glyph">' + esc(item.title.charAt(0)) + '</span>' +
             '<span class="poster-badge">' + esc(item.category) + '</span>' +
             (withName
               ? '<span class="poster-cap"><span class="poster-name">' + esc(item.title) + '</span></span>'
               : '') +
           '</div>';
  }

  /* 卡片一律先拼成字符串、最后一次性塞进 DOM。
     早先是逐张 createElement + insertAdjacentHTML,600 张要 1.3 秒,
     而同样的 HTML 交给浏览器一次解析只要几十毫秒。 */
  function posterHTML(item, opts) {
    opts = opts || {};
    return '<div class="poster">' + posterInner(item, opts.name) +
      (item.rating ? '<span class="poster-score">' + item.rating.toFixed(1) + '</span>' : '') +
      (opts.hover
        ? '<div class="poster-hover">' +
            '<div class="ph-title">' + esc(item.title) + '</div>' +
            '<div class="ph-line"><span>' + esc(item.year || '—') + '</span><span>' + esc(item.region) + '</span>' +
              '<span>' + esc(item.genres.join(' / ')) + '</span></div>' +
            '<p class="ph-desc">' + esc(clip(item.description, 90)) + '</p>' +
            '<span class="ph-cta">查看详情' + svg('right') + '</span>' +
          '</div>'
        : '') +
      '</div>';
  }

  function posterEl(item, opts) {
    var box = el('div');
    box.innerHTML = posterHTML(item, opts);
    return box.firstChild;
  }

  /** 一张影视卡片:海报 + 名称 + 年份 + 类型标签,点击进详情页 */
  function cardHTML(item) {
    return '<a class="card" href="detail.html?id=' + encodeURIComponent(item.id) + '"' +
      ' aria-label="' + esc(item.title + ' · ' + (item.year || '年份未填') + ' · ' + item.genres.join(' ')) + '">' +
      posterHTML(item, { hover: true }) +
      '<div class="card-body">' +
        '<div class="card-title">' + esc(item.title) + '</div>' +
        '<div class="card-meta"><span>' + esc(item.year || '—') + '</span><span class="dot">·</span>' +
          '<span>' + esc(item.category) + '</span><span class="dot">·</span><span>' + esc(item.region) + '</span></div>' +
        '<div class="card-tags">' + item.genres.slice(0, 2).map(function (g) {
          return '<span class="tag">' + esc(g) + '</span>';
        }).join('') + '</div>' +
      '</div></a>';
  }

  function cardEl(item) {
    var box = el('div');
    box.innerHTML = cardHTML(item);
    return box.firstChild;
  }

  /* ------------------------------------------------------- 检索与排序 */
  function matchQuery(item, q) {
    if (!q) return true;
    return item._s.indexOf(q.toLowerCase()) > -1;
  }

  function search(q, limit) {
    var lq = String(q).toLowerCase();
    var hit = DB.filter(function (i) { return matchQuery(i, lq); });
    // 片名直接命中的排前面
    hit.sort(function (a, b) {
      var ai = a.title.toLowerCase().indexOf(lq) > -1 ? 0 : 1;
      var bi = b.title.toLowerCase().indexOf(lq) > -1 ? 0 : 1;
      return ai - bi || b.year - a.year;
    });
    return limit ? hit.slice(0, limit) : hit;
  }

  var SORTS = {
    // 没填接入日期的排最后 —— 日期未知不等于最新
    added:  function (a, b) {
      if (!a.added !== !b.added) return a.added ? -1 : 1;
      return (a.added < b.added ? 1 : a.added > b.added ? -1 : 0);
    },
    year:   function (a, b) { return (b.year || 0) - (a.year || 0); },
    rating: function (a, b) { return (b.rating || 0) - (a.rating || 0); },
    title:  function (a, b) { return a.title.localeCompare(b.title, 'zh-Hans-CN'); }
  };

  function decadeOf(y) { return Math.floor(y / 10) * 10; }

  /* ------------------------------------------------------- 顶栏 / 通用 */
  function initHeader() {
    var header = $('.site-header');
    if (header) {
      var onScroll = function () { header.classList.toggle('is-stuck', window.scrollY > 8); };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    var box = $('.header-search');
    if (!box) return;
    var input = $('input', box);
    var sug = $('.suggest', box);
    var cursor = -1;

    var params = new URLSearchParams(location.search);
    if (document.body.dataset.page === 'list' && params.get('q')) input.value = params.get('q');
    box.classList.toggle('has-value', !!input.value);

    function close() { sug.classList.remove('is-open'); cursor = -1; }

    var onList = document.body.dataset.page === 'list';

    function render() {
      var q = input.value.trim();
      box.classList.toggle('has-value', !!q);
      // 片库页的结果就在下面实时变,再弹个下拉盖住它没有意义
      if (!q || onList) { close(); return; }
      var hits = search(q, 6);
      sug.innerHTML = hits.length
        ? hits.map(function (it) {
            return '<a class="suggest-item" href="detail.html?id=' + encodeURIComponent(it.id) + '">' +
                     '<span class="suggest-thumb">' + posterInner(it) + '</span>' +
                     '<span class="suggest-body">' +
                       '<span class="suggest-title">' + esc(it.title) + '</span>' +
                       '<span class="suggest-meta">' + esc(it.year) + ' · ' + esc(it.category) + ' · ' +
                         esc(it.genres.join('/')) + '</span>' +
                     '</span></a>';
          }).join('')
        : '<div class="suggest-empty">没有找到「' + esc(q) + '」,换个关键词试试</div>';
      sug.classList.add('is-open');
      cursor = -1;
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', render);

    input.addEventListener('keydown', function (e) {
      var items = $$('.suggest-item', sug);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!items.length) return;
        e.preventDefault();
        cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (n, i) { n.classList.toggle('is-cursor', i === cursor); });
      } else if (e.key === 'Enter') {
        if (cursor > -1 && items[cursor]) { location.href = items[cursor].getAttribute('href'); return; }
        var q = input.value.trim();
        if (q) location.href = 'list.html?q=' + encodeURIComponent(q);
      } else if (e.key === 'Escape') {
        close(); input.blur();
      }
    });

    document.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });

    var clear = $('.clear-btn', box);
    if (clear) clear.addEventListener('click', function () {
      input.value = ''; box.classList.remove('has-value'); close(); input.focus();
      if (document.body.dataset.page === 'list' && window.__listSearch) window.__listSearch('');
    });
  }

  /** 把 site.js 里的名字和文案填进页面 */
  function applySite() {
    var S = window.SITE || {};
    $$('[data-site]').forEach(function (n) {
      var v = S[n.dataset.site];
      if (v) n.textContent = v;
    });
    // 浏览器标签页标题(详情页会被影片名覆盖)
    var page = document.body.dataset.page;
    var suffix = S.full || S.short || '影视收藏馆';
    if (page === 'home')  document.title = suffix;
    if (page === 'list')  document.title = '片库 · ' + suffix;
    if (page === 'admin') document.title = '录入台 · ' + suffix;
  }

  /** 高亮当前页面的导航项 */
  function initNav() {
    var page = document.body.dataset.page;
    $$('[data-nav]').forEach(function (n) {
      n.classList.toggle('is-active', n.dataset.nav === page);
    });
  }

  var rowResizers = [];   // 同上:切页重跑时先把上一批监听撤掉

  /** 首页横向影片行的左右翻页 */
  function initRows() {
    rowResizers.forEach(function (fn) { window.removeEventListener('resize', fn); });
    rowResizers = [];
    $$('.row-wrap').forEach(function (wrap) {
      var row = $('.row', wrap);
      var prev = $('.row-nav.prev', wrap);
      var next = $('.row-nav.next', wrap);
      if (!row || !prev || !next) return;
      function sync() {
        prev.disabled = row.scrollLeft < 8;
        next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 8;
      }
      prev.addEventListener('click', function () { row.scrollBy({ left: -row.clientWidth * .85, behavior: 'smooth' }); });
      next.addEventListener('click', function () { row.scrollBy({ left:  row.clientWidth * .85, behavior: 'smooth' }); });
      row.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync);
      rowResizers.push(sync);
      sync();
    });
  }

  function initReveal() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach(function (n) { n.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (n) { io.observe(n); });
  }

  /** 空态块:馆里还没东西时给个明确的下一步,而不是露出空架子 */
  function emptyBlock(title, desc, primary) {
    return '<div class="empty">' +
             '<div class="empty-icon">' + svg('empty') + '</div>' +
             '<h3>' + esc(title) + '</h3>' +
             '<p>' + esc(desc) + '</p>' +
             (primary || '') +
           '</div>';
  }

  /** data.js 没读进来时的提示。说清楚是文件的问题,不是没数据 */
  function showDataError(host) {
    if (!host) return;
    host.className = '';
    host.innerHTML =
      '<div class="empty">' +
        '<div class="empty-icon">' + svg('empty') + '</div>' +
        '<h3>数据文件没能读出来</h3>' +
        '<p>assets/js/data.js 没有正常加载 —— 多半是手动编辑时漏了逗号或括号。<br>' +
        '你的片子还在文件里,没有丢。具体错在哪一行,去录入台底部的「运行日志」看,' +
        '或者按 F12 看控制台。</p>' +
        '<a class="btn btn-ghost" href="admin.html">打开录入台</a>' +
      '</div>';
  }

  var ADMIN_BTN = '<a class="btn btn-primary" href="admin.html">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                  'stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>打开录入台</a>';

  /* 单文件版切页时会重新跑一遍 init,这两个句柄放在模块级,
     保证同一时间只有一条动画循环、一个 resize 监听 —— 否则每回一次首页就多一条,
     而且旧循环还在给已经从页面上摘掉的画布画图。 */
  var netRaf = 0, netResize = null;

  /** 头图背景:一张会慢慢挪动的节点连线图,偶尔有个数据包沿线跑一下 */
  function initNetBackdrop() {
    cancelAnimationFrame(netRaf);
    if (netResize) { window.removeEventListener('resize', netResize); netResize = null; }

    var cv = document.getElementById('hero-net');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var nodes = [], links = [], packets = [], w = 0, h = 0;

    function seed() {
      var box = cv.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.width; h = box.height;
      if (!w || !h) return false;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = w < 640 ? 12 : 22;
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - .5) * .16, vy: (Math.random() - .5) * .16,
          r: Math.random() < .22 ? 3.2 : 1.8      // 少数几个是「交换机」,大一点
        });
      }
      var reach = Math.min(w, h) * (w < 640 ? .42 : .3);
      links = [];
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
          if (Math.sqrt(dx * dx + dy * dy) < reach) links.push([a, b]);
        }
      }
      packets = [];
      return true;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      links.forEach(function (l) {
        var p = nodes[l[0]], q = nodes[l[1]];
        var dx = p.x - q.x, dy = p.y - q.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var reach = Math.min(w, h) * (w < 640 ? .42 : .3);
        ctx.strokeStyle = 'rgba(41, 201, 126, ' + (0.16 * (1 - d / reach)).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      });

      nodes.forEach(function (n) {
        ctx.fillStyle = n.r > 2.5 ? 'rgba(78, 231, 155, .5)' : 'rgba(41, 201, 126, .3)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });

      packets.forEach(function (pk) {
        var l = links[pk.link];
        if (!l) return;
        var p = nodes[l[0]], q = nodes[l[1]];
        var x = p.x + (q.x - p.x) * pk.t, y = p.y + (q.y - p.y) * pk.t;
        ctx.fillStyle = 'rgba(240, 180, 74, .85)';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function tick() {
      // 画布已经不在页面上了(切页换掉了),自己停,别空转
      if (!cv.isConnected) { cancelAnimationFrame(netRaf); return; }
      nodes.forEach(function (n) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });
      packets = packets.filter(function (pk) { return (pk.t += pk.speed) < 1; });
      if (links.length && packets.length < 3 && Math.random() < .012) {
        packets.push({ link: Math.floor(Math.random() * links.length), t: 0, speed: .004 + Math.random() * .006 });
      }
      draw();
      netRaf = requestAnimationFrame(tick);
    }

    function start() {
      cancelAnimationFrame(netRaf);
      if (!seed()) return;
      if (still) draw(); else tick();
    }

    start();
    var t;
    netResize = function () { clearTimeout(t); t = setTimeout(start, 200); };
    window.addEventListener('resize', netResize);
  }

  /* =========================================================== 首页 */
  function initHome() {
    // 一部都没有:收起首页的各个区块,只留头图和一句「从这里开始」
    if (!DB_OK) return showDataError($('main'));

    if (!DB.length) {
      var hero = $('.hero');
      if (hero) hero.classList.add('is-bare');
      $$('.hero-stats, #hero-art').forEach(function (n) { n.hidden = true; });
      var acts = $('.hero-actions');
      if (acts) acts.innerHTML = ADMIN_BTN;
      $$('main > .section').forEach(function (n) { n.hidden = true; });
      var box = el('section', 'section');
      box.innerHTML = '<div class="wrap">' + emptyBlock(
        '馆里还是空的',
        '打开录入台加第一部片子 —— 填个片名和资源链接就行,首页立刻就有了。',
        ADMIN_BTN) + '</div>';
      $('main').appendChild(box);
      return;
    }

    // 统计数字
    var stats = { total: DB.length,
                  cat: new Set(DB.map(function (i) { return i.category; })).size,
                  region: new Set(DB.map(function (i) { return i.region; })).size,
                  year: new Set(DB.map(function (i) { return i.year; }).filter(Boolean)).size };
    $$('[data-stat]').forEach(function (n) { n.textContent = stats[n.dataset.stat]; });

    // 热门影视:标了 hot 的,按评分排
    var hot = DB.filter(function (i) { return i.hot; }).sort(SORTS.rating);
    fillRow($('#row-hot'), hot, '#sec-hot');

    // 最新添加:按收录日期倒序
    var recent = DB.slice().sort(SORTS.added).slice(0, 14);
    fillRow($('#row-recent'), recent, '#sec-recent');

    // 高分推荐:没填评分的不进这一区
    var top = DB.filter(function (i) { return i.rating; }).sort(SORTS.rating).slice(0, 14);
    fillRow($('#row-top'), top, '#sec-top');

    initNetBackdrop();

    // 头图右侧的装饰海报:取评分最高的三部
    var art = $('#hero-art');
    if (art) {
      DB.slice().sort(SORTS.rating).slice(0, 3).forEach(function (it) {
        art.appendChild(posterEl(it, { hover: false, name: true }));
      });
    }

    // 分类入口
    var grid = $('#cat-grid');
    if (grid) {
      var live = CATEGORIES.filter(function (c) {
        return DB.some(function (i) { return i.category === c.name; });
      });
      var secCat = $('#categories');
      if (!live.length && secCat) secCat.hidden = true;
      live.forEach(function (c) {
        var mine = DB.filter(function (i) { return i.category === c.name; });
        var count = mine.length;
        // 只列真的有片子的类型 —— 否则点进去是「没有匹配的影视」,白跑一趟。
        // 顺序:配置里的排前面,数据里出现的其它类型补在后面
        var used = {};
        mine.forEach(function (i) { i.genres.forEach(function (g) { used[g] = true; }); });
        var genres = c.genres.filter(function (g) { return used[g]; })
          .concat(Object.keys(used).filter(function (g) { return c.genres.indexOf(g) === -1; }));
        var a = el('a', 'cat-card reveal');
        a.href = 'list.html?category=' + encodeURIComponent(c.name);
        a.style.setProperty('--cat-color', c.color);
        a.innerHTML =
          '<div class="cat-head">' +
            '<span class="cat-icon">' + svg(c.icon) + '</span>' +
            '<span class="cat-name">' + esc(c.name) + '</span>' +
            '<span class="cat-count">' + count + ' 部</span>' +
          '</div>' +
          '<div class="cat-genres">' + genres.map(function (g) {
            return '<span class="chip" data-genre="' + esc(g) + '">' + esc(g) + '</span>';
          }).join('') + '</div>';
        // 点具体类型标签时,直接带着类型进片库
        $$('.chip', a).forEach(function (chip) {
          chip.addEventListener('click', function (e) {
            e.preventDefault();
            location.href = 'list.html?category=' + encodeURIComponent(c.name) +
                            '&genre=' + encodeURIComponent(chip.dataset.genre);
          });
        });
        grid.appendChild(a);
      });
    }
  }

  /** 填一行卡片;这一行没内容就把整个区块收起来 */
  function fillRow(row, items, sectionSel) {
    if (!row) return;
    var sec = sectionSel ? $(sectionSel) : null;
    if (!items.length) {
      if (sec) sec.hidden = true;
      else row.innerHTML = '';
      return;
    }
    if (sec) sec.hidden = false;
    row.insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
  }

  /* =========================================================== 片库页 */
  function initList() {
    // 一部都没有:筛选栏没有意义,直接给空态
    if (!DB_OK) {
      $$('.filters, .result-bar').forEach(function (n) { n.hidden = true; });
      return showDataError($('#grid'));
    }

    if (!DB.length) {
      $$('.filters, .result-bar').forEach(function (n) { n.hidden = true; });
      $('#grid').className = '';
      $('#grid').innerHTML = emptyBlock(
        '还没有收录任何影视',
        '在录入台里加一条,这里就会出现一张海报卡片。',
        ADMIN_BTN);
      return;
    }

    var state = { q: '', category: '全部', genre: '', year: '', region: '', sort: 'added' };
    var params = new URLSearchParams(location.search);
    ['q', 'category', 'genre', 'year', 'region', 'sort'].forEach(function (k) {
      if (params.get(k)) state[k] = params.get(k);
    });

    var grid = $('#grid');
    var tabs = $('#cat-tabs');
    var genreRow = $('#f-genre');
    var yearRow = $('#f-year');
    var regionRow = $('#f-region');
    var sortSel = $('#sort');
    var countEl = $('#result-count');
    var activeBar = $('#active-filters');
    var searchInput = $('.header-search input');

    /* --- 分类 Tab --- */
    ['全部'].concat(CATEGORIES.map(function (c) { return c.name; })).forEach(function (name) {
      var b = el('button', 'cat-tab', esc(name));
      b.type = 'button';
      b.dataset.cat = name;
      b.addEventListener('click', function () {
        state.category = name;
        state.genre = '';        // 换分类时类型标签清空,避免出现「电影 + 古装」这种空结果
        apply();
      });
      tabs.appendChild(b);
    });

    /* --- 年份:按年代分档,再加最近三年 --- */
    var years = DB.map(function (i) { return i.year; }).filter(Boolean);
    var decades = Array.from(new Set(years.map(decadeOf))).sort(function (a, b) { return b - a; });
    var yearOpts = decades.map(function (d) { return { v: d + 's', label: d + ' 年代' }; });

    /* --- 地区 --- */
    var regions = Array.from(new Set(DB.map(function (i) { return i.region; })))
      .sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); });

    function chipRow(container, opts, key) {
      container.innerHTML = '';
      var all = el('button', 'chip', '全部');
      all.type = 'button';
      all.dataset.val = '';
      container.appendChild(all);
      opts.forEach(function (o) {
        var c = el('button', 'chip', esc(o.label));
        c.type = 'button';
        c.dataset.val = o.v;
        container.appendChild(c);
      });
      container.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        state[key] = chip.dataset.val === state[key] ? '' : chip.dataset.val;
        apply();
      });
    }

    chipRow(yearRow, yearOpts, 'year');
    chipRow(regionRow, regions.map(function (r) { return { v: r, label: r }; }), 'region');

    function renderGenres() {
      var list;
      if (state.category === '全部') {
        // 全部分类时,列出所有出现过的类型(按使用频次)
        var freq = {};
        DB.forEach(function (i) { i.genres.forEach(function (g) { freq[g] = (freq[g] || 0) + 1; }); });
        list = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, 14);
      } else {
        var cfg = catOf(state.category);
        var inCat = {};
        DB.filter(function (i) { return i.category === state.category; })
          .forEach(function (i) { i.genres.forEach(function (g) { inCat[g] = true; }); });
        // 先放这个分类「官方」的类型,再补数据里实际出现的其它类型
        list = cfg.genres.filter(function (g) { return inCat[g]; })
          .concat(Object.keys(inCat).filter(function (g) { return cfg.genres.indexOf(g) === -1; }));
      }
      genreRow.innerHTML = '';
      var all = el('button', 'chip', '全部');
      all.type = 'button'; all.dataset.val = '';
      genreRow.appendChild(all);
      list.forEach(function (g) {
        var c = el('button', 'chip', esc(g));
        c.type = 'button'; c.dataset.val = g;
        genreRow.appendChild(c);
      });
    }
    genreRow.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      state.genre = chip.dataset.val === state.genre ? '' : chip.dataset.val;
      apply();
    });

    sortSel.value = state.sort;
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; apply(); });

    // 顶栏搜索框在片库页里直接过滤,不跳转
    if (searchInput) {
      var typeTimer;
      searchInput.addEventListener('input', function () {
        clearTimeout(typeTimer);
        // 连着打字时先不重绘,停手 140ms 再筛 —— 片子多了逐字重绘会明显卡顿
        typeTimer = setTimeout(function () {
          state.q = searchInput.value.trim();
          apply();
        }, 140);
      });
    }
    window.__listSearch = function (q) { state.q = q; apply(); };

    function filtered() {
      return DB.filter(function (i) {
        if (state.category !== '全部' && i.category !== state.category) return false;
        if (state.genre && i.genres.indexOf(state.genre) === -1) return false;
        if (state.year) {
          var d = parseInt(state.year, 10);
          if (decadeOf(i.year) !== d) return false;
        }
        if (state.region && i.region !== state.region) return false;
        if (!matchQuery(i, state.q)) return false;
        return true;
      }).sort(SORTS[state.sort] || SORTS.added);
    }

    function syncUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.category !== '全部') p.set('category', state.category);
      if (state.genre) p.set('genre', state.genre);
      if (state.year) p.set('year', state.year);
      if (state.region) p.set('region', state.region);
      if (state.sort !== 'added') p.set('sort', state.sort);
      var qs = p.toString();
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    function renderActive() {
      var pills = [];
      if (state.q) pills.push({ k: 'q', label: '搜索:' + state.q });
      if (state.category !== '全部') pills.push({ k: 'category', label: state.category });
      if (state.genre) pills.push({ k: 'genre', label: state.genre });
      if (state.year) pills.push({ k: 'year', label: parseInt(state.year, 10) + ' 年代' });
      if (state.region) pills.push({ k: 'region', label: state.region });
      activeBar.innerHTML = pills.map(function (p) {
        return '<button type="button" class="chip is-on" data-key="' + p.k + '">' + esc(p.label) + '</button>';
      }).join('');
      activeBar.hidden = !pills.length;
    }
    activeBar.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var k = chip.dataset.key;
      state[k] = k === 'category' ? '全部' : '';
      if (k === 'q' && searchInput) {
        searchInput.value = '';
        searchInput.parentNode.classList.remove('has-value');
      }
      apply();
    });

    function apply() {
      renderGenres();
      $$('.cat-tab', tabs).forEach(function (b) { b.classList.toggle('is-on', b.dataset.cat === state.category); });
      $$('.chip', genreRow).forEach(function (c) { c.classList.toggle('is-on', c.dataset.val === state.genre); });
      $$('.chip', yearRow).forEach(function (c) { c.classList.toggle('is-on', c.dataset.val === state.year); });
      $$('.chip', regionRow).forEach(function (c) { c.classList.toggle('is-on', c.dataset.val === state.region); });

      var list = filtered();
      countEl.innerHTML = '共 <b>' + list.length + '</b> 部';
      grid.innerHTML = '';
      if (!list.length) {
        grid.className = '';
        grid.appendChild(el('div', 'empty',
          '<div class="empty-icon">' + svg('empty') + '</div>' +
          '<h3>没有匹配的影视</h3>' +
          '<p>换个关键词,或者把筛选条件放宽一些</p>' +
          '<button type="button" class="btn btn-ghost" id="reset">清空全部筛选</button>'));
        $('#reset').addEventListener('click', function () {
          state = { q: '', category: '全部', genre: '', year: '', region: '', sort: state.sort };
          if (searchInput) { searchInput.value = ''; searchInput.parentNode.classList.remove('has-value'); }
          apply();
        });
      } else {
        grid.className = 'poster-grid';
        grid.innerHTML = list.map(cardHTML).join('');
      }
      renderActive();
      syncUrl();
    }

    apply();
  }

  /* =========================================================== 详情页 */
  function initDetail() {
    var id = new URLSearchParams(location.search).get('id');
    var item = null;
    for (var i = 0; i < DB.length; i++) if (DB[i].id === id) { item = DB[i]; break; }

    var root = $('#detail');
    if (!DB_OK) return showDataError(root);
    if (!item) {
      LOG.warn('详情页找不到这条', 'id=' + id);
      document.title = '未找到该影视 · ' + ((window.SITE && window.SITE.full) || '影视收藏馆');
      root.innerHTML =
        '<div class="empty">' +
          '<div class="empty-icon">' + svg('empty') + '</div>' +
          '<h3>没有这部影视</h3>' +
          '<p>链接可能失效了,或者它还没被收录进来</p>' +
          '<a class="btn btn-primary" href="list.html">去片库看看</a>' +
        '</div>';
      return;
    }

    document.title = item.title + ' · ' + ((window.SITE && window.SITE.full) || '影视收藏馆');
    var cfg = catOf(item.category);
    var h = hueOf(item.title + item.category);

    var bg = $('#detail-bg');
    if (bg) bg.style.background =
      'radial-gradient(90% 70% at 22% 0%, hsl(' + h + ',48%,26%), transparent 70%),' +
      'radial-gradient(80% 60% at 85% 12%, hsl(' + ((h + 42) % 360) + ',52%,22%), transparent 68%)';

    $('#crumb-cat').textContent = item.category;
    $('#crumb-cat').href = 'list.html?category=' + encodeURIComponent(item.category);
    $('#crumb-title').textContent = item.title;

    $('#d-poster').appendChild(posterEl(item, { hover: false, name: true }));

    var facts = [
      item.rating ? '<span class="detail-score"><b>' + item.rating.toFixed(1) + '</b><span>/ 10</span></span>' : '',
      '<span>' + esc(item.year || '—') + '</span>',
      '<span class="dot">·</span><span>' + esc(item.category) + '</span>',
      '<span class="dot">·</span><span>' + esc(item.region) + '</span>'
    ].join('');

    // 内网地址:按接入先后给一个 192.168.x.y,是真实顺序算出来的,不是编的
    var order = DB.slice().sort(function (a, b) {
      if (!a.added !== !b.added) return a.added ? -1 : 1;   // 同上,没日期的排最后
      return a.added < b.added ? -1 : a.added > b.added ? 1 : a.title.localeCompare(b.title, 'zh-Hans-CN');
    }).map(function (x) { return x.id; }).indexOf(item.id) + 1;
    var ip = '192.168.' + (Math.floor((order - 1) / 254) + 1) + '.' + ((order - 1) % 254 + 1);

    var info =
      '<div class="info-item"><dt>地址</dt><dd class="hull-no">' + ip + '</dd></div>' +
      '<div class="info-item"><dt>年份</dt><dd>' + esc(item.year || '未填') + '</dd></div>' +
      '<div class="info-item"><dt>类型</dt><dd><div class="chips">' +
        '<a class="tag" href="list.html?category=' + encodeURIComponent(item.category) + '">' + esc(item.category) + '</a>' +
        item.genres.map(function (g) {
          return '<a class="tag" href="list.html?genre=' + encodeURIComponent(g) + '">' + esc(g) + '</a>';
        }).join('') +
      '</div></dd></div>' +
      '<div class="info-item"><dt>地区</dt><dd><a class="tag" href="list.html?region=' +
        encodeURIComponent(item.region) + '">' + esc(item.region) + '</a></dd></div>' +
      (item.director ? '<div class="info-item"><dt>导演</dt><dd>' + esc(item.director) + '</dd></div>' : '') +
      '<div class="info-item"><dt>接入</dt><dd>' + esc(item.added || '未填') + '</dd></div>';

    var resUrl = safeUrl(item.resource);
    if (item.resource && !resUrl) LOG.warn('资源链接不是有效地址,已忽略', item.title + ' → ' + item.resource);

    var actors = (item.actors || []).map(function (a) {
      var ah = hueOf(a);
      return '<span class="actor"><span class="actor-avatar" style="background:hsl(' + ah + ',52%,62%)">' +
             esc(a.charAt(0)) + '</span>' + esc(a) + '</span>';
    }).join('');

    $('#d-body').innerHTML =
      '<h1 class="detail-title">' + esc(item.title) + '</h1>' +
      '<div class="detail-facts">' + facts + '</div>' +
      '<dl class="info-list">' + info + '</dl>' +
      (actors ? '<div class="detail-block"><h2>演员</h2><div class="actor-list">' + actors + '</div></div>' : '') +
      '<div class="detail-block"><h2>简介</h2><p class="detail-desc">' + esc(item.description) + '</p></div>' +
      '<div class="detail-actions">' +
        (resUrl
          ? '<a class="btn btn-primary" href="' + esc(resUrl) + '" target="_blank" rel="noopener">' +
              svg('play') + '资源入口</a>'
          : '<span class="btn" aria-disabled="true">' + svg('link') + '暂无资源链接</span>') +
        '<a class="btn btn-ghost" href="list.html?category=' + encodeURIComponent(item.category) + '">' +
          svg('grid') + '更多' + esc(item.category) + '</a>' +
        (resUrl
          ? (item.resourceNote
              ? '<p class="resource-note">' + esc(item.resourceNote) + '</p>'
              : '')
          : '<p class="resource-note">' + (item.resource
              ? '这条的资源链接不是有效地址,录入台里改一下。'
              : '用 admin.html(录入台)或直接改 assets/js/data.js 填上 resource 字段,按钮就会亮起来。') + '</p>') +
      '</div>';

    // 相关推荐:同分类下类型标签重合最多的
    var related = DB.filter(function (i) { return i.id !== item.id && i.category === item.category; })
      .map(function (i) {
        var overlap = i.genres.filter(function (g) { return item.genres.indexOf(g) > -1; }).length;
        return { item: i, score: overlap * 10 + (i.region === item.region ? 2 : 0) + (i.rating || 0) / 10 };
      })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 12)
      .map(function (x) { return x.item; });
    fillRow($('#row-related'), related);
    var rel = $('#related-section');
    if (rel) rel.hidden = related.length === 0;
  }

  /* ------------------------------------------------------------ 启动 */
  document.addEventListener('DOMContentLoaded', function () {
    applySite();
    initHeader();
    initNav();
    var page = document.body.dataset.page;
    if (page === 'home')   initHome();
    if (page === 'list')   initList();
    if (page === 'detail') initDetail();
    initRows();
    initReveal();
  });

  // 供页面内联脚本 / 调试使用
  window.MC = { CATEGORIES: CATEGORIES, search: search, cardEl: cardEl, cardHTML: cardHTML, svg: svg, safeUrl: safeUrl };
})();
