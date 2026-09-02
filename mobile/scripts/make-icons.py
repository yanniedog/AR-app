"""Generate the Rate Ledger app icon, adaptive icon, splash and favicon.

Pure-PIL, deterministic. Run from anywhere:

    python mobile/scripts/make-icons.py

Writes deterministic, code-native PNGs into mobile/assets/.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parents[1] / "assets"

PAPER = (244, 240, 230, 255)  # #F4F0E6
INK = (21, 35, 31, 255)  # #15231F
RULE = (147, 139, 124, 255)
EUCALYPTUS = (46, 106, 86, 255)  # #2E6A56
WATTLE = (213, 166, 46, 255)  # #D5A62E


def _rate_mark(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    """Rate Mark: ledger rules, one changing line and a highlighted datum."""
    x0, y0, x1, y1 = box
    w = x1 - x0
    h = y1 - y0
    for fraction in (0.24, 0.5, 0.76):
        y = y0 + h * fraction
        draw.line([(x0, y), (x1, y)], fill=RULE, width=max(2, int(w * 0.018)))
    points = [
        (x0 + w * 0.04, y0 + h * 0.72),
        (x0 + w * 0.30, y0 + h * 0.57),
        (x0 + w * 0.49, y0 + h * 0.63),
        (x0 + w * 0.72, y0 + h * 0.35),
        (x0 + w * 0.96, y0 + h * 0.27),
    ]
    draw.line(points, fill=INK, width=max(3, int(w * 0.045)), joint="curve")
    dot_r = max(3, int(w * 0.068))
    dot_x, dot_y = points[3]
    draw.ellipse((dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r), fill=WATTLE)
    inner = dot_r * 0.34
    draw.ellipse((dot_x - inner, dot_y - inner, dot_x + inner, dot_y + inner), fill=INK)


def _canvas(size: int, background: tuple[int, int, int, int]) -> Image.Image:
    # Supersampling keeps diagonal strokes calm at favicon size.
    return Image.new("RGBA", (size * 4, size * 4), background)


def _save(img: Image.Image, path: Path, size: int) -> None:
    img.resize((size, size), Image.Resampling.LANCZOS).save(path)


def make_icon() -> None:
    size = 1024
    img = _canvas(size, PAPER)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, size * 0.055 * 4, size * 4), fill=EUCALYPTUS)
    inset = int(size * 0.17 * 4)
    _rate_mark(draw, (inset, inset, size * 4 - inset, size * 4 - inset))
    _save(img, ASSETS / "icon.png", size)
    _save(img, ASSETS / "favicon.png", 64)


def make_adaptive() -> None:
    size = 1024
    img = _canvas(size, (0, 0, 0, 0))
    margin = int(size * 0.27 * 4)
    _rate_mark(ImageDraw.Draw(img), (margin, margin, size * 4 - margin, size * 4 - margin))
    _save(img, ASSETS / "adaptive-icon.png", size)


def make_splash() -> None:
    size = 1024
    img = _canvas(size, (0, 0, 0, 0))
    margin = int(size * 0.31 * 4)
    _rate_mark(ImageDraw.Draw(img), (margin, margin, size * 4 - margin, size * 4 - margin))
    _save(img, ASSETS / "splash.png", size)


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    make_icon()
    make_adaptive()
    make_splash()
    print(f"Wrote icons to {ASSETS}")
