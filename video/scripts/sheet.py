# Раскадровка: кадры out/stills/<id>-*.png → один лист с номерами кадров и секундами.
# python3 scripts/sheet.py DemoVertical out/storyboard-v.jpg [колонок]
import sys, glob
from PIL import Image, ImageDraw, ImageFont
cid, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 10
fs = sorted(glob.glob(f'out/stills/{cid}-*.png'))
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 22)
except Exception: font = None
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 8), rows * (h + 40)), 'white'); d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x = (i % cols) * (w + 8); y = (i // cols) * (h + 40)
    fr = int(f[-8:-4]); sheet.paste(im, (x, y + 36)); d.text((x + 4, y + 6), f'Кадр {i + 1} · {fr / 30:.1f} с', fill='black', font=font)
sheet.save(out, quality=88); print(out, sheet.size)
