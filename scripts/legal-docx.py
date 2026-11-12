#!/usr/bin/env python3
# Документ юриста (.docx) → HTML для страницы /dokumenty/<slug>/ и для
# legal_docs в базе (подпись невесты/подрядчика хранит хеш этого текста).
#   python3 -I scripts/legal-docx.py <файл.docx> src/data/legal/<slug>.html
# Правила разметки сайта: заголовок — только целиком жирный абзац («1. Термины»
# → h2, «3.1. …» → h3); жирное внутри фразы снимаем (на сайте запрещено);
# пункты списка Word → <li>; первую строку-название документа выкидываем —
# заголовок страницы даёт сама страница (src/data/legal.ts).
import html
import re
import sys
import zipfile

src, out = sys.argv[1], sys.argv[2]
xml = zipfile.ZipFile(src).read('word/document.xml').decode('utf8')

blocks = []  # (kind, text)
for p in re.findall(r'<w:p[ >].*?</w:p>', xml, flags=re.S):
    runs = re.findall(r'<w:r[ >].*?</w:r>', p, flags=re.S)
    parts = []
    for r in runs:
        bold = bool(re.search(r'<w:b/>|<w:b w:val="(1|true)"/>', r))
        r = re.sub(r'<w:noBreakHyphen/>', '<w:t>-</w:t>', r)
        r = re.sub(r'<w:br[^>]*/>', '<w:t>\n</w:t>', r)
        r = re.sub(r'<w:tab/>', '<w:t> </w:t>', r)
        t = html.unescape(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', r, flags=re.S)))
        if t:
            parts.append((bold, t))
    text = ''.join(t for _, t in parts)
    if not text.strip():
        continue
    all_bold = all(b for b, t in parts if t.strip())
    is_item = '<w:numPr>' in p
    for i, line in enumerate(text.split('\n')):
        line = re.sub(r'\s+', ' ', line).strip()
        if not line:
            continue
        if is_item:
            blocks.append(('li', line))
        elif all_bold:
            blocks.append(('h3' if re.match(r'^\d+\.\d+', line) else 'h2' if re.match(r'^\d+\.', line) else 'title' if not blocks else 'h3', line))
        else:
            blocks.append(('p', line))

# название документа (первый жирный абзац) — на странице своё
if blocks and blocks[0][0] == 'title':
    blocks = blocks[1:]

def esc(s):
    return html.escape(s, quote=False)

lines, in_list = [], False
for kind, text in blocks:
    if kind == 'li':
        if not in_list:
            lines.append('<ul class="list">')
            in_list = True
        lines.append(f'  <li>{esc(text)}</li>')
        continue
    if in_list:
        lines.append('</ul>')
        in_list = False
    tag = 'p' if kind == 'title' else kind
    lines.append(f'<{tag}>{esc(text)}</{tag}>')
if in_list:
    lines.append('</ul>')

open(out, 'w', encoding='utf8').write('\n'.join(lines) + '\n')
print(out, len(blocks), 'блоков')
