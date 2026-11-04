#!/usr/bin/env python3
"""Вставляет записи листа в ukazatel.html («Указатель»).

Запуск из корня проекта (имя листа — без .html):

    python3 tools/build-ukazatel.py yup

Для каждого листа скрипт:
  1. вынимает записи из его HTML — заголовки разделов (h2), подзаголовки (h3)
     и первые ячейки строк таблиц (без <thead>);
  2. удаляет прежние записи этого листа из «Указателя»;
  3. вставляет свежие в группу по первой букве, сохраняя порядок группы;
  4. пересчитывает строку «Всего записей: …».

Идемпотентен: повторный запуск не меняет файл. Порядок разделов, тексты и
остальные листы не трогает — только записи переданных листов и счётчики.
"""

import html
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
UK = ROOT / "ukazatel.html"

CYR = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "з": "z",
    "и": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ч": "ch",
    "ш": "sh", "э": "e",
}
# Порядок групп в «Указателе». Id групп строчные: grp-a, grp-cyr-a.
ORDER = ["num"] + list("abcdefghijklmnopqrstuvwxyz") + [
    "cyr-" + s for s in ["a", "b", "v", "g", "d", "z", "i", "k", "l", "m",
                         "n", "o", "p", "r", "s", "t", "u", "f", "kh", "ch",
                         "sh", "e"]
]
GROUP_TITLE = {"num": "0–9"}
for _l in "abcdefghijklmnopqrstuvwxyz":
    GROUP_TITLE[_l] = _l.upper()
for _c, _s in CYR.items():
    GROUP_TITLE["cyr-" + _s] = _c.upper()

SHEET_LABEL = {
    "language": "Язык", "concurrency": "Параллелизм", "runtime": "Рантайм",
    "stdlib": "Стандартная библиотека", "http-service": "HTTP-сервис",
    "sql": "SQL и Postgres", "tooling": "Инструменты",
    "architecture": "Архитектура", "examples": "Примеры кода",
}
COUNT_ORDER = ["language", "concurrency", "runtime", "stdlib",
               "http-service", "sql", "tooling", "architecture", "examples"]


def strip_tags(chunk):
    # <wbr> убираем без пробела — так же, как build-refindex.py.
    chunk = re.sub(r"<wbr\s*/?>", "", chunk)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", chunk))).strip()


def group_key(label):
    for ch in strip_tags(label):
        if ch.isdigit():
            return "num"
        low = ch.lower()
        if "a" <= low <= "z":
            return low
        if low in CYR:
            return "cyr-" + CYR[low]
    return "num"


