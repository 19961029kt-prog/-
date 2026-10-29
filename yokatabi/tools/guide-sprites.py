# 案内人の3匹の絵を、運営の設定画（tools/guides-source.gif・640×360・30コマ・1コマ100ms）から切り抜いて、
# img/guides/ に、全身と吹き出しの顔の「動く絵（アニメーションの WebP）」と「止まった絵（1コマ目）」を作る。
#   python3 -I tools/guide-sprites.py tools/guides-source.gif img/guides
# 設定画をそのまま使う（描き直さない・色も変えない）。背景だけを透明にし、3匹を1匹ずつに分ける。
# 1) 3匹のいる範囲を、暗い画素（輪郭の墨の線）にぶつかるまで外側から塗る → 塗られなかったところが絵
# 2) その匹だけの色の印（ツシ丸＝青い手ぬぐい・ゴロ太＝赤い前掛け・カチ助＝帽子の赤い帯）から絵の中を1画素ずつ広げ、
#    先に届いた匹のものにする。匹どうしがふれるあたりでは、色で持ち主を決める（相手の色には入らない）
# 3) 背景の細い線や雲につながって入りこんだところ・小さなかけら・上の題字の名残りを落とす
# 4) 30コマを同じ大きさの枠にそろえて書き出す（Pillow と numpy だけを使う）
import sys
from collections import deque
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
T = 175                    # これより暗い画素を輪郭とみなす（白い毛が背景に溶けないよう明るめ）
BOX = (36, 34, 640, 306)   # 3匹のいる範囲（題字と下の帯を外す）
NAMES = ['tsushimaru', 'gorota', 'kachisuke']
STILL = {'tsushimaru': 0, 'gorota': 0, 'kachisuke': 0}  # 止まった絵に使うコマ
QUALITY = 72   # 全身（歓迎の窓）。GIF の点描のざらつきは、書き出す前に少しならす（BLUR）
BLUR = 0.6
# 吹き出しの顔：顔のまわりを正方形に切り出して FACE_PX に縮める（吹き出しの顔は 54px なので、その2倍くらい）。
# 大きさ S、印（手ぬぐい・前掛け・帽子の帯）の重心からのずれ (dx, dy)、印を追いかける割合 F
# （ゴロ太の跳ねる・カチ助の上下する動きで、顔が円の外へ出ないように。少しだけ動きを残す）
FACE = {'tsushimaru': (172, (-10, -56), 0.6), 'gorota': (160, (0, -56), 0.8), 'kachisuke': (164, (-16, 14), 0.8)}
FACE_PX, FACE_QUALITY = 112, 72

src = Image.open(SRC)
frames, durations = [], []
i = 0
while True:
    try:
        src.seek(i)
    except EOFError:
        break
    durations.append(src.info.get('duration', 100))
    frames.append(src.convert('RGB').crop(BOX).copy())  # fromarray の画像は書きこめないので、ここでも写しを持つ
    i += 1
N = len(frames)


def mask_img(m):
    return Image.fromarray((m * 255).astype('uint8'), 'L')


def alpha_of(crop):
    a = np.asarray(crop).astype(int)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    free = mask_img(lum >= T).filter(ImageFilter.MinFilter(3)).copy()
    w, h = free.size
    for p in [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]:
        if free.getpixel(p) == 255:
            ImageDraw.floodfill(free, p, 128, thresh=0)
    return np.asarray(free) != 128, a


