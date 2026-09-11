/* 影视收藏馆 · 数据层
 * ---------------------------------------------------------------
 * 这里就是整站的「数据库」。默认是空的 —— 你加一条,站上就出现一条。
 * 加片子最省事的办法是打开 admin.html(录入台),填完导出覆盖本文件;
 * 也可以照下面注释里的样子直接手写。首页、片库、详情页会自动跟着变。
 *
 * 字段说明(与 Webflow CMS 集合「影视库」一一对应,见 data/webflow-cms.md):
 *   id          唯一标识,详情页靠它取数据(detail.html?id=xxx),只能用字母数字和短横线
 *   title       影视名称        Title
 *   poster      封面图地址      Image        留空则自动生成一张配色海报
 *   category    分类           Category     电影 / 电视剧 / 综艺 / 纪录片
 *   genres      类型标签        Genre        数组,第一个是主类型
 *   year        年份           Year
 *   region      地区           Region
 *   actors      演员           Actors       数组
 *   director    导演           (可选)
 *   rating      评分           (可选,0-10)
 *   description 简介           Description
 *   resource    资源入口链接    Resource URL 留空则详情页按钮置灰
 *   resourceNote 提取码/说明    Resource Note(可选,显示在资源按钮下面)
 *   added       接入日期        (YYYY-MM-DD,首页「新近接入」按它排序)
 *   hot         是否热门        (true 会进首页「热门影视」)
 */

window.MEDIA_DB = [

  // 从这里开始加。下面是一条完整的样子,复制出去改内容即可:
  //
  // {
  //   id: '亮剑',                       // 详情页地址 detail.html?id=亮剑,中文可以直接用,别重复
  //   title: '亮剑',
  //   category: '电视剧',                // 电影 / 电视剧 / 综艺 / 纪录片
  //   genres: ['战争', '历史'],          // 类型标签,第一个是主类型
  //   year: 2005,
  //   region: '中国',
  //   actors: ['李幼斌', '何政军'],
  //   director: '陈健 / 张前',           // 可省
  //   rating: 9.5,                      // 可省
  //   description: '八路军独立团团长李云龙……',
  //   resource: 'https://pan.quark.cn/s/abc123',   // 资源入口链接
  //   resourceNote: '提取码 8k2p',                  // 可省
  //   added: '2026-09-10',
  //   hot: true                         // true 会进首页「热门影视」
  // }

];
