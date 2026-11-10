(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); } else { document.addEventListener('DOMContentLoaded', fn); }
  }

  ready(function () {
    var body = document.body;
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.getElementById('site-navigation');
    var header = document.getElementById('masthead');

    // tahun di footer
    var years = document.querySelectorAll('.js-year');
    for (var i = 0; i < years.length; i++) { years[i].textContent = new Date().getFullYear(); }

    // header berbayang ketika halaman di-scroll
    if (header) {
      var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 4); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // isi kotak cari di header dengan kata kunci yang sedang dicari
    var field = document.getElementById('search-field');
    var m = /[?&]s=([^&#]*)/.exec(location.search);
    if (field && m) {
      try { field.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (err) { }
    }

    // gambar kartu yang gagal dimuat (link mati, mis. CDN Facebook lama) -> placeholder
    var thumbs = document.querySelectorAll('.news-card-thumb img');
    var toPlaceholder = function (img) {
      var span = document.createElement('span');
      span.className = 'news-card-noimg';
      if (img.parentNode) { img.parentNode.replaceChild(span, img); }
    };
    for (var t = 0; t < thumbs.length; t++) {
      (function (img) {
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) { toPlaceholder(img); return; }
        img.addEventListener('error', function () { toPlaceholder(img); });
      })(thumbs[t]);
    }

    initLightbox();
    var shares = document.querySelectorAll('.share');
    for (var sh = 0; sh < shares.length; sh++) { initShare(shares[sh]); }

    if (!toggle || !nav) { return; }

    function setOpen(open) {
      body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      setOpen(!body.classList.contains('nav-open'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && body.classList.contains('nav-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // tutup menu mobile saat layar diperlebar ke ukuran desktop
    var mq = window.matchMedia('(min-width: 900px)');
    var onChange = function (e) { if (e.matches) { setOpen(false); } };
    if (mq.addEventListener) { mq.addEventListener('change', onChange); } else if (mq.addListener) { mq.addListener(onChange); }
  });

  /* ------------------------------------------------------------------------
     Tombol bagikan (markup di modules/wpnews/detail.html).
     - link WhatsApp/Facebook/X/Telegram sudah jalan tanpa JS; di sini judul
       berita ditambahkan ke teks share (template tidak punya filter urlencode)
     - "salin tautan" dan share bawaan HP baru ditampilkan bila browser
       mendukungnya: tidak ada tombol yang tidak berfungsi
     ------------------------------------------------------------------------ */
  function initShare(root) {
    var en = (document.documentElement.lang || '').toLowerCase().slice(0, 2) === 'en';
    var MSG = en
      ? { copied: 'Link copied.', copyFail: 'Could not copy the link. Copy it from the address bar.' }
      : { copied: 'Tautan berita sudah disalin.', copyFail: 'Tautan tidak bisa disalin otomatis. Salin dari kolom alamat browser.' };
    var url = root.getAttribute('data-share-url') || location.href;
    var h1 = document.querySelector('.entry-title');
    var title = ((h1 && h1.textContent) || document.title).replace(/\s+/g, ' ').trim();
    var u = encodeURIComponent(url), t = encodeURIComponent(title);
    var links = {
      whatsapp: 'https://wa.me/?text=' + t + '%0A' + u,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
      x: 'https://x.com/intent/post?text=' + t + '&url=' + u,
      telegram: 'https://t.me/share/url?url=' + u + '&text=' + t
    };
    Array.prototype.forEach.call(root.querySelectorAll('a[data-share]'), function (a) {
      var href = links[a.getAttribute('data-share')];
      if (href) { a.href = href; }
    });

    var status = root.querySelector('.share-status'), timer = null;
    function say(msg) {
      status.textContent = msg;
      clearTimeout(timer);
      timer = setTimeout(function () { status.textContent = ''; }, 4000);
    }

    var copyBtn = root.querySelector('[data-share="copy"]');
    if (copyBtn && navigator.clipboard && window.isSecureContext) {
      copyBtn.parentNode.hidden = false;
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(url).then(function () {
          copyBtn.classList.add('is-done');
          setTimeout(function () { copyBtn.classList.remove('is-done'); }, 1500);
          say(MSG.copied);
        }, function () { say(MSG.copyFail); });
      });
    }

    var nativeBtn = root.querySelector('[data-share="native"]');
    if (nativeBtn && navigator.share) {
      nativeBtn.parentNode.hidden = false;
      nativeBtn.addEventListener('click', function () {
        // dibatalkan pengguna -> AbortError, tidak perlu pesan
        navigator.share({ title: title, url: url }).catch(function () { });
      });
    }
  }

  /* ------------------------------------------------------------------------
     Lightbox: gambar di isi artikel dibuka sebagai popup saat diketuk.
     - gambar tanpa link              -> popup
     - link ke file gambar (WordPress "link to media file") -> popup, pakai
       gambar dari href (resolusi penuh)
     - link lain (halaman, Play Store, dll.) -> tetap mengikuti link
     ------------------------------------------------------------------------ */
  function largestSrc(img) {
    // ambil kandidat terbesar dari srcset bila ada
    var best = img.currentSrc || img.src, bestW = 0;
    var srcset = img.getAttribute('srcset');
    if (srcset) {
      srcset.split(',').forEach(function (part) {
        var bits = part.trim().split(/\s+/), w = parseInt(bits[1], 10) || 0;
        if (bits[0] && w > bestW) { bestW = w; best = bits[0]; }
      });
    }
    return best;
  }

  function captionOf(img) {
    var fig = img.closest('figure');
    var cap = fig && fig.querySelector('figcaption');
    return (cap && cap.textContent.trim()) || img.getAttribute('alt') || '';
  }

  function initLightbox() {
    // didefinisikan di sini, bukan di level atas: ready() bisa memanggil
    // initLightbox sebelum baris-baris di bawah IIFE dieksekusi
    var IMAGE_URL = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i;
    var items = [];
    var scopes = document.querySelectorAll('.entry-content');
    for (var s = 0; s < scopes.length; s++) {
      var imgs = scopes[s].querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i], link = img.closest('a'), full;
        if (link) {
          var href = link.getAttribute('href') || '';
          if (!IMAGE_URL.test(href)) { continue; } // link sungguhan: biarkan
          full = link.href;
        } else {
          full = largestSrc(img);
        }
        items.push({ img: img, link: link, src: full, caption: captionOf(img) });
      }
    }
    if (!items.length) { return; }

    // markup popup
    var box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Gambar');
    box.hidden = true;
    box.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Tutup">&times;</button>' +
      '<button type="button" class="lightbox-nav lightbox-prev" aria-label="Sebelumnya">&#8249;</button>' +
      '<figure class="lightbox-figure"><img class="lightbox-img" alt=""><figcaption class="lightbox-caption"></figcaption></figure>' +
      '<button type="button" class="lightbox-nav lightbox-next" aria-label="Berikutnya">&#8250;</button>' +
      '<div class="lightbox-counter" aria-live="polite"></div>';
    document.body.appendChild(box);

    var bigImg = box.querySelector('.lightbox-img');
    var caption = box.querySelector('.lightbox-caption');
    var counter = box.querySelector('.lightbox-counter');
    var btnClose = box.querySelector('.lightbox-close');
    var btnPrev = box.querySelector('.lightbox-prev');
    var btnNext = box.querySelector('.lightbox-next');
    var current = -1, lastFocus = null, multi = items.length > 1;

    if (!multi) { btnPrev.hidden = true; btnNext.hidden = true; }

    function show(index) {
      current = (index + items.length) % items.length;
      var it = items[current];
      box.classList.add('is-loading');
      bigImg.onload = bigImg.onerror = function () { box.classList.remove('is-loading'); };
      bigImg.src = it.src;
      bigImg.alt = it.img.getAttribute('alt') || '';
      caption.textContent = it.caption;
      caption.hidden = !it.caption;
      counter.textContent = multi ? (current + 1) + ' / ' + items.length : '';
    }

    function open(index) {
      lastFocus = document.activeElement;
      show(index);
      box.hidden = false;
      document.body.classList.add('lightbox-open');
      btnClose.focus();
    }

    function close() {
      box.hidden = true;
      bigImg.removeAttribute('src');
      document.body.classList.remove('lightbox-open');
      if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }

    items.forEach(function (it, index) {
      var target = it.link || it.img;
      it.img.classList.add('is-zoomable');
      if (!it.link) {
        it.img.setAttribute('tabindex', '0');
        it.img.setAttribute('role', 'button');
      }
      target.addEventListener('click', function (e) { e.preventDefault(); open(index); });
      target.addEventListener('keydown', function (e) {
        if (!it.link && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(index); }
      });
    });

    btnClose.addEventListener('click', close);
    btnPrev.addEventListener('click', function () { show(current - 1); });
    btnNext.addEventListener('click', function () { show(current + 1); });
    // ketuk area gelap di luar gambar untuk menutup
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lightbox-figure')) { close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (box.hidden) { return; }
      if (e.key === 'Escape') { close(); }
      else if (multi && e.key === 'ArrowLeft') { show(current - 1); }
      else if (multi && e.key === 'ArrowRight') { show(current + 1); }
      else if (e.key === 'Tab') {
        // fokus tetap di dalam popup
        var f = [btnClose, btnPrev, btnNext].filter(function (b) { return !b.hidden; });
        var at = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(at + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    });

    // geser kiri/kanan di layar sentuh
    var startX = 0, startY = 0;
    box.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (!multi) { return; }
      var dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { show(current + (dx < 0 ? 1 : -1)); }
    }, { passive: true });
  }
})();
