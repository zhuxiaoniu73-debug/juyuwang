# CMS 集合:影视库

本站的数据源是 `assets/js/data.js`,纯静态、零依赖。
如果要把内容搬进 Webflow(或任何 headless CMS)托管,按下面这张表建集合即可,
字段名和本站的数据字段是一一对应的。

## 集合设置

| 项目 | 值 |
|---|---|
| 集合名称 | 影视库 |
| Collection URL | `/ying-shi` |
| 单条 URL | `/ying-shi/{slug}` |

## 字段

| 字段名 | Webflow 字段类型 | 必填 | 对应 data.js | 说明 |
|---|---|:--:|---|---|
| **Name**(影视名称) | Plain text | 是 | `title` | 集合自带的标题字段 |
| **Slug** | Slug | 是 | `id` | 详情页地址,只用小写字母、数字和短横线 |
| **Image**(影视封面) | Image | 否 | `poster` | 留空时本站会按片名生成一张配色海报 |
| **Category**(分类) | Option | 是 | `category` | 选项:电影 / 电视剧 / 综艺 / 纪录片 |
| **Genre**(类型标签) | Multi-reference → 类型 集合<br>(或 Plain text) | 是 | `genres` | CSV 里用 `; ` 分隔,如 `战争; 历史` |
| **Year**(年份) | Number(整数) | 是 | `year` | 如 `2005` |
| **Region**(地区) | Plain text 或 Option | 是 | `region` | 如 中国 / 中国香港 / 中国台湾 / 美国 / 英国 |
| **Actors**(演员信息) | Plain text(多行) | 否 | `actors` | CSV 里用 `; ` 分隔 |
| **Description**(影视简介) | Rich text | 否 | `description` | |
| **Resource URL**(资源入口链接) | Link | 否 | `resource` | 详情页「资源入口」按钮;留空按钮置灰 |
| **Resource Note**(提取码/说明) | Plain text | 否 | `resourceNote` | 网盘提取码之类,显示在资源按钮下面 |
| **Added**(收录日期) | Date | 否 | `added` | 首页「最新添加」按它倒序 |
| **Featured**(热门) | Switch | 否 | `hot` | 打开的会进首页「热门影视」 |
| **Rating**(评分) | Number(1 位小数) | 否 | `rating` | 0–10,海报右上角角标 |
| **Director**(导演) | Plain text | 否 | `director` | |

### 如果 Genre 用 Multi-reference

再建一个集合 **类型**,只要 Name + Slug 两个字段,把这些值建好:

- 电影:恐怖、喜剧、动作、科幻、爱情
- 电视剧:战争、古装、悬疑、都市
- 综艺:真人秀、音乐、脱口秀
- 纪录片:历史、自然、科技

用 Plain text 更省事,但 Multi-reference 才能在 Webflow 里做标签筛选页。

## 导入现有数据

先跑一下导出,把当前 `assets/js/data.js` 里的内容变成 CSV(列名就是上表的字段名):

```bash
node data/export-csv.js      # 生成 data/影视库.csv
```

1. 在 Webflow 里按上表建好集合和字段
2. 集合页右上角 → **Import** → 上传刚生成的 `data/影视库.csv`
3. 逐列确认映射关系(列名一致时 Webflow 会自动配好)
4. Image 列为空属正常 —— 导入后再逐条上传封面

## 反过来:从 CMS 回到本站

本站不依赖 Webflow,只吃 `window.MEDIA_DB` 这个数组。
从 CMS 导出 CSV 后,按 `data.js` 顶部注释里的字段格式转成对象数组贴回去即可,
`genres`、`actors` 记得从 `; ` 分隔的字符串还原成数组。
