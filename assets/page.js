/* ============================================================
   page.js — поведение страницы справочника
   Общий файл для всех страниц. Три независимых блока, каждый
   сам проверяет наличие своих элементов:
     • поиск по странице (#refSearch) — на листах;
     • навигация — [ и ], n, /, подсветка цели, скролл-спай;
     • фильтр «Указателя» (#idxFilter) — на странице указателя.
   ============================================================ */

(function () {
  var toc = document.getElementById('toc');
  var input = document.getElementById('refSearch');
  var list = document.getElementById('refSearchResults');
  if (!toc || !input || !list) return;

  var entries = [];
  var sections = document.querySelectorAll('main.reference section[id]');
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    if (sec.id === 'toc') continue;
    var h2 = sec.querySelector('h2');
    entries.push({
      id: sec.id,
      label: h2 ? h2.textContent.trim() : sec.id,
      level: 2,
      text: (sec.textContent || '').replace(/\s+/g, ' ')
    });
  }
  var h3s = document.querySelectorAll('main.reference h3[id]');
  for (var j = 0; j < h3s.length; j++) {
    entries.push({ id: h3s[j].id, label: h3s[j].textContent.trim(), level: 3, text: '' });
  }

  function mark(text, q) {
    var i = text.toLowerCase().indexOf(q);
    if (i < 0) return document.createTextNode(text);
    var frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(text.slice(0, i)));
    var m = document.createElement('mark');
    m.textContent = text.slice(i, i + q.length);
    frag.appendChild(m);
    frag.appendChild(document.createTextNode(text.slice(i + q.length)));
    return frag;
  }

  function excerpt(text, q) {
    var i = text.toLowerCase().indexOf(q);
    if (i < 0) return null;
    var s = Math.max(0, i - 45);
    var e = Math.min(text.length, i + q.length + 55);
    return (s > 0 ? '\u2026' : '') + text.slice(s, e) + (e < text.length ? '\u2026' : '');
  }

  var results = [];
  var tocTotal = 0;

  function setStatus(text) {
    var s = document.getElementById('refSearchStatus');
    if (s) s.textContent = text;
  }

  /* ---------- Подсветка совпадений в тексте (как Ctrl+F в редакторе) ----------
     Все вхождения, счётчик «3 из 17» и переход по Enter / Shift+Enter.
     Интерфейс (оглавление с полем поиска, навигация) не подсвечиваем. */

  var MAX_HITS = 500;
  var hits = [];
  var hitIndex = -1;
  var hitsCapped = false;

  function clearHits() {
    for (var i = 0; i < hits.length; i++) {
      var node = hits[i];
      var parent = node.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(node.textContent), node);
      parent.normalize();
    }
    hits = [];
    hitIndex = -1;
    hitsCapped = false;
  }

  function isUiNode(node, root) {
    var p = node.parentNode;
    while (p && p !== root) {
      if (p.id === 'toc' || p.classList.contains('refside')) return true;
      if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'MARK') return true;
      p = p.parentNode;
    }
    return false;
  }

  function wrapNode(node, q) {
    var text = node.nodeValue;
    var low = text.toLowerCase();
    var at = low.indexOf(q);
    if (at < 0) return;
    var frag = document.createDocumentFragment();
    var pos = 0;
    while (at >= 0) {
      if (hits.length >= MAX_HITS) break;
      if (at > pos) frag.appendChild(document.createTextNode(text.slice(pos, at)));
      var mark = document.createElement('mark');
      mark.className = 'refhit';
      mark.textContent = text.slice(at, at + q.length);
      frag.appendChild(mark);
      hits.push(mark);
      pos = at + q.length;
      at = low.indexOf(q, pos);
    }
    if (!pos) return;
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }

  function highlight(q) {
    clearHits();
    var root = document.querySelector('main.reference');
    if (!root || q.length < 2) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (isUiNode(node, root)) continue;
      nodes.push(node);
    }
    for (var i = 0; i < nodes.length && hits.length < MAX_HITS; i++) wrapNode(nodes[i], q);
    // Уперлись в предел — возможно, есть ещё: счётчик показываем как «500+».
    if (hits.length >= MAX_HITS) hitsCapped = true;
  }

  function showHit(i) {
    if (!hits.length) return;
    if (i < 0) i = hits.length - 1;
    if (i > hits.length - 1) i = 0;
    if (hits[hitIndex]) hits[hitIndex].classList.remove('is-current');
    hitIndex = i;
    hits[hitIndex].classList.add('is-current');
    hits[hitIndex].scrollIntoView({ block: 'center' });
    syncStatus();
  }

  function syncStatus() {
    var q = input.value.trim().toLowerCase();
    if (q.length < 2) { setStatus(''); return; }
    if (!hits.length) {
      setStatus(tocTotal ? 'Найдено: ' + tocTotal : 'Ничего не найдено');
      return;
    }
    var tail = hitsCapped ? '+' : '';
    setStatus(hitIndex < 0 ? 'Совпадений: ' + hits.length + tail
                           : (hitIndex + 1) + ' из ' + hits.length + tail);
  }

  function render(q) {
    list.textContent = '';
    results = [];
    tocTotal = 0;
    if (q.length < 2) { toc.classList.remove('searching'); list.hidden = true; highlight(q); setStatus(''); return; }

    var seen = {};
    var e, i;
    for (i = 0; i < entries.length; i++) {
      e = entries[i];
      if (e.label.toLowerCase().indexOf(q) < 0 || seen[e.id]) continue;
      seen[e.id] = 1;
      results.push({ id: e.id, label: e.label, level: e.level, excerpt: null });
    }
    results.sort(function (a, b) { return a.level - b.level; });

    if (results.length < 12) {
      for (i = 0; i < entries.length; i++) {
        e = entries[i];
        if (e.level !== 2 || seen[e.id]) continue;
        var ex = excerpt(e.text, q);
        if (ex) { seen[e.id] = 1; results.push({ id: e.id, label: e.label, level: 2, excerpt: ex }); }
      }
    }

    var total = results.length;
    results = results.slice(0, 40);

    for (i = 0; i < results.length; i++) {
      var r = results[i];
      var li = document.createElement('li');
      li.className = r.level === 3 ? 'refsearch__item refsearch__item--sub' : 'refsearch__item';
      var a = document.createElement('a');
      a.href = '#' + r.id;
      a.appendChild(mark(r.label, q));
      li.appendChild(a);
      if (r.excerpt) {
        var d = document.createElement('span');
        d.className = 'refsearch__excerpt';
        d.appendChild(mark(r.excerpt, q));
        li.appendChild(d);
      }
      list.appendChild(li);
    }

    if (!results.length) {
      var empty = document.createElement('li');
      empty.className = 'refsearch__empty';
      empty.textContent = '\u041d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e';
      list.appendChild(empty);
    }

    list.hidden = false;
    toc.classList.add('searching');
    tocTotal = total;
    highlight(q);
    syncStatus();
  }

  input.addEventListener('input', function () { render(input.value.trim().toLowerCase()); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (hits.length) showHit(hitIndex + (e.shiftKey ? -1 : 1));
      else if (results.length) location.hash = '#' + results[0].id;
    } else if (e.key === 'Escape') {
      if (input.value) { input.value = ''; render(''); }
      else { input.blur(); }
    }
  });
  list.addEventListener('click', function () { input.value = ''; render(''); });
})();