def sheet_entries(sheet):
    """[(якорь, HTML метки, текст метки, заголовок раздела)] в порядке страницы."""
    src = (ROOT / (sheet + ".html")).read_text(encoding="utf-8")
    out = []
    for sm in re.finditer(r'<section id="([^"]+)"[^>]*>(.*?)</section>', src, re.S):
        sid, body = sm.group(1), sm.group(2)
        h2m = re.search(r"<h2[^>]*>(.*?)</h2>", body, re.S)
        if not h2m:
            continue
        section = strip_tags(h2m.group(1))
        out.append((sid, h2m.group(1).strip(), section))
        for hm in re.finditer(r'<h3 id="([^"]+)"[^>]*>(.*?)</h3>', body, re.S):
            out.append((hm.group(1), hm.group(2).strip(), section))
        for tm in re.finditer(r"<table[^>]*>(.*?)</table>", body, re.S):
            tbl = re.sub(r"<thead.*?</thead>", "", tm.group(1), flags=re.S)
            for rm in re.finditer(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
                cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", rm.group(1), re.S)
                if len(cells) < 2 or not strip_tags(cells[0]):
                    continue
                out.append((sid, cells[0].strip(), section))
    return out


def parse_groups(text):
    """(строки, начало региона, конец региона, [(gid, title, [строки записей])])."""
    lines = text.split("\n")
    heads = [i for i, l in enumerate(lines)
             if re.match(r'<h3 id="grp-[^"]+" class="idx-group">', l)]
    groups = []
    for i in heads:
        assert lines[i + 1] == '<ul class="idx-list">', lines[i + 1]
        j = i + 2
        while lines[j] != "</ul>":
            j += 1
        gid = re.search(r'id="(grp-[^"]+)"', lines[i]).group(1)
        title = re.search(r">(.*)</h3>", lines[i]).group(1)
        groups.append((gid, title, lines[i + 2:j]))
    last = heads[-1]
    end = last + 2
    while lines[end] != "</ul>":
        end += 1
    return lines, heads[0], end, groups


def render_groups(groups):
    out = []
    for gid, title, lines in groups:
        out.append('<h3 id="%s" class="idx-group">%s</h3>' % (gid, title))
        out.append('<ul class="idx-list">')
        out.extend(lines)
        out.append('</ul>')
    return out


def add_sheet(text, sheet):
    entries = sheet_entries(sheet)
    # 1. убрать прежние записи этого листа
    text = re.sub(r'<li><a href="\./%s\.html#[^"]*">.*?</li>\n' % re.escape(sheet), "", text)
    # последняя группа может закрываться строкой «</ul></section>» — разводим
    text = text.replace("</ul></section>", "</ul>\n</section>")
    lines, first, last, groups = parse_groups(text)
    before_groups = len(groups)
    by_id = {gid: lines_ for gid, _, lines_ in groups}

    def insert_line(gid, line, key):
        gkey = gid[4:]  # без префикса «grp-»
        if gid not in by_id:
            title = GROUP_TITLE.get(gkey, gid)
            by_id[gid] = []
            order = ORDER.index(gkey) if gkey in ORDER else len(ORDER)
            pos = len(groups)
            for j, (g2, _, _) in enumerate(groups):
                k2 = g2[4:]
                o2 = ORDER.index(k2) if k2 in ORDER else len(ORDER)
                if o2 > order:
                    pos = j
                    break
            groups.insert(pos, (gid, title, by_id[gid]))
        lines_ = by_id[gid]
        target = key.casefold()
        idx = len(lines_)
        for j, ln in enumerate(lines_):
            lab = re.search(r'<a [^>]*>(.*?)</a>', ln, re.S)
            if lab and strip_tags(lab.group(1)).casefold() > target:
                idx = j
                break
        lines_.insert(idx, line)

    for anchor, label, section in entries:
        gid = "grp-" + group_key(label)
        line = ('<li><a href="./%s.html#%s">%s</a> '
                '<span class="idx-src">%s · %s</span></li>'
                % (sheet, anchor, label, SHEET_LABEL.get(sheet, sheet), section))
        insert_line(gid, line, strip_tags(label))

    # сохранить порядок групп по ORDER
    groups.sort(key=lambda g: ORDER.index(g[0][4:]) if g[0][4:] in ORDER else len(ORDER))
    assert len(groups) == before_groups or len(groups) > before_groups
    text = "\n".join(lines[:first] + render_groups(groups) + lines[last + 1:])

    # 2. строка переходов по группам — только по существующим группам
    jump = " · ".join('<a href="#%s">%s</a>' % (gid, title)
                      for gid, title, _ in groups)
    text = re.sub(r'<p class="idx-jump">.*?</p>',
                  '<p class="idx-jump">' + jump + '</p>',
                  text, count=1, flags=re.S)

    # 3. счётчики
    counts = {}
    for m in re.finditer(r'<li><a href="\./([^"#]+)\.html#', text):
        counts[m.group(1)] = counts.get(m.group(1), 0) + 1
    total = sum(counts.values())
    parts = ["%s %d" % (SHEET_LABEL[f], counts[f]) for f in COUNT_ORDER if f in counts]
    line = "<p>Всего записей: <strong>%d</strong> — %s.</p>" % (total, " · ".join(parts))
    text = re.sub(r"<p>Всего записей:.*?</p>", line, text, count=1, flags=re.S)
    return text, len(entries), total


def main():
    sheets = sys.argv[1:]
    if not sheets:
        print(__doc__)
        return
    text = UK.read_text(encoding="utf-8")
    for sheet in sheets:
        text, n, total = add_sheet(text, sheet)
        print("%s: %d записей, всего %d" % (sheet, n, total))
    UK.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
