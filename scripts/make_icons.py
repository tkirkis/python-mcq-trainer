"""Generate the PWA icons (run once: .venv/bin/python scripts/make_icons.py)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

def font(size):
    for f in ["/System/Library/Fonts/Menlo.ttc", "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"]:
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()

def icon(size, maskable=False, radius=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    bg = (31, 41, 55, 255)
    if maskable:
        d.rectangle([0, 0, size, size], fill=bg)
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius), fill=bg)
    s = 0.62 if maskable else 0.8  # keep content in the maskable safe zone
    f = font(int(size * 0.34 * s / 0.8))
    text = ">>>"
    w = d.textlength(text, font=f)
    d.text(((size - w) / 2, size * 0.30), text, font=f, fill=(255, 212, 59, 255))
    f2 = font(int(size * 0.22 * s / 0.8))
    t2 = "quiz"
    w2 = d.textlength(t2, font=f2)
    d.text(((size - w2) / 2, size * 0.56), t2, font=f2, fill=(110, 162, 255, 255))
    return img

icon(192).save(OUT / "icon-192.png")
icon(512).save(OUT / "icon-512.png")
icon(512, maskable=True).save(OUT / "icon-maskable-512.png")
icon(180, maskable=True).convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written to", OUT)