def components(al):
    H, W = al.shape
    lab = np.zeros((H, W), np.int32)
    sizes = {}
    n = 0
    for y0, x0 in zip(*np.where(al)):
        if lab[y0, x0]:
            continue
        n += 1
        q = deque([(y0, x0)])
        lab[y0, x0] = n
        c = 0
        while q:
            y, x = q.popleft()
            c += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and al[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
        sizes[n] = c
    return lab, sizes


cuts = {n: [] for n in NAMES}
for crop in frames:
    alpha, a = alpha_of(crop)
    H, W = alpha.shape
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    xs = np.arange(W)[None, :].repeat(H, 0) + BOX[0]   # 設定画の上の x
    ys = np.arange(H)[:, None].repeat(W, 1) + BOX[1]
    # GIF の点描（ディザ）で色がまだらなので、ぼかした色も使う
    sm = np.asarray(crop.filter(ImageFilter.BoxBlur(2))).astype(int)
    sr, sg, sb = sm[..., 0], sm[..., 1], sm[..., 2]

    # ゴロ太の背中とカチ助の羽が重なるあたり：青緑・紺の羽はカチ助、灰緑の体・桃色・赤はゴロ太
    zone = (xs >= 350) & (xs <= 410)
    magpie_c = zone & (((b - r > 30) & (lum < 200)) | ((lum > 190) & (b - r > 12)))
    fish_c = zone & (((r - b > 15) & (g - b > 8) & (lum > 80) & (lum < 205)) | ((r - g > 50) & (r > 150)))
    # 右下の九州の形（サーモン色）はカチ助から外す
    blob = (xs > 540) & (ys > 240) & (r - b > 50) & (lum > 120)
    # ツシ丸のしっぽがゴロ太の胸びれにふれるコマがある：その境目では、毛の色（黄土・こげ茶の縞）とそのふちの線にゴロ太は入らない
    zone2 = (xs >= 195) & (xs <= 262)
    cat_c = zone2 & ((sr - sg) > 16) & ((sg - sb) > 18)
    cat_c = zone2 & (np.asarray(mask_img(cat_c).filter(ImageFilter.MaxFilter(7))) > 0)
    forbid = {1: np.zeros_like(alpha), 2: magpie_c | (xs > 405) | cat_c, 3: fish_c | (xs < 350) | blob}

    # 色の印
    blue = (b > 110) & (r < 90) & (b - r > 50)
    red = (r > 160) & (g < 90) & (b < 90)
    anchors = {1: blue & (xs < 250), 2: red & (xs >= 230) & (xs < 404), 3: red & (xs >= 414)}
    owner = np.zeros((H, W), dtype=np.int8)
    seeds = deque()
    for idx, m in anchors.items():
        m = m & alpha
        owner[m] = idx
        seeds.extend(zip(*np.where(m)))
    while seeds:
        y, x = seeds.popleft()
        o = owner[y, x]
        fb = forbid[o]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and alpha[ny, nx] and owner[ny, nx] == 0 and not fb[ny, nx]:
                owner[ny, nx] = o
                seeds.append((ny, nx))
    # 背景の細い線や雲につながって入りこんだところ：太く削って残る芯から、もとの太さまで戻したところだけを残す
    for idx in (1, 2, 3):
        m = owner == idx
        back = np.asarray(mask_img(m).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(9))) > 0
        owner[m & ~back] = 0

    for idx, n in enumerate(NAMES, start=1):
        m = owner == idx
        if n == 'kachisuke':
            # 上の左右のすみに入りこむ、題字や飾りの赤茶・サーモン色（帽子の帯はこのすみには来ない）
            lx, ly = xs - 360, ys - BOX[1]
            m &= ~(((sr - sb) > 25) & (((lx < 50) & (ly < 30)) | ((lx > 150) & (ly < 70))))
            # 題字の「P」の名残り（羽の先がふれるコマだけ）：その四角では、羽の青白い色のほかは消す
            m &= ~((lx >= 18) & (lx < 52) & (ly < 24) & ~((b - r) > 8))
        # 小さなかけら：ツシ丸・ゴロ太は、いちばん大きなかたまりの2%より小さいもの。
        # カチ助は羽の先が離れて見えるので、40画素より小さいものと、2%より小さい赤みのものだけ
        lab, sizes = components(m)
        if sizes:
            big = max(sizes.values())
            for li, c in sizes.items():
                if n == 'kachisuke':
                    warm = c < big * 0.02 and (a[lab == li][:, 0] - a[lab == li][:, 2]).mean() > 20
                    gone = c < 40 or warm
                else:
                    gone = c < big * 0.02
                if gone:
                    m[lab == li] = False
        rgba = crop.convert('RGBA')
        rgba.putalpha(mask_img(m))
        cuts[n].append(rgba)

def face_anchor(f, n):
    a = np.asarray(f).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3] > 0
    yy = np.mgrid[0:a.shape[0], 0:a.shape[1]][0]
    if n == 'tsushimaru':
        m = (b > 110) & (r < 90) & (b - r > 50)
    elif n == 'gorota':
        m = (r > 160) & (g < 90) & (b < 90) & (yy > 80)    # 前掛け（口の中の赤は外す）
    else:
        m = (r > 160) & (g < 90) & (b < 90) & (yy < 120)   # 帽子の帯
    ys, xs = np.where(m & al)
    return np.array([xs.mean(), ys.mean()])


def soften(f):
    rgb = f.convert('RGB').filter(ImageFilter.GaussianBlur(BLUR)).convert('RGBA')
    rgb.putalpha(f.getchannel('A'))
    return rgb


def save_anim(path, cs, q):
    cs[0].save(path, save_all=True, append_images=cs[1:], duration=durations, loop=0, quality=q, method=6, minimize_size=True)


for n in NAMES:
    bb = None
    for c in cuts[n]:
        x = c.getchannel('A').getbbox()
        if x:
            bb = x if bb is None else (min(bb[0], x[0]), min(bb[1], x[1]), max(bb[2], x[2]), max(bb[3], x[3]))
    cs = [c.crop(bb) for c in cuts[n]]
    full = [soften(c) for c in cs]
    save_anim(f'{OUT}/{n}.webp', full, QUALITY)
    full[STILL[n]].save(f'{OUT}/{n}-still.webp', quality=QUALITY, method=6)
    # 顔：印の重心を前後のコマとならして追いかける
    S, (dx, dy), F = FACE[n]
    an = np.array([face_anchor(c, n) for c in cs])
    sm = np.array([(an[(k - 1) % N] + an[k] * 2 + an[(k + 1) % N]) / 4 for k in range(N)])
    base = an.mean(0)
    faces = []
    for k, c in enumerate(cs):
        cx, cy = base + (sm[k] - base) * F + np.array([dx, dy])
        x0, y0 = int(round(cx - S / 2)), int(round(cy - S / 2))
        faces.append(full[k].crop((x0, y0, x0 + S, y0 + S)).resize((FACE_PX, FACE_PX), Image.LANCZOS))
    save_anim(f'{OUT}/{n}-face.webp', faces, FACE_QUALITY)
    faces[STILL[n]].save(f'{OUT}/{n}-face-still.webp', quality=FACE_QUALITY, method=6)
    print(n, 'size', cs[0].size, 'at', (bb[0] + BOX[0], bb[1] + BOX[1]), 'frames', N)
