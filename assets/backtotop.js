/* ============================================================
   backtotop.js — кнопка «Наверх»
   Появляется после прокрутки вниз, по клику мгновенно возвращает
   к началу страницы. Общий файл для всех справочников.
   Стили — в assets/reference.css (.to-top).
   ============================================================ */
(function () {
  'use strict';

  // Порог в пикселях: пока страница не прокручена, кнопка не мешает.
  var SHOW_AFTER = 480;
  var button = null;
  var ticking = false;

  function build() {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'to-top';
    button.title = 'Наверх';
    button.setAttribute('aria-label', 'Вернуться наверх страницы');

    var arrow = document.createElement('span');
    arrow.className = 'to-top__arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '\u2191';
    button.appendChild(arrow);
    button.appendChild(document.createTextNode('Наверх'));

    button.addEventListener('click', function () {
      window.scrollTo(0, 0);
      button.blur();
    });

    // Встаём в общий столбик плавающих контролов, если он есть.
    var controls = document.querySelector('.refcontrols');
    if (controls) controls.insertBefore(button, controls.firstChild);
    else document.body.appendChild(button);
  }

  // Скрытая кнопка не должна ловить клики, фокус и скринридер.
  function sync() {
    if (!button) return;
    var on = window.scrollY > SHOW_AFTER;
    button.classList.toggle('is-on', on);
    button.tabIndex = on ? 0 : -1;
    button.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; sync(); });
  }

  function init() {
    build();
    sync();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