(function () {
  function flash(id) {
    if (!id || id === 'top') return;
    var el = document.getElementById(id);
    if (!el || el.tagName === 'MAIN') return;
    if (el.tagName === 'SECTION') {
      var h = el.querySelector('h2');
      if (h) el = h;
    }
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = (t && t.closest) ? t.closest('a[href^="#"]') : null;
    if (!a) return;
    flash(a.getAttribute('href').slice(1));
  });
  if (location.hash.length > 1) {
    var id = decodeURIComponent(location.hash.slice(1));
    setTimeout(function () { flash(id); }, 0);
  }
  function jumpSection(dir) {
    var secs = document.querySelectorAll('main.reference section[id]');
    var ids = [], cur = -1, i;
    for (i = 0; i < secs.length; i++) {
      if (secs[i].id === 'toc') continue;
      ids.push(secs[i].id);
      if (secs[i].getBoundingClientRect().top <= 120) cur = ids.length - 1;
    }
    if (!ids.length) return;
    var next = cur + dir;
    if (next < 0) next = 0;
    if (next > ids.length - 1) next = ids.length - 1;
    if (next === cur) return;
    var el = document.getElementById(ids[next]);
    if (!el) return;
    // Прокручиваем вручную: location.hash с тем же значением не прокручивает страницу.
    var nav = document.querySelector('.refnav');
    var off = (nav && getComputedStyle(nav).position === 'sticky')
      ? nav.getBoundingClientRect().height + 12 : 16;
    var top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - off);
    if (location.hash.slice(1) !== ids[next]) location.hash = '#' + ids[next];
    window.scrollTo(0, top);
    flash(ids[next]);
  }
  function toggleNav() {
    var nav = document.querySelector('.refnav');
    if (nav) nav.classList.toggle('is-hidden');
  }
  function markActive() {
    var toc = document.getElementById('toc');
    if (!toc) return;
    var secs = document.querySelectorAll('main.reference section[id]');
    var cur = null, i;
    for (i = 0; i < secs.length; i++) {
      if (secs[i].id === 'toc') continue;
      if (secs[i].getBoundingClientRect().top <= 120) cur = secs[i].id;
    }
    var links = toc.querySelectorAll('a[href^="#"]');
    for (i = 0; i < links.length; i++) {
      links[i].classList.toggle('is-active', links[i].getAttribute('href') === '#' + cur);
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; markActive(); });
  }, { passive: true });
  markActive();

  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var inField = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
    var mod = e.ctrlKey || e.metaKey;
    if (inField || mod || e.altKey) return;
    if (e.key === '/') {
      e.preventDefault();
      var f = document.getElementById('refSearch') || document.getElementById('idxFilter');
      if (f) { f.focus(); f.select(); }
    } else if (e.key === '[' || e.key === ']') {
      e.preventDefault();
      jumpSection(e.key === ']' ? 1 : -1);
    } else if (e.key === 'n') {
      e.preventDefault();
      toggleNav();
    }
  });
})();

(function () {
  var input = document.getElementById('idxFilter');
  var count = document.getElementById('idxCount');
  if (!input) return;
  var groups = [].slice.call(document.querySelectorAll('.idx-group'));
  var items = [].slice.call(document.querySelectorAll('.idx-list li'));
  function apply() {
    var q = input.value.trim().toLowerCase();
    var shown = 0, i;
    for (i = 0; i < items.length; i++) {
      var hit = !q || items[i].textContent.toLowerCase().indexOf(q) >= 0;
      items[i].hidden = !hit;
      if (hit) shown++;
    }
    for (i = 0; i < groups.length; i++) {
      var ul = groups[i].nextElementSibling;
      var any = ul ? ul.querySelector('li:not([hidden])') : null;
      groups[i].hidden = !any;
      if (ul) ul.hidden = !any;
    }
    count.textContent = q ? ('Найдено: ' + shown) : ('Показаны все записи (' + items.length + ').');
  }
  input.addEventListener('input', apply);
  input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (input.value) { input.value = ''; apply(); } else { input.blur(); } } });
})();
