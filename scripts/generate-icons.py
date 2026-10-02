"""Generates the app icon for every platform from one definition (2026-10-01).

The mark is the one the web app already used as its favicon: a green circle (#3ecf8e) on a dark
rounded square (#0a1310), the "Emerald Focus" theme colors. Run from the repo root:

    py scripts/generate-icons.py

Writes the Expo source images (apps/mobile/assets/images), the prebuilt Android launcher and
splash resources (apps/mobile/android/app/src/main/res), and the desktop master
(apps/desktop/src-tauri/icons/app-icon.png). After running it, regenerate the desktop sizes with
`npx tauri icon src-tauri/icons/app-icon.png` from apps/desktop. The web favicon is the same
shape as an inline SVG in apps/web/index.html.

Needs Pillow (`py -m pip install pillow`).
"""
from pathlib import Path

from PIL import Image, ImageDraw

BACKGROUND = (0x0A, 0x13, 0x10, 255)
MARK = (0x3E, 0xCF, 0x8E, 255)
WHITE = (255, 255, 255, 255)

# Proportions of the original 32-unit SVG: rounded square with rx=9, circle of r=7 at the center.
CORNER = 9 / 32
CIRCLE = 7 / 32

ROOT = Path(__file__).resolve().parent.parent
MOBILE = ROOT / "apps" / "mobile"
RES = MOBILE / "android" / "app" / "src" / "main" / "res"
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
SUPERSAMPLE = 4


def render(size: int, draw_fn) -> Image.Image:
    """Draws at SUPERSAMPLE x and scales down, for smooth edges."""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(img), big)
    return img.resize((size, size), Image.LANCZOS)


def circle(draw: ImageDraw.ImageDraw, size: int, radius_ratio: float, color) -> None:
    c, r = size / 2, size * radius_ratio
    draw.ellipse((c - r, c - r, c + r, c + r), fill=color)


def rounded_icon(size: int) -> Image.Image:
    """The full mark: dark rounded square with the circle. Transparent corners."""
    def fn(d, s):
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s * CORNER, fill=BACKGROUND)
        circle(d, s, CIRCLE, MARK)
    return render(size, fn)


def square_icon(size: int) -> Image.Image:
    """Full-bleed square (iOS rounds it itself and rejects transparency)."""
    def fn(d, s):
        d.rectangle((0, 0, s, s), fill=BACKGROUND)
        circle(d, s, CIRCLE, MARK)
    return render(size, fn)


# Adaptive icon layers are 108dp, of which the launcher shows roughly the middle 72dp. Scaling the
# circle to that 72dp keeps it the same size relative to the visible icon as in the original.
ADAPTIVE_CIRCLE = CIRCLE * 72 / 108


def adaptive_foreground(size: int, color=MARK) -> Image.Image:
    return render(size, lambda d, s: circle(d, s, ADAPTIVE_CIRCLE, color))


def adaptive_background(size: int) -> Image.Image:
    return Image.new("RGBA", (size, size), BACKGROUND)


def splash_logo(size: int) -> Image.Image:
    return render(size, lambda d, s: circle(d, s, 0.22, MARK))


def save(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".webp":
        img.save(path, "WEBP", lossless=True)
    else:
        img.save(path)
    print(f"  {path.relative_to(ROOT)} ({img.width}x{img.height})")


def main() -> None:
    print("Expo sources:")
    images = MOBILE / "assets" / "images"
    save(square_icon(1024), images / "icon.png")
    save(adaptive_foreground(1024), images / "android-icon-foreground.png")
    save(adaptive_background(1024), images / "android-icon-background.png")
    save(adaptive_foreground(1024, WHITE), images / "android-icon-monochrome.png")
    save(rounded_icon(48), images / "favicon.png")
    save(splash_logo(1024), images / "splash-icon.png")

    if RES.exists():
        print("Android resources:")
        for name, scale in DENSITIES.items():
            legacy, layer, splash = round(48 * scale), round(108 * scale), round(288 * scale)
            folder = RES / f"mipmap-{name}"
            save(rounded_icon(legacy), folder / "ic_launcher.webp")
            save(render(legacy, lambda d, s: (d.ellipse((0, 0, s - 1, s - 1), fill=BACKGROUND), circle(d, s, CIRCLE, MARK))),
                 folder / "ic_launcher_round.webp")
            save(adaptive_foreground(layer), folder / "ic_launcher_foreground.webp")
            save(adaptive_background(layer), folder / "ic_launcher_background.webp")
            save(adaptive_foreground(layer, WHITE), folder / "ic_launcher_monochrome.webp")
            save(splash_logo(splash), RES / f"drawable-{name}" / "splashscreen_logo.png")

    print("Desktop master:")
    save(rounded_icon(1024), ROOT / "apps" / "desktop" / "src-tauri" / "icons" / "app-icon.png")


if __name__ == "__main__":
    main()
