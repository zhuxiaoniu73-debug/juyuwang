/* 影视收藏馆 · 海报上传模块
 * ------------------------------------------------------------------
 * 一处实现,录入台和详情页共用。
 *
 * 压缩:先按手机照片的方向摆正(createImageBitmap 能读 EXIF),再缩到
 *      海报比例内,然后从 0.82 画质往下试,直到体积落进目标区间。
 *      同一张图不同设备拍出来大小差很多,固定画质要么糊要么撑爆 localStorage。
 *
 * 存放:详情页传的图先存在浏览器本地(mc-posters),站点立刻就能看到;
 *      录入台会提示「有 N 张还没写进 data.js」,一键并进草稿再导出才算落盘。
 */
(function () {
  'use strict';

  var KEY = 'mc-posters';
  var MAX_W = 480, MAX_H = 720;      // 海报 2:3,给到这个尺寸在手机上足够清晰
  var TARGET = 70 * 1024;            // 单张目标上限,约 70 KB
  var FLOOR_Q = 0.45;                // 画质下限,再低就糊了
  var LOG = window.MCLog || { info: function () {}, warn: function () {}, error: function () {} };

  /* ------------------------------------------------------------ 压缩 */

  /** 把 File 读成可以画到 canvas 上的东西,顺带按 EXIF 摆正手机照片 */
  function load(file, cb, fail) {
    if (window.createImageBitmap) {
      // 这条路会按 EXIF 自动转向 —— 竖着拍的海报不会躺下
      createImageBitmap(file, { imageOrientation: 'from-image' }).then(cb, function () {
        loadViaImg(file, cb, fail);
      });
    } else {
      loadViaImg(file, cb, fail);
    }
  }

  function loadViaImg(file, cb, fail) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () { cb(img); };
      img.onerror = function () { fail('图片读不出来,换一张试试'); };
      img.src = r.result;
    };
    r.onerror = function () { fail('文件读取失败'); };
    r.readAsDataURL(file);
  }

  /**
   * compress(file, done, fail)
   *   done(dataURI, info)   info = { w, h, bytes, quality, from }
   *   fail(理由)
   */
  function compress(file, done, fail) {
    fail = fail || function () {};
    if (!file) return fail('没选到文件');
    if (!/^image\//.test(file.type)) return fail('这不是图片文件');
    if (file.size > 25 * 1024 * 1024) return fail('图片太大了(超过 25 MB)');

    load(file, function (src) {
      try {
        var sw = src.width, sh = src.height;
        var scale = Math.min(MAX_W / sw, MAX_H / sh, 1);
        var w = Math.max(1, Math.round(sw * scale));
        var h = Math.max(1, Math.round(sh * scale));

        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, 0, 0, w, h);
        if (src.close) src.close();

        // 从 0.82 往下试,落进目标体积就停
        var q = 0.82, out = cv.toDataURL('image/jpeg', q);
        while (out.length * 0.75 > TARGET && q > FLOOR_Q) {
          q = Math.round((q - 0.1) * 100) / 100;
          out = cv.toDataURL('image/jpeg', q);
        }
        // 还是太大就再缩一档尺寸
        if (out.length * 0.75 > TARGET && w > 320) {
          var cv2 = document.createElement('canvas');
          cv2.width = Math.round(w * 0.72); cv2.height = Math.round(h * 0.72);
          cv2.getContext('2d').drawImage(cv, 0, 0, cv2.width, cv2.height);
          out = cv2.toDataURL('image/jpeg', 0.7);
          w = cv2.width; h = cv2.height;
        }

        var info = { w: w, h: h, bytes: Math.round(out.length * 0.75), quality: q,
                     from: sw + '×' + sh + ' / ' + Math.round(file.size / 1024) + ' KB' };
        LOG.info('压好一张海报', info.from + ' → ' + w + '×' + h + ' / ' +
                 Math.round(info.bytes / 1024) + ' KB(画质 ' + q + ')');
        done(out, info);
      } catch (e) {
        LOG.error('海报压缩失败', String(e && e.message));
        fail('这张图处理不了:' + (e && e.message));
      }
    }, fail);
  }

  /* -------------------------------------------------- 本地海报(未落盘) */

  function readAll() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return (v && typeof v === 'object') ? v : {};
    } catch (e) { return {}; }
  }

  function writeAll(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map));
      return true;
    } catch (e) {
      LOG.error('本地海报存不下了', '浏览器配额满了,先去录入台并入 data.js 再导出');
      return false;
    }
  }

  window.MCPoster = {
    MAX_W: MAX_W, MAX_H: MAX_H, TARGET: TARGET,
    compress: compress,

    /** 取某部片子的本地海报 */
    get: function (id) { return readAll()[id] || ''; },
    /** 全部本地海报 { id: dataURI } */
    all: readAll,
    count: function () { return Object.keys(readAll()).length; },

    set: function (id, dataURI) {
      var m = readAll();
      m[id] = dataURI;
      var ok = writeAll(m);
      if (ok) LOG.info('存了一张本地海报', id);
      return ok;
    },
    remove: function (id) {
      var m = readAll();
      if (!(id in m)) return false;
      delete m[id];
      writeAll(m);
      LOG.info('删了一张本地海报', id);
      return true;
    },
    clear: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      LOG.info('清空本地海报');
    },
    /** 大致占了多少空间 */
    bytes: function () {
      var m = readAll(), n = 0;
      for (var k in m) if (m.hasOwnProperty(k)) n += m[k].length * 0.75;
      return Math.round(n);
    }
  };
})();
