#!/usr/bin/env python3
"""Собирает assets/refindex.js из ukazatel.html.

Запуск из корня проекта:

    python3 tools/build-refindex.py

Даёт общий индекс сущностей для палитры Cmd+E: записи вида
[«файл#якорь», «имя», «фрагмент»]. Фрагмент — первое предложение раздела
или, для ключей таблиц, описание из строки этого ключа; он показывается
в превью палитры. Запускать заново после правок справочников и «Указателя»
(сначала обновите ukazatel.html, потом этот файл).
"""

import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "ukazatel.html"
OUT = ROOT / "assets" / "refindex.js"
PROSE_LIMIT = 150
ROW_LIMIT = 140
MIN_PROSE = 25


def strip_tags(chunk):
    # <wbr> — точка переноса внутри ключа; убираем без пробела, иначе ключ
    # не совпадёт с записью «Указателя», где пробела тоже нет.
    chunk = re.sub(r"<wbr\s*/?>", "", chunk)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", chunk))).strip()


def cut_sentence(text, limit=PROSE_LIMIT):
    """Первое предложение, иначе обрезка по границе слова."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    m = re.match(r"^(.{15,%d}?[.!?])(\s|$)" % limit, text)
    if m:
        return m.group(1)
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"


def first_paragraph(body):
    for m in re.finditer(r"<p(?![^>]*is-muted)[^>]*>(.*?)</p>", body, re.S):
        text = strip_tags(m.group(1))
        if len(text) >= MIN_PROSE:
            return cut_sentence(text)
    return ""


def sheet_data(path):
    """{id раздела или подзаголовка: первое предложение} и
    {(раздел, ключ строки): описание} + {ключ строки: описание}."""
    src = path.read_text(encoding="utf-8")
    prose, by_section, by_key = {}, {}, {}
    for m in re.finditer(r'<section id="([^"]+)"[^>]*>(.*?)</section>', src, re.S):
        sid, body = m.group(1), m.group(2)
        prose.setdefault(sid, first_paragraph(body))
        # подзаголовки: текст идёт до следующего h2/h3
        parts = re.split(r'<h3 id="([^"]+)"[^>]*>', body)
        for i in range(1, len(parts) - 1, 2):
            head, rest = parts[i], re.split(r"<h[23][ >]", parts[i + 1])[0]
            prose.setdefault(head, first_paragraph(rest))
        # строки таблиц: ключ — первая ячейка, фрагмент — последняя
        for table in re.finditer(r"<table[^>]*>(.*?)</table>", body, re.S):
            for row in re.finditer(r"<tr>(.*?)</tr>", table.group(1), re.S):
                cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row.group(1), re.S)
                if len(cells) < 2:
                    continue
                key, desc = strip_tags(cells[0]), cut_sentence(strip_tags(cells[-1]), ROW_LIMIT)
                if desc == "—":  # заглушка «нет данных» — пусть фрагментом станет вступление раздела
                    desc = ""
                if key and desc:
                    by_section.setdefault((sid, key), desc)
                    by_key.setdefault(key, desc)
    return prose, by_section, by_key


def main():
    index = {}
    for sheet in sorted(ROOT.glob("*.html")):
        if sheet.name == "ukazatel.html":
            continue
        index[sheet.name] = sheet_data(sheet)

    src = SRC.read_text(encoding="utf-8")
    entries, with_excerpt = [], 0
    for m in re.finditer(r'<li><a href="([^"]+)">(.*?)</a>', src, re.S):
        href, inner = m.group(1), m.group(2)
        label = strip_tags(inner)
        if not label:
            continue
        if href.startswith("./"):
            href = href[2:]
        file, _, anchor = href.partition("#")
        data = index.get(file)
        excerpt = ""
        if data:
            prose, by_section, by_key = data
            excerpt = by_section.get((anchor, label)) or by_key.get(label) or prose.get(anchor, "")
        if excerpt:
            with_excerpt += 1
        entries.append([href, label, excerpt])

    payload = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "/* Сгенерировано: python3 tools/build-refindex.py — вручную не править. */\n"
        "window.REF_INDEX = " + payload + ";\n",
        encoding="utf-8",
    )
    print(f"{len(entries)} записей ({with_excerpt} с фрагментом) → "
          f"{OUT.relative_to(ROOT)} ({len(payload.encode()) // 1024} КБ)")


if __name__ == "__main__":
    main()
