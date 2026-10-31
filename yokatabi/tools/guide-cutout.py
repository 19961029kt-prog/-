# 案内人の3匹の絵を、運営の設定画（tools/guides/{id}.jpg・白い背景の 2000×2000）から切り抜いて、
# img/guides/ に全身（{id}.webp）と吹き出しの顔（{id}-face.webp）を作る。
#   python3 -I tools/guide-cutout.py tools/guides img/guides
# 設定画をそのまま使う（描き直さない・色も形も変えない）。透明にするのは「外の白い背景」と、絵の中から背景が見えているすきまだけ。
# - 背景：ほぼ真っ白で色みのない画素のうち、絵の外側（画像の四辺）とつながっているもの。
#   絵の中の白（ツシ丸の胸・カチ助のおなかと羽の先・ゴロ太の目の白）は輪郭の線に囲まれているので残る。
# - 囲まれているのに背景が見えているすきま（ツシ丸の腰に当てた腕と体のあいだ）は、HOLES に場所を書いて透明にする。
# - 輪郭のふちは、白とのなじみ具合から透けぐあいを出し、白をぬいた色に直す（どんな地の色に置いても白くふちどられない）。
# Pillow と numpy だけを使う。
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
NAMES = ['tsushimaru', 'gorota', 'kachisuke']
WHITE_MIN, NEUTRAL = 228, 18     # 背景とみなす白（RGB のいちばん小さい値がこれ以上・色みの幅がこれ以下）
INK_MIN = 32                     # 輪郭の線の暗さ（RGB のいちばん小さい値）。ふちの透けぐあいの計算に使う
HOLES = {'tsushimaru': [(1322, 1131)]}   # 囲まれた背景のすきま（設定画の上の位置）
SCALE = 0.2                      # 全身の縮尺（3匹とも同じ。設定画どうしの大きさの釣り合いをそのまま残す）
# 吹き出しの顔：設定画の上の正方形（中心 x, y と一辺）を FACE_PX に縮める（吹き出しの顔は 54px なので、3倍の画面でもにじまない大きさ）
FACE = {'tsushimaru': (1010, 560, 1180), 'gorota': (985, 610, 1160), 'kachisuke': (815, 590, 880)}
FACE_PX = 168
QUALITY = 86

meta = {}
for n in NAMES:
    img = Image.open(f'{SRC}/{n}.jpg').convert('RGB')
    a = np.asarray(img).astype(np.float32)
    mn, mx = a.min(2), a.max(2)
    cand = (mn >= WHITE_MIN) & ((mx - mn) <= NEUTRAL)
    m = Image.fromarray((cand * 255).astype('uint8'), 'L').copy()   # fromarray の画像は書きこめないので写しを持つ
    W, H = m.size
    seeds = [(x, y) for x in range(0, W, 5) for y in (0, H - 1)] + [(x, y) for y in range(0, H, 5) for x in (0, W - 1)]
    seeds += HOLES.get(n, [])
    for p in seeds:
        if m.getpixel(p) == 255:
            ImageDraw.floodfill(m, p, 128)
    bg = np.asarray(m) == 128
    # ふち：背景から3画素以内の絵の画素。白とのなじみ具合（いちばん小さい値）から透けぐあいを出す
    near = np.asarray(Image.fromarray((bg * 255).astype('uint8'), 'L').filter(ImageFilter.MaxFilter(7))) > 0
    band = near & ~bg
    alpha = np.ones((H, W), np.float32)
    alpha[bg] = 0
    ab = np.clip((255 - mn[band]) / (255 - INK_MIN), 0, 1)
    alpha[band] = ab
    rgb = a.copy()
    # 白をぬいた色：P = α·C + (1−α)·白 から C を出す
    k = band & (alpha > 0.02)
    rgb[k] = (a[k] - (1 - alpha[k])[:, None] * 255) / alpha[k][:, None]
    rgb = np.clip(rgb, 0, 255)
    rgb[alpha <= 0.02] = 0
    alpha[alpha <= 0.02] = 0
    rgba = Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype('uint8'), 'RGBA')
    # 全身：絵のある範囲で切り、同じ縮尺で縮める（透けたふちがにじまないよう、透けぐあいを掛けた形で縮める）
    bb = rgba.getchannel('A').getbbox()
    pad = 8
    bb = (max(0, bb[0] - pad), max(0, bb[1] - pad), min(W, bb[2] + pad), min(H, bb[3] + pad))
    body = rgba.crop(bb)
    size = (round(body.width * SCALE), round(body.height * SCALE))
    body = body.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')
    body.save(f'{OUT}/{n}.webp', quality=QUALITY, method=6)
    # 顔
    cx, cy, s = FACE[n]
    face = rgba.crop((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2))
    face = face.convert('RGBa').resize((FACE_PX, FACE_PX), Image.LANCZOS).convert('RGBA')
    face.save(f'{OUT}/{n}-face.webp', quality=QUALITY, method=6)
    meta[n] = size
    print(n, 'body', size, 'face', FACE_PX)
print('SIZE =', meta)
