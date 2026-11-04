/* ============================================================
   quickopen.js — палитра быстрого перехода (Ctrl/Cmd+E)
   Список страниц берётся из .refnav, разделы — из заголовков
   текущей страницы, поэтому файл общий для всех справочников.
   Ввод @ (а также # или /) переключает список на разделы.
   На странице справочника палитра открывается уже с @ — сразу
   разделы текущей страницы.

   Разметка палитры — паттерн combobox + listbox: у пунктов есть
   id, активный пункт связан с инпутом через aria-activedescendant,
   группы — role="group", счётчики-сообщения — role="status".
   ============================================================ */
(function () {
  'use strict';

  var MODE_RE = /^[@#\/]/;
  var UID = 'quickopen';
  var MAX_ENTRIES = 60;

  var overlay = null;
  var input = null;
  var listEl = null;
  var listboxEl = null;
  var emptyEl = null;
  var hintEl = null;
  var previewEl = null;
  var previewTitle = null;
  var previewSrc = null;
  var previewText = null;
  var shown = [];
  var itemEls = [];
  var active = 0;
  var prevFocus = null;
  var mode = 'nav'; // 'nav' — переходы, 'commands' — что можно сделать

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function text(node) {
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function hereLabel() {
    var here = document.querySelector('.refnav__here');
    return here ? text(here) : document.title;
  }

  // Пока открыта палитра, фон недоступен для фокуса и скринридера.
  function syncInert() {
    var main = document.querySelector('main.reference');
    if (!main) return;
    main.inert = !!document.querySelector('.quickopen:not(.quickopen--closing)');
  }

  function pages() {
    var out = [];
    var rows = document.querySelectorAll('.refnav__row');
    var i, j, row, links, label;
    if (!rows.length) {
      links = document.querySelectorAll('.refnav a[href]');
      for (i = 0; i < links.length; i++) {
        out.push({ kind: 'page', group: '', label: text(links[i]), href: links[i].getAttribute('href') });
      }
      return out;
    }
    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      label = text(row.querySelector('.refnav__label, .refnav__group'));
      links = row.querySelectorAll('a[href]');
      for (j = 0; j < links.length; j++) {
        out.push({ kind: 'page', group: label, label: text(links[j]), href: links[j].getAttribute('href') });
      }
    }
    return out;
  }

  function sections() {
    var out = [];
    var nodes = document.querySelectorAll('main.reference section[id], main.reference h3[id]');
    var i, node, isSection, label;
    for (i = 0; i < nodes.length; i++) {
      node = nodes[i];
      if (node.id === 'toc') continue;
      isSection = node.tagName === 'SECTION';
      label = text(isSection ? node.querySelector('h2') : node);
      if (!label) continue;
      out.push({ kind: 'section', group: '', label: label, id: node.id,
                 level: isSection ? 1 : 2, excerpt: domExcerpt(node, isSection) });
    }
    return out;
  }

  // Первый абзац раздела или подраздела — для превью (в индексе его нет).
  function domExcerpt(node, isSection) {
    var el = null, i, ps;
    if (isSection) {
      ps = node.querySelectorAll('p');
      for (i = 0; i < ps.length; i++) {
        if (ps[i].className.indexOf('is-muted') < 0) { el = ps[i]; break; }
      }
    } else {
      el = node.nextElementSibling;
      while (el && el.tagName !== 'P') el = el.nextElementSibling;
      if (el && el.className.indexOf('is-muted') >= 0) el = null;
    }
    if (!el) return '';
    var t = text(el);
    return t.length > 160 ? t.slice(0, 160).replace(/\s\S*$/, '') + '…' : t;
  }

  function currentFile() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  // Страница справочника — та, что в навигации стоит в группе (Стек/Основы),
  // а не «Главная»/«Указатель» в первой строке-подписи.
  function isSheetPage() {
    var here = document.querySelector('.refnav__here');
    var row = here && here.parentNode;
    return !!(row && row.querySelector('.refnav__group'));
  }

  function entryFile(href) {
    return href.replace(/^\.\//, '').split('#')[0];
  }

  // Имена страниц по имени файла берём из .refnav, чтобы не дублировать их в индексе.
  function sheetNames() {
    var map = {}, i, file, here;
    var links = document.querySelectorAll('.refnav a[href]');
    for (i = 0; i < links.length; i++) {
      file = entryFile(links[i].getAttribute('href'));
      map[file] = text(links[i]);
    }
    // Своя страница в навигации — не ссылка, а текст.
    here = document.querySelector('.refnav__here');
    if (here) map[currentFile()] = text(here);
    return map;
  }

  // Поиск по общему индексу сущностей всех справочников (assets/refindex.js).
  function matches(q) {
    var out = [], hits = [], i, e, file, total;
    var pageList = pages();
    for (i = 0; i < pageList.length; i++) {
      if (pageList[i].label.toLowerCase().indexOf(q) >= 0) out.push(pageList[i]);
    }
    var index = window.REF_INDEX || [];
    var names = sheetNames();
    for (i = 0; i < index.length; i++) {
      e = index[i];
      if (e[1].toLowerCase().indexOf(q) < 0) continue;
      file = entryFile(e[0]);
      hits.push({ kind: 'entry', group: '', label: e[1], href: e[0],
                  src: names[file] || file, excerpt: e[2] || '' });
    }
    total = hits.length;
    for (i = 0; i < total && i < MAX_ENTRIES; i++) {
      hits[i].group = 'Совпадения в справочниках (' + total + ')';
      out.push(hits[i]);
    }
    return out;
  }

  // Команды — действия, которые регистрирует assets/reference.js.
  function commandItems(q) {
    var src = window.REF_COMMANDS || [];
    var out = [], i, c;
    for (i = 0; i < src.length; i++) {
      c = src[i];
      if (q && c.label.toLowerCase().indexOf(q) < 0) continue;
      out.push({ kind: 'command', group: '', label: c.label, src: c.keys || '', run: c.run });
    }
    return out;
  }

  // Индекс грузим только когда палитра понадобилась: при обычном чтении он не нужен.
  function ensureIndex() {
    if (window.REF_INDEX || document.getElementById('refIndexScript')) return;
    var s = document.createElement('script');
    s.id = 'refIndexScript';
    s.src = 'assets/refindex.js';
    s.onload = function () { if (overlay) render(); };
    document.head.appendChild(s);
  }

  function mark(label, q) {
    var frag = document.createDocumentFragment();
    var at = q ? label.toLowerCase().indexOf(q) : -1;
    if (at < 0) {
      frag.appendChild(document.createTextNode(label));
      return frag;
    }
    frag.appendChild(document.createTextNode(label.slice(0, at)));
    frag.appendChild(el('mark', null, label.slice(at, at + q.length)));
    frag.appendChild(document.createTextNode(label.slice(at + q.length)));
    return frag;
  }

  function setActiveDescendant() {
    if (active < 0) input.removeAttribute('aria-activedescendant');
    else input.setAttribute('aria-activedescendant', UID + '-opt-' + active);
  }

  function render() {
    var raw = input.value;
    var sectionMode = mode === 'nav' && MODE_RE.test(raw);
    var q = (sectionMode ? raw.slice(1) : raw).trim().toLowerCase();
    var pool = mode === 'commands' ? commandItems(q)
      : (sectionMode ? sections() : (q ? matches(q) : pages()));
    var i, item, lastGroup, groupEl, groupLabel;

    shown = [];
    for (i = 0; i < pool.length; i++) {
      if (!q || pool[i].label.toLowerCase().indexOf(q) >= 0) shown.push(pool[i]);
    }
    if (active < 0 || active >= shown.length) active = shown.length ? 0 : -1;

    listboxEl.textContent = '';
    listboxEl.setAttribute('aria-label', mode === 'commands' ? 'Команды'
      : sectionMode ? 'Разделы страницы'
      : (q ? 'Поиск по всем справочникам' : 'Страницы справочника'));
    itemEls = [];
    lastGroup = null;
    groupEl = null;
    for (i = 0; i < shown.length; i++) {
      item = shown[i];
      if (item.group && item.group !== lastGroup) {
        groupEl = el('div', 'quickopen__groupwrap');
        groupEl.setAttribute('role', 'group');
        groupEl.setAttribute('aria-label', item.group);
        groupLabel = el('div', 'quickopen__group', item.group);
        groupLabel.setAttribute('aria-hidden', 'true');
        groupEl.appendChild(groupLabel);
        listboxEl.appendChild(groupEl);
        lastGroup = item.group;
      }
      var li = el('div', 'quickopen__item'
        + (item.level === 2 ? ' quickopen__item--sub' : '')
        + (i === active ? ' is-active' : ''));
      li.setAttribute('role', 'option');
      li.id = UID + '-opt-' + i;
      li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      li.setAttribute('data-i', i);
      li.appendChild(mark(item.label, q));
      if (item.kind === 'command') {
        li.classList.add('quickopen__item--cmd');
        if (item.src) li.appendChild(el('span', 'quickopen__key', item.src));
      } else if (item.src) {
        li.appendChild(el('span', 'quickopen__src', ' · ' + item.src));
      }
      (groupEl || listboxEl).appendChild(li);
      itemEls.push(li);
    }

    var empty = shown.length ? '' : (mode === 'commands' ? 'Команд не найдено'
      : sectionMode ? 'Разделы не найдены'
      : (q ? 'Ничего не найдено' : 'Страницы не найдены'));
    if (emptyEl.textContent !== empty) emptyEl.textContent = empty;

    var hint = mode === 'commands' ? 'Команды'
      : sectionMode ? 'Разделы: ' + hereLabel()
      : (q ? 'Поиск по всем справочникам' : 'Страницы справочника');
    // В режиме разделов подсказываем, как вернуться к поиску по всем справочникам.
    var tip = sectionMode ? ' · удали ' + raw.charAt(0) + ' — поиск по всем справочникам' : '';
    if (hintEl.textContent !== hint + tip) {
      hintEl.textContent = hint;
      if (tip) hintEl.appendChild(el('span', 'quickopen__hint-tip', tip));
    }

    setActiveDescendant();
    scrollActive();
    updatePreview();
  }

  function scrollActive() {
    var node = itemEls[active];
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
  }

  // Превью выделенного пункта: описание из индекса или первый абзац раздела.
  function updatePreview() {
    var item = shown[active];
    var excerpt = item && item.excerpt;
    if (!excerpt) {
      previewEl.classList.remove('is-on');
      return;
    }
    previewTitle.textContent = item.label;
    previewSrc.textContent = item.kind === 'section' ? hereLabel() : (item.src || '');
    previewText.textContent = excerpt;
    previewEl.classList.add('is-on');
  }

  function setActive(n) {
    if (!shown.length || n === active) return;
    if (n < 0) n = shown.length - 1;
    if (n > shown.length - 1) n = 0;
    itemEls[active].classList.remove('is-active');
    itemEls[active].setAttribute('aria-selected', 'false');
    active = n;
    itemEls[active].classList.add('is-active');
    itemEls[active].setAttribute('aria-selected', 'true');
    setActiveDescendant();
    scrollActive();
    updatePreview();
  }

  function jumpHash(id) {
    close();
    if (!id) return;
    // Синтетический клик по якорю: даёт ту же прокрутку и подсветку,
    // что и обычная ссылка на странице (штатный обработчик кликов).
    var a = el('a');
    a.href = '#' + id;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function go(i) {
    var item = shown[i];
    if (!item) return;
    if (item.kind === 'command') { close(); if (item.run) item.run(); return; }
    if (item.kind === 'section') { jumpHash(item.id); return; }
    // Сущность с текущей же страницы — прыгаем по якорю, не перезагружая её.
    if (item.kind === 'entry' && entryFile(item.href) === currentFile()) {
      jumpHash(item.href.split('#')[1]);
      return;
    }
    close();
    window.location.href = item.href;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(active); }
    // Фокус в палитре один — удерживаем Tab на инпуте.
    else if (e.key === 'Tab') { e.preventDefault(); }
  }

  function close() {
    if (!overlay) return;
    var node = overlay;
    overlay = input = listEl = listboxEl = emptyEl = hintEl = null;
    previewEl = previewTitle = previewSrc = previewText = null;
    shown = [];
    itemEls = [];
    active = 0;
    if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
    prevFocus = null;
    node.classList.add('quickopen--closing');
    syncInert();
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 160);
  }

  function open(m) {
    if (overlay) { close(); return; }
    mode = m || 'nav';
    prevFocus = document.activeElement;

    overlay = el('div', 'quickopen');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', mode === 'commands' ? 'Команды' : 'Быстрый переход');

    var box = el('div', 'quickopen__box');

    input = el('input', 'quickopen__input');
    input.type = 'text';
    input.placeholder = mode === 'commands'
      ? 'Что можно сделать…'
      : 'Поиск по справочникам…   (@ — разделы текущей)';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', UID + '-list');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-label', mode === 'commands' ? 'Команда' : 'Страница или раздел');

    hintEl = el('div', 'quickopen__hint');
    hintEl.setAttribute('role', 'status');

    listEl = el('div', 'quickopen__list');
    listboxEl = el('div');
    listboxEl.id = UID + '-list';
    listboxEl.setAttribute('role', 'listbox');
    emptyEl = el('div', 'quickopen__empty');
    emptyEl.setAttribute('role', 'status');
    listEl.appendChild(listboxEl);
    listEl.appendChild(emptyEl);

    var foot = el('div', 'quickopen__foot');
    var hints = mode === 'commands'
      ? [['↑ ↓', 'выбрать'], ['Enter', 'выполнить'], ['Esc', 'закрыть']]
      : [['↑ ↓', 'выбрать'], ['Ctrl/Cmd+E', 'вниз'], ['+Shift', 'вверх'], ['Enter', 'открыть'], ['Esc', 'закрыть']];
    for (var i = 0; i < hints.length; i++) {
      var span = el('span');
      span.appendChild(el('kbd', null, hints[i][0]));
      span.appendChild(document.createTextNode(' ' + hints[i][1]));
      foot.appendChild(span);
    }

    previewEl = el('aside', 'quickopen__preview');
    previewEl.setAttribute('aria-label', 'Описание');
    previewTitle = el('p', 'quickopen__preview-title');
    previewSrc = el('p', 'quickopen__preview-src');
    previewText = el('p', 'quickopen__preview-text');
    previewEl.appendChild(previewTitle);
    previewEl.appendChild(previewSrc);
    previewEl.appendChild(previewText);

    var bodyEl = el('div', 'quickopen__body');
    bodyEl.appendChild(listEl);
    bodyEl.appendChild(previewEl);

    box.appendChild(input);
    box.appendChild(hintEl);
    box.appendChild(bodyEl);
    box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    syncInert();

    input.addEventListener('input', function (e) {
      // Пока идёт анимация закрытия, в DOM живёт и старый оверлей —
      // его обработчик не должен трогать состояние новой палитры.
      if (e.target !== input) return;
      active = 0;
      render();
    });
    input.addEventListener('keydown', onKey);
    listEl.addEventListener('click', function (e) {
      var li = e.target && e.target.closest ? e.target.closest('.quickopen__item') : null;
      if (li) go(Number(li.getAttribute('data-i')));
    });
    listEl.addEventListener('mouseover', function (e) {
      var li = e.target && e.target.closest ? e.target.closest('.quickopen__item') : null;
      if (li) setActive(Number(li.getAttribute('data-i')));
    });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });

    // В справочнике палитра сразу показывает разделы текущей страницы.
    if (mode === 'nav' && isSheetPage()) input.value = '@';

    render();
    input.focus();
    if (input.value) input.setSelectionRange(input.value.length, input.value.length);
    if (mode === 'nav') ensureIndex();
  }

  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = String(e.key).toLowerCase();
    // ⌘⇧P — палитра команд: что можно сделать, с клавишами рядом.
    if (k === 'p' && e.shiftKey) {
      e.preventDefault();
      if (!overlay) { open('commands'); return; }
      if (mode === 'commands') { setActive(active + 1); return; }
      close(); open('commands'); return;
    }
    if (k !== 'e') return;
    e.preventDefault();
    if (!overlay) { open('nav'); return; }
    // Палитра открыта: повторное нажатие листает список (Shift — назад), как в VS Code.
    setActive(active + (e.shiftKey ? -1 : 1));
  });
})();
