/* ============================================================
   reference.js — общая обвязка страницы справочника
   Подключается в <head> каждой страницы. Тему применяет сразу,
   до первой отрисовки (чтобы не было вспышки), остальное — по
   DOMContentLoaded:
     • индикатор прогресса чтения,
     • плавающие кнопки «Команды» (⌘⇧P) и переключатель темы,
     • кнопки «Копировать» у блоков кода,
     • клавиши чтения: j / k, g g, G, t, y,
     • подсказки клавиш в интерфейсе,
     • список команд для палитры (window.REF_COMMANDS).
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'ref-theme';

  /* ---------- Тема: применяем немедленно ---------- */

  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function storedTheme() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }
  applyTheme(storedTheme() || (systemDark() ? 'dark' : 'light'));

  // Пока тему не выбрали вручную — следуем за системной настройкой.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function () { if (!storedTheme()) applyTheme(mq.matches ? 'dark' : 'light'); };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }

  /* ---------- Список команд для палитры (⌘⇧P) ---------- */

  var commands = [];
  window.REF_COMMANDS = commands;

  function synthKey(k, mods) {
    var init = { key: k, bubbles: true, cancelable: true };
    if (mods) for (var m in mods) init[m] = mods[m];
    document.dispatchEvent(new KeyboardEvent('keydown', init));
  }

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }
  function scrollTop() { window.scrollTo(0, 0); }
  function scrollBottom() { window.scrollTo(0, maxScroll()); }

  function focusSearch() {
    var f = document.getElementById('refSearch') || document.getElementById('idxFilter');
    if (f) { f.focus(); if (f.select) f.select(); }
  }

  function toggleToc() {
    var toc = document.getElementById('toc');
    if (!toc) return;
    var hidden = toc.classList.toggle('is-hidden');
    toast(hidden ? 'Оглавление скрыто' : 'Оглавление показано');
    syncWhereAmI();
  }

  /* ---------- Zen-режим: только текст ---------- */

  function toggleZen() {
    var zen = document.documentElement.classList.toggle('zen');
    toast(zen ? 'Zen-режим: только текст' : 'Обычный режим');
    syncWhereAmI();
  }

  function zenOn() {
    return document.documentElement.classList.contains('zen');
  }

  function currentSectionId() {
    var secs = document.querySelectorAll('main.reference section[id]');
    var cur = null, i;
    for (i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= 120) cur = secs[i].id;
    }
    return cur;
  }

  /* ---------- Плашка «где я» ---------- */

  var whereEl = null;

  function buildWhereAmI() {
    whereEl = document.createElement('button');
    whereEl.type = 'button';
    whereEl.className = 'whereami';
    whereEl.hidden = true;
    whereEl.title = 'Открыть палитру разделов';
    // Клик — та же палитра, что по Ctrl/Cmd+E: она открывается на разделах.
    whereEl.addEventListener('click', function () { synthKey('e', { ctrlKey: true }); });
    document.body.appendChild(whereEl);
  }

  // Оглавление видно только на широком экране и пока не скрыто — там плашка лишняя.
  function tocOnScreen() {
    var toc = document.getElementById('toc');
    if (!toc || toc.classList.contains('is-hidden')) return false;
    return !!(window.matchMedia && window.matchMedia('(min-width: 88rem)').matches);
  }

  function currentSectionLabel() {
    var id = currentSectionId();
    var node = id ? document.getElementById(id) : null;
    var head = node ? (node.tagName === 'SECTION' ? node.querySelector('h2') : node) : null;
    if (!head) head = document.querySelector('main.reference h1');
    return head ? head.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function syncWhereAmI() {
    if (!whereEl) return;
    var label = currentSectionLabel();
    if (zenOn() || tocOnScreen() || !label) { whereEl.hidden = true; return; }
    if (whereEl.textContent !== label) {
      whereEl.textContent = label;
      whereEl.setAttribute('aria-label', 'Раздел: ' + label + '. Открыть палитру разделов');
    }
    whereEl.hidden = false;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); resolve(); }
      catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function copySectionLink() {
    var id = currentSectionId();
    var url = location.href.split('#')[0] + (id ? '#' + id : '');
    copyText(url).then(
      function () { toast('Ссылка на раздел скопирована'); },
      function () { toast('Не удалось скопировать'); }
    );
  }

  /* ---------- Всплывающее уведомление ---------- */

  var toastEl = null;
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'ref-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1600);
  }

  /* ---------- Тема: переключатель ---------- */

  var themeBtn = null;
  function syncThemeButton() {
    if (!themeBtn) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeBtn.textContent = dark ? '\u2600' : '\u263E'; // ☀ / ☾
    themeBtn.title = dark ? 'Светлая тема' : 'Тёмная тема';
    themeBtn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(STORE_KEY, next); } catch (e) {}
    syncThemeButton();
  }

  /* ---------- Индикатор прогресса чтения ---------- */

  var readFill = null;
  function buildProgress() {
    var bar = document.createElement('div');
    bar.className = 'readbar';
    bar.setAttribute('aria-hidden', 'true');
    readFill = document.createElement('div');
    readFill.className = 'readbar__fill';
    bar.appendChild(readFill);
    document.body.appendChild(bar);
  }
  function syncProgress() {
    if (!readFill) return;
    var max = maxScroll();
    var ratio = max > 0 ? window.scrollY / max : 0;
    readFill.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%';
  }

  /* ---------- Плавающие контролы ---------- */

  function buildControls() {
    var box = document.createElement('div');
    box.className = 'refcontrols';

    var row = document.createElement('div');
    row.className = 'refcontrols__row';

    var cmd = document.createElement('button');
    cmd.type = 'button';
    cmd.className = 'refctl';
    cmd.title = 'Команды — что можно сделать (⌘⇧P)';
    cmd.setAttribute('aria-label', 'Команды');
    cmd.innerHTML = '<kbd>⌘</kbd><kbd>⇧</kbd><kbd>P</kbd>';
    cmd.addEventListener('click', function () {
      synthKey('p', { ctrlKey: true, shiftKey: true });
    });

    themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.className = 'refctl refctl--theme';
    themeBtn.addEventListener('click', toggleTheme);

    row.appendChild(cmd);
    row.appendChild(themeBtn);
    box.appendChild(row);
    document.body.appendChild(box);
    syncThemeButton();
  }

  /* ---------- Подсказки клавиш ---------- */

  function addHint(parent, cls, html) {
    if (!parent || parent.querySelector('.' + cls)) return;
    var span = document.createElement('span');
    span.className = cls;
    span.innerHTML = html;
    parent.appendChild(span);
  }

  function initHints() {
    var search = document.getElementById('refSearch');
    // Поле оборачиваем: подсказку центрируем по высоте поля, а не по всему блоку поиска.
    if (search && search.parentNode) {
      var field = document.createElement('div');
      field.className = 'refsearch__field';
      search.parentNode.insertBefore(field, search);
      field.appendChild(search);
      addHint(field, 'refsearch__hint', '<kbd>/</kbd>');
    }

    var tocH = document.querySelector('#toc h2');
    if (tocH) addHint(tocH, 'toc-hint', '<kbd>[</kbd><kbd>]</kbd>');
  }

  /* ---------- Копирование кода ---------- */

  function initCodeCopy() {
    var pres = document.querySelectorAll('main.reference pre');
    for (var i = 0; i < pres.length; i++) {
      (function (pre) {
        var code = pre.querySelector('code');
        if (!code || pre.parentNode.classList.contains('codeblock')) return;
        var wrap = document.createElement('div');
        wrap.className = 'codeblock';
        pre.parentNode.insertBefore(wrap, pre);
        wrap.appendChild(pre);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'codecopy';
        btn.textContent = 'Копировать';
        btn.setAttribute('aria-label', 'Скопировать код');
        btn.addEventListener('click', function () {
          copyText(code.textContent).then(function () {
            btn.textContent = 'Скопировано';
            btn.classList.add('is-done');
            setTimeout(function () {
              btn.textContent = 'Копировать';
              btn.classList.remove('is-done');
            }, 1400);
          }, function () { toast('Не удалось скопировать'); });
        });
        wrap.appendChild(btn);
      })(pres[i]);
    }
  }

  /* ---------- Клавиши чтения ---------- */

  var gPending = false;
  var gTimer = null;

  function onReadKey(e) {
    var t = e.target;
    var inField = !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable));
    if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'j': e.preventDefault(); window.scrollBy(0, 90); break;
      case 'k': e.preventDefault(); window.scrollBy(0, -90); break;
      case 'G': e.preventDefault(); scrollBottom(); break;
      case 'g':
        e.preventDefault();
        if (gPending) { gPending = false; clearTimeout(gTimer); scrollTop(); }
        else { gPending = true; gTimer = setTimeout(function () { gPending = false; }, 700); }
        break;
      case 't': e.preventDefault(); toggleToc(); break;
      case 'y': e.preventDefault(); copySectionLink(); break;
      case 'z': e.preventDefault(); toggleZen(); break;
      case 'Escape': if (zenOn()) { e.preventDefault(); toggleZen(); } break;
    }
  }

  /* ---------- Инициализация ---------- */

  function init() {
    buildProgress();
    buildControls();
    buildWhereAmI();
    initHints();
    initCodeCopy();

    commands.push(
      { label: 'Наверх страницы', keys: 'g g', run: scrollTop },
      { label: 'В конец страницы', keys: 'G', run: scrollBottom },
      { label: 'Следующий раздел', keys: ']', run: function () { synthKey(']'); } },
      { label: 'Предыдущий раздел', keys: '[', run: function () { synthKey('['); } },
      { label: 'Поиск по странице', keys: '/', run: focusSearch },
      { label: 'Показать или скрыть навигацию', keys: 'n', run: function () { synthKey('n'); } },
      { label: 'Показать или скрыть оглавление', keys: 't', run: toggleToc },
      { label: 'Zen-режим: только текст', keys: 'z', run: toggleZen },
      { label: 'Скопировать ссылку на раздел', keys: 'y', run: copySectionLink },
      { label: 'Переключить тему', keys: '', run: toggleTheme },
      { label: 'Печать или сохранить в PDF', keys: '⌘P', run: function () { window.print(); } }
    );

    document.addEventListener('keydown', onReadKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; syncProgress(); syncWhereAmI(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
