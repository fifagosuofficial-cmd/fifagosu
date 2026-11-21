"""공식 로고(FIFAGOSU_LOGO.png, 2073x758, 투명 배경)를 웹용으로 줄여요.

- 원본은 건드리지 않아요(읽기만).
- 투명한 여백을 잘라낸 뒤(번짐 효과는 살리도록 약한 알파까지 포함) 가로 480px로 줄여요.
- 결과: site/brand/fifagosu-logo-480.png, site/brand/fifagosu-logo-480.webp

실행 (저장소 폴더에서):
    python tools/build-fun/make_logo.py
    python tools/build-fun/make_logo.py --src "C:/경로/FIFAGOSU_LOGO.png"
필요: pip install pillow
"""
import argparse
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
DEFAULT_SRC = REPO.parents[1] / "FIFAGOSU_LOGO.png"  # Desktop/FIFAGOSU/FIFAGOSU_LOGO.png
OUT_DIR = REPO / "site" / "brand"
WIDTH = 480
ALPHA_MIN = 8  # 이보다 옅은 픽셀은 여백으로 보고 잘라요
PAD = 6        # 자른 뒤 남길 여백(px, 결과 크기 기준)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    args = ap.parse_args()

    src = Path(args.src)
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a >= ALPHA_MIN else 0)
    box = alpha.getbbox() or (0, 0, im.width, im.height)
    pad = round(PAD * im.width / WIDTH)
    box = (max(0, box[0] - pad), max(0, box[1] - pad),
           min(im.width, box[2] + pad), min(im.height, box[3] + pad))
    im = im.crop(box)

    h = round(im.height * WIDTH / im.width)
    im = im.resize((WIDTH, h), Image.LANCZOS)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png = OUT_DIR / f"fifagosu-logo-{WIDTH}.png"
    webp = OUT_DIR / f"fifagosu-logo-{WIDTH}.webp"
    im.save(png, optimize=True)
    im.save(webp, quality=86, method=6)
    for p in (png, webp):
        print(f"{p}  {im.width}x{im.height}  {p.stat().st_size / 1024:.1f}KB")
    print(f"crop box (원본 기준): {box}, 화면 비율 {im.width / im.height:.3f}")


if __name__ == "__main__":
    main()
