# -*- coding: utf-8 -*-
"""把整站打包成一个 HTML 文件,方便存手机里离线看,或者发给别人。

用法(在项目根目录):
    python3 tools/打包单文件.py              # 用 assets/js/data.js 里的数据
    python3 tools/打包单文件.py -o 我的片库.html
    python3 tools/打包单文件.py --bare        # 不带 <html>/<head> 外壳,给内嵌场景用

打出来的文件把 CSS、数据、脚本全部内联,三个页面用 #/ 路由切换:
    #/                首页
    #/list?category=  片库
    #/detail?id=      详情
没有外链、不联网,双击就能开。录入台(admin.html)不在里面 —— 它要写文件,
单文件版只用来看。
"""
import io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: io.open(os.path.join(ROOT, *p), encoding='utf-8').read()


def inline_js(s):
    """内联进 <script> 之前必须处理:HTML 解析器见到 </script 就结束脚本块,
    简介里从网页复制来一段带 </script> 的文字,整个单文件版就废了。
    在 JS 字符串里 <\/script 和 </script 等价,所以这样改不影响内容。"""
    return s.replace('</script', '<\\/script').replace('<!--', '<!\\--')


def js_str(s):
    """把一段 HTML 变成 JS 单引号字符串"""
    return "'" + (s.replace('\\', '\\\\').replace("'", "\\'")
                   .replace('\r', '').replace('\n', "\\n")) + "'"


def main_of(name):
    s = read(name)
    return s[s.index('<main'):s.index('</main>') + len('</main>')]


def hashify(s):
    """站内链接改成 hash 路由"""
    for a, b in [('href="index.html#categories"', 'href="#/categories"'),
                 ('href="index.html"',            'href="#/"'),
                 ('href="list.html#q"',           'href="#/list"'),
                 ('href="list.html?',             'href="#/list?'),
                 ('href="list.html"',             'href="#/list"'),
                 ('href="#categories"',           'href="#/categories"')]:
        s = s.replace(a, b)
    # 录入台要写文件,单文件版里去掉入口
    s = s.replace('    <a href="admin.html">录入台</a>\n', '')
    return s


def build(bare=False):
    css = read('assets', 'css', 'style.css')

    data_js = read('assets', 'js', 'data.js')

    log_js = read('assets', 'js', 'log.js')
    site_js = read('assets', 'js', 'site.js')
    app = read('assets', 'js', 'app.js')
    app = app.replace('detail.html?id=', '#/detail?id=')
    app = app.replace('list.html?', '#/list?')
    app = app.replace('href="list.html"', 'href="#/list"')
    app = app.replace('new URLSearchParams(location.search)', 'new URLSearchParams(ROUTE.q)')
    app = app.replace(
        """history.replaceState(null, '', qs ? '?' + qs : location.pathname);""",
        """history.replaceState(null, '', qs ? '#/list?' + qs : '#/list');""")

    # 空态里的「打开录入台」在单文件版里点不了
    app = app.replace(
"""  var ADMIN_BTN = '<a class="btn btn-primary" href="admin.html">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
                  'stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>打开录入台</a>';""",
"""  var ADMIN_BTN = '<a class="btn btn-primary" href="#/list">去片库看看</a>';""")
    # 单文件版里点不开录入台,把提到它的那句换掉
    app = app.replace(
        "'用 admin.html(录入台)或直接改 assets/js/data.js 填上 resource 字段,按钮就会亮起来。'",
        "'这条还没填资源链接。'")
    # 数据出错提示里的录入台按钮,单文件版点不开,去掉
    app = app.replace(
        "'<a class=\"btn btn-ghost\" href=\"admin.html\">打开录入台</a>' +",
        "'' +")

    old_boot = """  document.addEventListener('DOMContentLoaded', function () {
    applySite();
    initHeader();
    initNav();
    var page = document.body.dataset.page;
    if (page === 'home')   initHome();
    if (page === 'list')   initList();
    if (page === 'detail') initDetail();
    initRows();
    initReveal();
  });"""
    new_boot = """  /* ---- 单文件版的路由:#/ 首页,#/list 片库,#/detail?id= 详情 ---- */
  var ROUTE = { page: 'home', q: '' };

  function parseHash() {
    var h = location.hash.replace(/^#\\/?/, '');
    var i = h.indexOf('?');
    var name = (i > -1 ? h.slice(0, i) : h) || 'home';
    ROUTE.q = i > -1 ? h.slice(i) : '';
    var wantCat = name === 'categories';
    if (wantCat || !window.__TPL[name]) name = 'home';
    ROUTE.page = name;
    return wantCat;
  }

  function render() {
    var wantCat = parseHash();
    document.body.dataset.page = ROUTE.page;
    document.getElementById('view').innerHTML = window.__TPL[ROUTE.page];
    applySite();
    initNav();
    if (ROUTE.page === 'home')   initHome();
    if (ROUTE.page === 'list')   initList();
    if (ROUTE.page === 'detail') initDetail();
    initRows();
    initReveal();
    if (wantCat) {
      var sec = document.getElementById('categories');
      if (sec) { sec.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    window.scrollTo(0, 0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    applySite();
    initHeader();
    render();
    window.addEventListener('hashchange', render);
  });"""
    assert old_boot in app, 'app.js 的启动段变了,打包脚本要跟着改'
    app = app.replace(old_boot, new_boot)
    assert 'admin.html' not in app

    chrome = read('index.html')
    _h = chrome.index('<header class="site-header">')
    header = chrome[_h:chrome.index('</header>', _h) + len('</header>')]
    _f = chrome.index('<footer class="site-footer">')
    footer = chrome[_f:chrome.index('</footer>', _f) + len('</footer>')]
    # 从底栏开头往后找第一个 </nav>,别依赖它后面紧跟着什么
    _tb = chrome.index('<nav class="tab-bar"')
    tabbar = chrome[_tb:chrome.index('</nav>', _tb) + len('</nav>')]
    header, footer, tabbar = hashify(header), hashify(footer), hashify(tabbar)

    tpl = {k: hashify(main_of(k + '.html' if k != 'home' else 'index.html'))
           for k in ('home', 'list', 'detail')}
    tpl_js = 'window.__TPL = {\n' + ',\n'.join(
        '  %s: %s' % (k, js_str(v)) for k, v in tpl.items()) + '\n};'

    head = u'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#07070a">
'''
    body = u'''<title>影视收藏馆</title>
<style>
%s

/* ——— 单文件版补丁 ——— */
.reveal { opacity: 1 !important; transform: none !important; }
</style>

%s

<div id="view"></div>

%s

%s

<script>window.MC_SINGLE = true;</script>
<script>
%s
</script>
<script>
%s
</script>
<script>
%s
</script>
<script>
%s
</script>
<script>
%s
</script>
''' % (css, header, footer, tabbar, inline_js(log_js),
       inline_js(site_js), inline_js(data_js), inline_js(tpl_js), inline_js(app))

    return body if bare else (head + body + u'</body>\n</html>\n')


if __name__ == '__main__':
    args = sys.argv[1:]
    bare = '--bare' in args
    out = '影视收藏馆-单文件版.html'
    if '-o' in args:
        out = args[args.index('-o') + 1]
    html = build(bare)
    path = out if os.path.isabs(out) else os.path.join(ROOT, out)
    io.open(path, 'w', encoding='utf-8').write(html)
    print('已生成 %s (%.0f KB)' % (path, len(html.encode('utf-8')) / 1024.0))
