#!/usr/bin/env python3
"""Собирает общую обвязку страниц справочника.

Запуск из корня проекта:

    python3 tools/build-layout.py

Для каждой *.html страницы идемпотентно обновляет общие блоки:
  1. левую панель .refside — навигацию по справочникам и панель клавиш;
  2. строку ссылок в подвале (.reference-footer__links);
  3. теги скриптов — assets/reference.js в <head> и общий хвост
     (page.js, quickopen.js, backtotop.js) перед </body>.

Навигация, панель клавиш и список ссылок заданы здесь, в одном месте:
добавить справочник = добавить строку в SHEETS/PRACTICE/FUNDAMENTALS
и запустить. Содержимое страниц генератор не трогает; повторный запуск
не даёт диффа.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# --- Данные обвязки (единственный источник) -------------------------------

SHEETS = [
    ("Язык", "language.html"),
    ("Параллелизм", "concurrency.html"),
    ("Рантайм", "runtime.html"),
]
PRACTICE = [
    ("Стандартная библиотека", "stdlib.html"),
    ("HTTP-сервис", "http-service.html"),
    ("SQL и Postgres", "sql.html"),
    ("Инструменты", "tooling.html"),
]
FUNDAMENTALS = [
    ("Архитектура", "architecture.html"),
    ("Примеры кода", "examples.html"),
]

# kind: 'label' — серая подпись первой строки, 'group' — зелёная группа
NAV_ROWS = [
    ("label", "Справочники", [("Главная", "index.html"), ("Указатель", "ukazatel.html")]),
    ("group", "Язык и рантайм", SHEETS),
    ("group", "Практика", PRACTICE),
    ("group", "Основы", FUNDAMENTALS),
]

FOOTER = ([("Главная", "index.html")] + SHEETS + PRACTICE + FUNDAMENTALS
          + [("Указатель", "ukazatel.html")])

KEYS = [
    ("<kbd>/</kbd>", "поиск по странице; <kbd>Enter</kbd> — следующее совпадение"),
    ("<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>E</kbd>", "поиск по всем справочникам (<kbd>@</kbd> — разделы)"),
    ("<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>E</kbd>", "в палитре вниз, <kbd>+Shift</kbd> — вверх"),
    ("<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>", "палитра команд: что можно сделать"),
    ("<kbd>[</kbd> <kbd>]</kbd>", "предыдущий / следующий раздел"),
    ("<kbd>j</kbd> / <kbd>k</kbd>", "скролл вниз / вверх"),
    ("<kbd>g</kbd> <kbd>g</kbd>", "в начало страницы"),
    ("<kbd>G</kbd>", "в конец страницы"),
    ("<kbd>t</kbd>", "скрыть оглавление"),
    ("<kbd>n</kbd>", "показать/скрыть навигацию"),
    ("<kbd>z</kbd>", "Zen-режим: только текст"),
    ("<kbd>y</kbd>", "ссылка на раздел"),
    ("<kbd>Esc</kbd>", "очистить поиск и снять фокус; в Zen — выйти"),
]

HEAD_SCRIPT = '<script src="assets/reference.js"></script>'
TAIL = ('<script src="assets/page.js"></script>\n'
        '<script src="assets/quickopen.js"></script>\n'
        '<script src="assets/backtotop.js"></script>')


# --- Рендер блоков ---------------------------------------------------------

def render_nav(current):
    rows = []
    for kind, label, items in NAV_ROWS:
        cls = "refnav__label" if kind == "label" else "refnav__group"
        lines = ['  <div class="refnav__row">',
                 '    <span class="%s">%s</span>' % (cls, label)]
        for title, href in items:
            if href == current:
                lines.append('    <span class="refnav__here" aria-current="page">%s</span>' % title)
            else:
                lines.append('    <a href="./%s">%s</a>' % (href, title))
        lines.append('  </div>')
        rows.append('\n'.join(lines))
    return ('<nav class="refnav refnav--rows" aria-label="Справочники">\n'
            + '\n'.join(rows) + '\n</nav>')


def render_keys():
    items = '\n'.join('    <li>%s — %s</li>' % (k, t) for k, t in KEYS)
    return ('<aside class="refkeys" aria-label="Горячие клавиши">\n'
            '  <span class="refkeys__title">Горячие клавиши</span>\n'
            '  <ul>\n' + items + '\n  </ul>\n</aside>')


def render_side(current):
    return ('<div class="refside">\n' + render_nav(current) + '\n\n'
            + render_keys() + '\n</div>\n\n')


def render_footer_links(current):
    lines = ['    <a href="./%s">%s</a>' % (href, title)
             for title, href in FOOTER if href != current]
    return ('<p class="reference-footer__links">\n' + ' ·\n'.join(lines) + '\n  </p>')


def build(text, current):
    # Поведение страницы теперь в assets/page.js — встроенные <script> убираем.
    text = re.sub(r'\n?<script>.*?</script>', '', text, flags=re.S)

    side = render_side(current)
    text, n = re.subn(r'<div class="refside">.*?(?=<header class="reference-header">)',
                      side, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('не найден блок .refside')

    links = render_footer_links(current)
    text, n = re.subn(r'<p class="reference-footer__links">.*?</p>',
                      links, text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('не найдена строка ссылок в подвале')

    if HEAD_SCRIPT not in text:
        text = text.replace('</head>', HEAD_SCRIPT + '\n</head>', 1)

    text, n = re.subn(r'</main>.*?</body>', '</main>\n' + TAIL + '\n</body>',
                      text, count=1, flags=re.S)
    if n != 1:
        raise SystemExit('не найден хвост </main>…</body>')
    # после удаления встроенного скрипта мог остаться лишний отступ
    text = re.sub(r'\n{3,}(</main>|</body>)', r'\n\n\1', text)
    return text


def main():
    changed = 0
    for path in sorted(ROOT.glob('*.html')):
        text = path.read_text(encoding='utf-8')
        new = build(text, path.name)
        if new != text:
            path.write_text(new, encoding='utf-8')
            changed += 1
            print('обновлён', path.name)
        else:
            print('без изменений', path.name)
    print('итого обновлено:', changed)


if __name__ == '__main__':
    sys.exit(main())
