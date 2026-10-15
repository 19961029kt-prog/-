#!/usr/bin/env python3
"""
drawing_diff.py — 図面PDF（旧版 / 新版）の視覚的差分ハイライトツール

旧版と新版の図面PDFをピクセル単位で比較し、
  削除（旧版にのみ存在）  → 赤
  追加（新版にのみ存在）  → 青
  共通（両方に存在）      → 薄いグレー
で合成した全体図・変更箇所ごとの拡大図・変更箇所一覧（CSV）を出力する。

対応する図面:
  - スキャン図面（画像だけのPDF。ズレ・傾き・汚れあり）
  - CAD から出力したベクターPDF（極細線・極小文字・超長尺。例: 3200mm × 85mm, 文字 0.7pt）

処理パイプライン（ページごと）:
  1. 図面の種類（スキャン / CAD）を判定し、解析解像度を決める
     CAD 図面: 文字情報あり → 600dpi（文字の変更は文字比較で拾う）/ 文字情報なし → 1200dpi
  2. 低解像度の全体画像で、線の濃さのしきい値と位置合わせ（回転・拡縮・平行移動）を求める
     チャンファーマッチング（粗→細）。CAD 図面で座標が一致していれば「ズレなし」に確定する
  3. ページをタイルに分けて高解像度でレンダリング（新版は位置合わせの変換をかけて直接描画）
  4. タイルごとに許容幅付き差分:
       removed = old_ink AND NOT dilate(new_ink, tol)
       added   = new_ink AND NOT dilate(old_ink, tol)
     → ノイズ除去（開処理 + 小面積成分の除去）
  5. 結果を表示用解像度に縮小して全体図を作る（細かい差分も消えないよう最大値で縮小）
  6. 文字情報を持つPDF（CAD 出力など）は、文字列と位置でも比較する（「8k427 → 8k437」のように記録）
  7. 近い差分を変更箇所にまとめ、箇所ごとに高解像度の拡大図（差分 / 旧版 / 新版）を作る

使い方:
  python drawing_diff.py old_drawing.pdf new_drawing.pdf -o diff_out
  python drawing_diff.py old.pdf new.pdf -o out --dpi 600 --kind cad
"""
from __future__ import annotations

import argparse
import csv
import math
import sys
import time
from dataclasses import dataclass, field, replace
from pathlib import Path

import cv2
import numpy as np
import pymupdf as fitz  # PyMuPDF

# OpenCV は BGR 順
COLOR_REMOVED = (0, 0, 230)      # 赤
COLOR_ADDED = (230, 90, 0)       # 青
COLOR_COMMON = (200, 200, 200)   # 薄いグレー
COLOR_BOX = (0, 150, 255)        # 橙（変更箇所の枠）

MM_PER_INCH = 25.4
TEXT_FLAGS = fitz.TEXTFLAGS_TEXT  # 文字だけ取り出す（画像を含めると巨大なスキャン画像の抽出で非常に遅い）
TILE_MARGIN = 32                 # タイルの重なり [px]（膨張・ノイズ除去が境界で欠けないように）


# ----------------------------------------------------------------------------
# パラメータ
# ----------------------------------------------------------------------------
@dataclass
class Params:
    dpi: int = 0                # 0 = 自動（CAD: 600 / 文字情報のない CAD: 1200 / スキャン: 300）
    text: bool = True           # 文字情報があれば文字列でも比較する
    kind: str = "auto"          # auto / cad / scan
    # 以下はスキャン図面用。値は 300dpi 基準で、解析 dpi に合わせて自動換算する
    blur: int = 3
    threshold: int = 0          # 0=自動（CAD: 235 / スキャン: Otsu）、1-254=固定
    tolerance: int = 3
    open_kernel: int = 2
    min_area: int = 30
    # 共通
    align: str = "auto"         # auto / none
    cluster: int = 40           # 近接した差分をまとめる距離 [px @300dpi]
    common_alpha: float = 1.0
    max_display_pixels: int = 60_000_000      # 全体図の最大画素数（超えたら縮小して出力）
    max_analysis_pixels: int = 1_500_000_000  # 解析の最大画素数（超えたら dpi を下げる）
    details: int = 200          # 拡大図を作る変更箇所の上限（0 で作らない）


@dataclass
class PageInfo:
    kind: str                   # cad / scan
    text_size: float            # 小さい方から 10% 位の文字サイズ [pt]（文字がなければ 0）
    n_text: int
    n_images: int
    n_paths: int


@dataclass
class Transform:
    """新版ページ座標 → 旧版ページ座標（いずれも同じ解像度の画素単位）。
    p_old = sc * R(th) * (p_new - c) + c + t"""
    th: float = 0.0
    sc: float = 1.0
    tx: float = 0.0
    ty: float = 0.0
    cx: float = 0.0
    cy: float = 0.0
    identity: bool = True

    def scaled(self, r: float) -> "Transform":
        return replace(self, tx=self.tx * r, ty=self.ty * r, cx=self.cx * r, cy=self.cy * r)


@dataclass
class DiffParams:
    """解析解像度での画素単位の実パラメータ"""
    blur: bool
    thr_old: int
    thr_new: int
    tol: int
    open_k: int
    min_area: int


# ----------------------------------------------------------------------------
# 1. 図面の種類と解像度
# ----------------------------------------------------------------------------
def page_info(page: fitz.Page) -> PageInfo:
    area = page.rect.width * page.rect.height
    imgs = page.get_image_info()
    img_area = sum(fitz.Rect(i["bbox"]).get_area() for i in imgs)
    n_paths = len(page.get_cdrawings())
    sizes = sorted(s["size"] for b in page.get_text("dict", flags=TEXT_FLAGS)["blocks"] for l in b.get("lines", [])
                   for s in l["spans"] if s["text"].strip())
    text_size = sizes[len(sizes) // 10] if sizes else 0.0
    scan = img_area > 0.5 * area or (n_paths < 50 and not sizes)
    return PageInfo("scan" if scan else "cad", text_size, len(sizes), len(imgs), n_paths)


def auto_dpi(info: PageInfo) -> int:
    if info.kind == "scan":
        return 300
    if info.n_text >= 10:
        return 600   # 文字の変更は文字比較で拾うので、線・記号が確実に見える 600dpi で十分
    return 1200      # 文字が線で描かれている図面は、細かい文字も画素で比べる


# ----------------------------------------------------------------------------
# 2. レンダリング
# ----------------------------------------------------------------------------
class PageRenderer:
    """1 ページを任意の変換・範囲で繰り返し描画する（ディスプレイリストを再利用）"""

    def __init__(self, page: fitz.Page):
        self.page = page
        self.rect = page.rect
        self.dl = page.get_displaylist()

    def render(self, s: float, ox: float, oy: float, w: int, h: int, T: Transform | None = None) -> np.ndarray:
        """ページを倍率 s で描画し、(ox, oy) を左上とする w×h の RGB 画像を返す。
        T を渡すと、そのページを T で旧版の座標系に移してから切り出す。"""
        out = np.full((h, w, 3), 255, dtype=np.uint8)
        if T is None or T.identity:
            m = fitz.Matrix(s, 0, 0, s, -ox, -oy)
            clip = fitz.Rect(ox / s, oy / s, (ox + w) / s, (oy + h) / s)
        else:
            c, sn = math.cos(T.th), math.sin(T.th)
            a, b = T.sc * c * s, T.sc * sn * s
            e = -T.sc * (c * T.cx - sn * T.cy) + T.cx + T.tx - ox
            f = -T.sc * (sn * T.cx + c * T.cy) + T.cy + T.ty - oy
            m = fitz.Matrix(a, b, -b, a, e, f)
            inv = ~m
            pts = [fitz.Point(x, y) * inv for x in (0, w) for y in (0, h)]
            clip = fitz.Rect(min(p.x for p in pts), min(p.y for p in pts),
                             max(p.x for p in pts), max(p.y for p in pts)) + (-2, -2, 2, 2)
        clip &= self.rect
        if clip.is_empty:
            return out
        pix = self.dl.get_pixmap(matrix=m, clip=clip, alpha=False, colorspace=fitz.csRGB)
        img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.stride)[:, : pix.width * 3]
        img = img.reshape(pix.height, pix.width, 3)
        x0, y0 = pix.x, pix.y
        sx0, sy0 = max(0, -x0), max(0, -y0)
        dx0, dy0 = max(0, x0), max(0, y0)
        cw = min(w - dx0, pix.width - sx0)
        ch = min(h - dy0, pix.height - sy0)
        if cw > 0 and ch > 0:
            out[dy0:dy0 + ch, dx0:dx0 + cw] = img[sy0:sy0 + ch, sx0:sx0 + cw]
        return out


def to_gray(rgb: np.ndarray) -> np.ndarray:
    """最も暗いチャンネルを濃さとする（黄・水色などの色線も「線」として拾う）"""
    r, g, b = cv2.split(rgb)
    return cv2.min(cv2.min(r, g), b)


def ink(gray: np.ndarray, thr: int, blur: bool) -> np.ndarray:
    g = cv2.blur(gray, (3, 3)) if blur else gray
    return (g <= thr).astype(np.uint8)


def otsu(gray: np.ndarray, blur: bool) -> int:
    g = cv2.blur(gray, (3, 3)) if blur else gray
    t, _ = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return int(t)


# ----------------------------------------------------------------------------
# 3. 位置合わせ（チャンファーマッチング, 粗→細）
# ----------------------------------------------------------------------------
def _maxpool(m: np.ndarray, f: int) -> np.ndarray:
    """0/1 マスクを f×f ブロックごとに「1 があれば 1」で縮小する"""
    if f == 1:
        return m
    h, w = m.shape
    H, W = -(-h // f) * f, -(-w // f) * f
    if (H, W) != (h, w):
        pad = np.zeros((H, W), np.uint8)
        pad[:h, :w] = m
        m = pad
    if f <= 15:  # 面積平均で縮小し、0 より大きければ 1（255/f² ≥ 1 なので 1 画素でも残る）
        return (cv2.resize(m * np.uint8(255), (W // f, H // f), interpolation=cv2.INTER_AREA) > 0).astype(np.uint8)
    return m.reshape(H // f, f, W // f, f).max(axis=(1, 3))


def estimate(old_m: np.ndarray, new_m: np.ndarray, cx: float, cy: float) -> Transform:
    """new_m を old_m に重ねる変換を推定する。座標は old_m の画素単位、中心 (cx, cy)。"""
    CAP = 8.0
    long = max(old_m.shape)
    f_coarse = max(1, math.ceil(long / 400))
    f_fine = max(1, math.ceil(long / 3000))
    levels = []
    f = f_coarse
    while f > f_fine:
        levels.append(f)
        f = math.ceil(f / 2)
    levels.append(f_fine)

    th = 0.0; sc = 1.0; tx = 0.0; ty = 0.0
    best = id_cost = 0.0
    for li, f in enumerate(levels):
        o = _maxpool(old_m, f)
        dt = cv2.distanceTransform((1 - o).astype(np.uint8), cv2.DIST_L2, 3)
        np.minimum(dt, CAP, out=dt)
        n = _maxpool(new_m, f)
        ys, xs = np.nonzero(n)
        if len(xs) == 0:
            return Transform(cx=cx, cy=cy)
        step = max(1, len(xs) // (1500 if li == 0 else 30000))
        px = (xs[::step] + 0.5) * f - cx
        py = (ys[::step] + 0.5) * f - cy
        oh, ow = dt.shape

        def cost(th_, sc_, tx_, ty_):
            c, s = math.cos(th_), math.sin(th_)
            u = (sc_ * (c * px - s * py) + cx + tx_) / f - 0.5
            v = (sc_ * (s * px + c * py) + cy + ty_) / f - 0.5
            ok = (u >= 0) & (v >= 0) & (u < ow - 1) & (v < oh - 1)
            uu, vv = u[ok], v[ok]
            x0, y0 = uu.astype(np.int32), vv.astype(np.int32)
            ax, ay = uu - x0, vv - y0
            val = (dt[y0, x0] * (1 - ax) + dt[y0, x0 + 1] * ax) * (1 - ay) + \
                  (dt[y0 + 1, x0] * (1 - ax) + dt[y0 + 1, x0 + 1] * ax) * ay
            return (val.sum() + CAP * (len(u) - len(uu))) / len(u)

        if li == 0:
            # 粗い全探索: ±15% の平行移動 × ±1.5° の回転（整数画素・最近傍で高速に）
            rx, ry = round(0.15 * ow), round(0.15 * oh)
            dtp = np.full((oh + 2 * ry + 2, ow + 2 * rx + 2), CAP, np.float32)
            dtp[ry + 1:ry + 1 + oh, rx + 1:rx + 1 + ow] = dt
            ii = np.arange(-rx, rx + 1)
            best = np.inf
            for a in range(-6, 7):
                t = math.radians(a * 0.25)
                c, s = math.cos(t), math.sin(t)
                u = np.rint((c * px - s * py + cx) / f - 0.5).astype(np.int64)
                v = np.rint((s * px + c * py + cy) / f - 0.5).astype(np.int64)
                U = np.clip(u[:, None] + ii[None, :] + rx + 1, 0, dtp.shape[1] - 1)
                for j in range(-ry, ry + 1):
                    V = np.clip(v + j + ry + 1, 0, dtp.shape[0] - 1)
                    costs = dtp[V[:, None], U].mean(axis=0)
                    k = int(costs.argmin())
                    if costs[k] < best:
                        best = float(costs[k]); th = t; tx = float(ii[k] * f); ty = float(j * f)
        # 局所探索（山登り）。刻みを半分ずつ細かくする
        cur = cost(th, sc, tx, ty)
        for frac in (1.0, 0.5, 0.25):
            ts = f * frac
            asz = ts / (long / 2)
            for _ in range(400):
                cands = [(th, sc, tx + ts, ty), (th, sc, tx - ts, ty), (th, sc, tx, ty + ts), (th, sc, tx, ty - ts),
                         (th + asz, sc, tx, ty), (th - asz, sc, tx, ty),
                         (th, sc * (1 + asz), tx, ty), (th, sc * (1 - asz), tx, ty)]
                vals = [cost(*cd) if 0.8 < cd[1] < 1.25 else np.inf for cd in cands]
                k = int(np.argmin(vals))
                if vals[k] >= cur - 1e-9:
                    break
                th, sc, tx, ty = cands[k]; cur = vals[k]
        best = cur
        id_cost = cost(0.0, 1.0, 0.0, 0.0)
    # 推定したズレが半画素未満、または「ズレなし」とほぼ同じ一致度なら、ズレなしに確定
    # （CAD 図面の改訂は座標が一致することが多く、そのときは許容幅を最小にできる）
    tiny = max(abs(tx), abs(ty), abs(th) * long / 2, abs(sc - 1) * long / 2) < 0.5
    if tiny or id_cost <= best * 1.05 + 0.005:
        return Transform(cx=cx, cy=cy, identity=True)
    return Transform(th, sc, tx, ty, cx, cy, identity=False)


# ----------------------------------------------------------------------------
# 4. 差分
# ----------------------------------------------------------------------------
def _disk(r: int) -> np.ndarray:
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def remove_small(mask: np.ndarray, min_area: int) -> np.ndarray:
    if min_area <= 1 or not mask.any():
        return mask
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    keep = np.zeros(n, dtype=np.uint8)
    keep[1:][stats[1:, cv2.CC_STAT_AREA] >= min_area] = 1
    return keep[labels]


def diff_masks(old_g: np.ndarray, new_g: np.ndarray, dp: DiffParams):
    old_m = ink(old_g, dp.thr_old, dp.blur)
    new_m = ink(new_g, dp.thr_new, dp.blur)
    if dp.tol > 0:
        k = _disk(dp.tol)
        old_d, new_d = cv2.dilate(old_m, k), cv2.dilate(new_m, k)
    else:
        old_d, new_d = old_m, new_m
    removed = old_m & (1 - new_d)
    added = new_m & (1 - old_d)
    if dp.open_k > 1:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (dp.open_k, dp.open_k))
        removed = cv2.morphologyEx(removed, cv2.MORPH_OPEN, k)
        added = cv2.morphologyEx(added, cv2.MORPH_OPEN, k)
    removed = remove_small(removed, dp.min_area)
    added = remove_small(added, dp.min_area)
    return old_m, new_m, removed, added


# ----------------------------------------------------------------------------
# 5. 変更箇所のまとめ
# ----------------------------------------------------------------------------
@dataclass
class Region:
    x: int
    y: int
    w: int
    h: int
    removed_px: int
    added_px: int
    notes: list[str] = field(default_factory=list)   # 文字の変更内容

    @property
    def kind(self) -> str:
        if self.removed_px and self.added_px:
            return "変更"
        return "削除" if self.removed_px else "追加"


def find_regions(removed: np.ndarray, added: np.ndarray, cluster: int, pad: int) -> list[Region]:
    both = (removed | added).astype(np.uint8)
    if not both.any():
        return []
    s = 4
    small = _maxpool(both, s) * 255
    merged = cv2.dilate(small, _disk(max(1, cluster // s)))
    n, _, stats, _ = cv2.connectedComponentsWithStats(merged, connectivity=8)
    H, W = both.shape
    regions = []
    for i in range(1, n):
        x, y, w, h = (int(v) * s for v in stats[i, :4])
        x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
        ys, xs = np.nonzero(both[y0:y1, x0:x1])
        if len(xs) == 0:
            continue
        bx0, by0 = max(0, x0 + xs.min() - pad), max(0, y0 + ys.min() - pad)
        bx1, by1 = min(W, x0 + xs.max() + 1 + pad), min(H, y0 + ys.max() + 1 + pad)
        rp = int(np.count_nonzero(removed[by0:by1, bx0:bx1]))
        ap = int(np.count_nonzero(added[by0:by1, bx0:bx1]))
        regions.append(Region(int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0), rp, ap))
    band = max(1, H // 40)
    regions.sort(key=lambda r: (r.y // band, r.x))
    return regions


# ----------------------------------------------------------------------------
# 文字の比較（文字情報を持つ PDF のみ）
# ----------------------------------------------------------------------------
@dataclass
class TextItem:
    text: str
    rect: fitz.Rect     # 表示上のページ座標 [pt]


def text_items(page: fitz.Page) -> list[TextItem]:
    rm = page.rotation_matrix   # 文字の座標は回転前の向きで返るので、表示の向きに直す
    out = []
    for b in page.get_text("dict", flags=TEXT_FLAGS)["blocks"]:
        for l in b.get("lines", []):
            for sp in l["spans"]:
                t = sp["text"].strip()
                if t:
                    out.append(TextItem(t, fitz.Rect(sp["bbox"]) * rm))
    return out


def _center(r: fitz.Rect) -> tuple[float, float]:
    return (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2


def text_align(old: list[TextItem], new: list[TextItem], cx: float, cy: float) -> Transform | None:
    """両方の版に 1 回だけ出てくる文字列（駅名・キロ程など）の位置から、新版→旧版の変換を求める [pt]"""
    def uniq(items):
        cnt: dict[str, list[TextItem]] = {}
        for it in items:
            if len(it.text) >= 2:
                cnt.setdefault(it.text, []).append(it)
        return {t: v[0] for t, v in cnt.items() if len(v) == 1}
    uo, un = uniq(old), uniq(new)
    keys = [t for t in un if t in uo]
    if len(keys) < 12:
        return None
    src = np.float32([_center(un[t].rect) for t in keys])
    dst = np.float32([_center(uo[t].rect) for t in keys])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=1.0,
                                         maxIters=5000, confidence=0.999)
    if M is None or inl is None or inl.sum() < max(10, 0.3 * len(keys)):
        return None
    a, b = float(M[0, 0]), float(M[1, 0])
    sc, th = math.hypot(a, b), math.atan2(b, a)
    c, s = math.cos(th), math.sin(th)
    # p_old = M p_new = sc R (p_new - c) + c + t  →  t = M c - c
    tx = M[0, 0] * cx + M[0, 1] * cy + M[0, 2] - cx
    ty = M[1, 0] * cx + M[1, 1] * cy + M[1, 2] - cy
    return Transform(th, sc, float(tx), float(ty), cx, cy, identity=False)


def text_diff(old: list[TextItem], new: list[TextItem], T: Transform) -> list[tuple[fitz.Rect, int, str]]:
    """(範囲[pt], 種別ビット 1=削除 2=追加, 説明) のリスト。T は pt 単位の変換。"""
    if not T.identity:
        c, s = math.cos(T.th), math.sin(T.th)
        def mv(p):
            x, y = p.x - T.cx, p.y - T.cy
            return fitz.Point(T.sc * (c * x - s * y) + T.cx + T.tx, T.sc * (s * x + c * y) + T.cy + T.ty)
        new = [TextItem(n.text, fitz.Rect(mv(n.rect.tl), mv(n.rect.br)).normalize()) for n in new]
    G = 4.0  # 近傍検索の格子 [pt]

    def cell(r):
        x, y = _center(r)
        return int(x // G), int(y // G)

    grid: dict[tuple, list[int]] = {}
    for i, o in enumerate(old):
        cx_, cy_ = cell(o.rect)
        grid.setdefault((o.text, cx_, cy_), []).append(i)
    used = [False] * len(old)
    added = []
    for n in new:
        tol = max(0.75, 0.5 * min(n.rect.width, n.rect.height))
        nx, ny = _center(n.rect)
        cx_, cy_ = cell(n.rect)
        best, bd = -1, tol
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in grid.get((n.text, cx_ + dx, cy_ + dy), ()):
                    if used[i]:
                        continue
                    ox, oy = _center(old[i].rect)
                    d = math.hypot(ox - nx, oy - ny)
                    if d <= bd:
                        best, bd = i, d
        if best >= 0:
            used[best] = True
        else:
            added.append(n)
    removed = [o for o, u in zip(old, used) if not u]
    # 近くにある「削除」と「追加」を「変更」として組にする
    agrid: dict[tuple, list[int]] = {}
    for j, a in enumerate(added):
        agrid.setdefault(cell(a.rect), []).append(j)
    out = []
    taken = [False] * len(added)
    for r in removed:
        reach = max(2.0, 1.5 * min(r.rect.width, r.rect.height))
        g = fitz.Rect(r.rect) + (-reach, -reach, reach, reach)
        rx, ry = cell(r.rect)
        span = int(reach // G) + 2
        best, bd = -1, None
        for dx in range(-span, span + 1):
            for dy in range(-span, span + 1):
                for j in agrid.get((rx + dx, ry + dy), ()):
                    a = added[j]
                    if taken[j] or not g.intersects(a.rect):
                        continue
                    d = abs(a.rect.x0 - r.rect.x0) + abs(a.rect.y0 - r.rect.y0)
                    if bd is None or d < bd:
                        best, bd = j, d
        if best >= 0:
            taken[best] = True
            a = added[best]
            desc = f"位置変更「{r.text}」" if a.text == r.text else f"「{r.text}」→「{a.text}」"
            out.append((fitz.Rect(r.rect) | a.rect, 3, desc))
        else:
            out.append((r.rect, 1, f"文字削除「{r.text}」"))
    for j, a in enumerate(added):
        if not taken[j]:
            out.append((a.rect, 2, f"文字追加「{a.text}」"))
    return out


def merge_text_changes(regions: list[Region], changes, D: float, pad: int, shape) -> list[Region]:
    """文字の変更を変更箇所に統合する（重なる箇所があれば説明を付け、なければ新しい箇所にする）"""
    H, W = shape
    s = D / 72
    for rect, bits, desc in changes:
        x0, y0 = max(0, int(rect.x0 * s) - pad), max(0, int(rect.y0 * s) - pad)
        x1, y1 = min(W, int(math.ceil(rect.x1 * s)) + pad), min(H, int(math.ceil(rect.y1 * s)) + pad)
        hit = None
        for g in regions:
            if g.x < x1 and x0 < g.x + g.w and g.y < y1 and y0 < g.y + g.h:
                hit = g
                break
        if hit is None:
            hit = Region(x0, y0, x1 - x0, y1 - y0, 0, 0)
            regions.append(hit)
        else:
            nx0, ny0 = min(hit.x, x0), min(hit.y, y0)
            hit.w, hit.h = max(hit.x + hit.w, x1) - nx0, max(hit.y + hit.h, y1) - ny0
            hit.x, hit.y = nx0, ny0
        hit.removed_px += 1 if bits & 1 else 0
        hit.added_px += 1 if bits & 2 else 0
        if desc not in hit.notes:
            hit.notes.append(desc)
    band = max(1, H // 40)
    regions.sort(key=lambda r: (r.y // band, r.x))
    return regions


# ----------------------------------------------------------------------------
# 6. 合成
# ----------------------------------------------------------------------------
def colorize(inkm: np.ndarray, removed: np.ndarray, added: np.ndarray, emph: int, alpha: float) -> np.ndarray:
    H, W = inkm.shape
    out = np.full((H, W, 3), 255, dtype=np.uint8)
    if alpha > 0:
        c = np.array(COLOR_COMMON, dtype=np.float32)
        out[inkm > 0] = (255 - (255 - c) * alpha).astype(np.uint8)
    if emph > 0:
        k = _disk(emph)
        removed, added = cv2.dilate(removed, k), cv2.dilate(added, k)
    out[removed > 0] = COLOR_REMOVED
    out[added > 0] = COLOR_ADDED
    return out


def draw_boxes(img: np.ndarray, regions: list[Region], scale: float, start: int = 1) -> None:
    thick = max(2, round(scale * 2))
    fs = max(0.6, scale * 1.2)
    for i, r in enumerate(regions, start):
        cv2.rectangle(img, (r.x, r.y), (r.x + r.w, r.y + r.h), COLOR_BOX, thick)
        label = str(i)
        (tw, th), base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, fs, thick)
        ty = r.y - 4 if r.y - th - 8 > 0 else r.y + r.h + th + 4
        cv2.rectangle(img, (r.x, ty - th - 4), (r.x + tw + 6, ty + base), COLOR_BOX, -1)
        cv2.putText(img, label, (r.x + 3, ty), cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), thick, cv2.LINE_AA)


def draw_legend(img: np.ndarray, n_regions: int, scale: float) -> None:
    s = max(0.7, scale * 1.5)
    t = max(1, round(scale * 2))
    items = [("Removed (old only)", COLOR_REMOVED), ("Added (new only)", COLOR_ADDED),
             ("Unchanged", (150, 150, 150)), (f"Changes: {n_regions}", COLOR_BOX)]
    lh, pad, width = int(36 * s), int(12 * s), int(330 * s)
    height = lh * len(items) + pad * 2
    if img.shape[0] < height + 2 * pad or img.shape[1] < width * 3:
        return
    x0 = y0 = pad
    roi = img[y0:y0 + height, x0:x0 + width]
    roi[:] = (roi.astype(np.uint16) * 0.15 + 255 * 0.85).astype(np.uint8)
    cv2.rectangle(img, (x0, y0), (x0 + width, y0 + height), (90, 90, 90), t)
    for i, (txt, col) in enumerate(items):
        cy = y0 + pad + lh * i + lh // 2
        cv2.rectangle(img, (x0 + pad, cy - lh // 4), (x0 + pad + lh, cy + lh // 4), col, -1)
        cv2.putText(img, txt, (x0 + pad * 2 + lh, cy + lh // 5), cv2.FONT_HERSHEY_SIMPLEX,
                    s * 0.75, (30, 30, 30), t, cv2.LINE_AA)


# ----------------------------------------------------------------------------
# ページの比較
# ----------------------------------------------------------------------------
@dataclass
class PageResult:
    overview: np.ndarray
    regions: list[Region]
    dpi: int            # 解析 dpi
    disp_dpi: float     # 全体図の dpi
    k: int              # 解析 → 全体図の縮小率
    kind: str
    T: Transform
    dp: DiffParams
    details: list[tuple[np.ndarray, np.ndarray, np.ndarray]] = field(default_factory=list)


def compare_page(old_page: fitz.Page, new_page: fitz.Page, p: Params, log=print) -> PageResult:
    info = page_info(old_page)
    kind = info.kind if p.kind == "auto" else p.kind
    dpi = p.dpi or auto_dpi(replace(info, kind=kind))
    wpt, hpt = old_page.rect.width, old_page.rect.height
    if wpt * hpt * (dpi / 72) ** 2 > p.max_analysis_pixels:
        new_dpi = int(72 * math.sqrt(p.max_analysis_pixels / (wpt * hpt)))
        log(f"    [警告] 図面が大きすぎるため解像度を {dpi} → {new_dpi} dpi に下げます (--max-analysis-pixels)")
        dpi = new_dpi
    S = dpi / 72
    W, H = math.ceil(wpt * S), math.ceil(hpt * S)
    k = max(1, math.ceil(math.sqrt(W * H / p.max_display_pixels)))
    why = f"（文字 {info.n_text} 個, 最小クラス {info.text_size:.2f}pt）" if kind == "cad" and info.n_text else ""
    log(f"    種類: {'CAD（ベクター）' if kind == 'cad' else 'スキャン'}  解析 {dpi}dpi {why}  "
        f"({wpt / 72 * 25.4:.0f}×{hpt / 72 * 25.4:.0f}mm, {W}×{H}px)  全体図 {dpi / k:.0f}dpi")

    ro, rn = PageRenderer(old_page), PageRenderer(new_page)

    # --- しきい値と位置合わせ（低解像度の全体画像で） ---
    A = min(S, math.sqrt(40e6 / (wpt * hpt)))
    old_a = to_gray(ro.render(A, 0, 0, math.ceil(wpt * A), math.ceil(hpt * A)))
    nr = new_page.rect
    new_a = to_gray(rn.render(A, 0, 0, math.ceil(nr.width * A), math.ceil(nr.height * A)))
    blur = kind == "scan" and p.blur > 1
    if p.threshold > 0:
        thr_o = thr_n = p.threshold
    elif kind == "cad":
        thr_o = thr_n = 235
    else:
        thr_o, thr_n = otsu(old_a, blur), otsu(new_a, blur)
    cxA, cyA = wpt * A / 2, hpt * A / 2
    to = tn = []
    if p.text and kind == "cad":
        to, tn = text_items(old_page), text_items(new_page)
    how = ""
    if p.align == "none":
        T = Transform(cx=cxA, cy=cyA)
    else:
        Tt = text_align(to, tn, wpt / 2, hpt / 2) if to and tn else None
        if Tt is not None:
            T, how = Tt.scaled(A), "（文字の位置から）"
            # 半画素（解析解像度）未満のズレなら「ズレなし」とする
            long = max(wpt, hpt) * S
            if max(abs(T.tx), abs(T.ty)) * S / A < 0.5 and max(abs(T.th), abs(T.sc - 1)) * long / 2 < 0.5:
                T = Transform(cx=cxA, cy=cyA)
        else:
            T = estimate(ink(old_a, thr_o, blur), ink(new_a, thr_n, blur), cxA, cyA)
    del old_a, new_a
    T = T.scaled(S / A)
    if T.identity:
        log(f"    位置合わせ: ズレなし{how}")
    else:
        mm = MM_PER_INCH / dpi
        log(f"    位置合わせ{how}: dx={T.tx * mm:+.2f}mm dy={T.ty * mm:+.2f}mm 回転={math.degrees(T.th):+.3f}° "
            f"倍率={T.sc:.5f}")

    # --- 差分パラメータ（解析解像度の画素単位） ---
    r300 = dpi / 300
    if kind == "cad":
        tol = 1 if T.identity else max(1, round(0.1 * dpi / MM_PER_INCH))
        dp = DiffParams(False, thr_o, thr_n, tol, 0, 4 if T.identity else max(4, tol * tol))
    else:
        dp = DiffParams(blur, thr_o, thr_n, max(0, round(p.tolerance * r300)),
                        round(p.open_kernel * r300), round(p.min_area * r300 * r300))

    # --- タイル処理 ---
    m = TILE_MARGIN
    TH = min(H, max(k, (4096 // k) * k))
    TW = min(W, max(k, ((32_000_000 // (TH + 2 * m) - 2 * m) // k) * k))
    dw, dh = -(-W // k), -(-H // k)
    ink_d = np.zeros((dh, dw), np.uint8)
    rem_d = np.zeros((dh, dw), np.uint8)
    add_d = np.zeros((dh, dw), np.uint8)
    tiles = [(x, y) for y in range(0, H, TH) for x in range(0, W, TW)]
    t0 = time.time()
    for ti, (X0, Y0) in enumerate(tiles):
        cw, ch = min(TW, W - X0), min(TH, H - Y0)
        ox, oy, tw, th_ = X0 - m, Y0 - m, cw + 2 * m, ch + 2 * m
        og = to_gray(ro.render(S, ox, oy, tw, th_))
        ng = to_gray(rn.render(S, ox, oy, tw, th_, T))
        old_m, new_m, removed, added = diff_masks(og, ng, dp)
        sl = (slice(m, m + ch), slice(m, m + cw))
        dy, dx = Y0 // k, X0 // k
        hh, ww = -(-ch // k), -(-cw // k)
        ink_d[dy:dy + hh, dx:dx + ww] |= _maxpool(old_m[sl] | new_m[sl], k)
        rem_d[dy:dy + hh, dx:dx + ww] |= _maxpool(removed[sl], k)
        add_d[dy:dy + hh, dx:dx + ww] |= _maxpool(added[sl], k)
        if len(tiles) > 1:
            print(f"\r    タイル {ti + 1}/{len(tiles)}  ({time.time() - t0:.0f}s)", end="", flush=True)
    if len(tiles) > 1:
        print()

    D = dpi / k
    pad = max(2, round(15 * D / 300))
    regions = find_regions(rem_d, add_d, max(4, round(p.cluster * D / 300)), pad)
    if to and tn:
        changes = text_diff(to, tn, T.scaled(1 / S))
        log(f"    文字の比較: {len(to)} / {len(tn)} 個中、変更 {len(changes)} 件")
        regions = merge_text_changes(regions, changes, D, pad, rem_d.shape)
    overview = colorize(ink_d, rem_d, add_d, max(1, round(D / 300)), p.common_alpha)
    draw_boxes(overview, regions, D / 300)
    draw_legend(overview, len(regions), D / 300)
    res = PageResult(overview, regions, dpi, D, k, kind, T, dp)

    # --- 変更箇所ごとの拡大図 ---
    for g in regions[: p.details]:
        res.details.append(detail(ro, rn, g, res, (W, H)))
    return res


def detail(ro: PageRenderer, rn: PageRenderer, g: Region, res: PageResult, size: tuple[int, int]):
    """変更箇所の周辺を高解像度で描き直し、(差分, 旧版, 新版) の画像を返す。"""
    S = res.dpi / 72
    W, H = size
    x0, y0, x1, y1 = g.x * res.k, g.y * res.k, (g.x + g.w) * res.k, (g.y + g.h) * res.k
    pad = max(0.6 * max(x1 - x0, y1 - y0), 3 * res.dpi / MM_PER_INCH)  # 3mm 以上の余白
    cx0, cy0 = max(0, int(x0 - pad)), max(0, int(y0 - pad))
    cx1, cy1 = min(W, int(x1 + pad)), min(H, int(y1 + pad))
    # 拡大図は解析 dpi とは別に、長辺 2000px・最大 2400dpi・800万画素に収まる解像度で描き直す
    r = min(2400 / res.dpi, 2000 / max(cx1 - cx0, cy1 - cy0),
            math.sqrt(8e6 / max(1, (cx1 - cx0) * (cy1 - cy0))))
    Sd = S * r
    ox, oy = cx0 * r, cy0 * r
    w, h = max(1, round((cx1 - cx0) * r)), max(1, round((cy1 - cy0) * r))
    old_rgb = ro.render(Sd, ox, oy, w, h)
    new_rgb = rn.render(Sd, ox, oy, w, h, res.T.scaled(r))
    if res.kind == "cad":
        tol = 1 if res.T.identity else max(1, round(0.1 * Sd * 72 / MM_PER_INCH))
        dp = replace(res.dp, tol=tol, min_area=4 if res.T.identity else max(4, tol * tol))
    else:
        dp = replace(res.dp, tol=max(1 if res.dp.tol else 0, round(res.dp.tol * r)),
                     open_k=round(res.dp.open_k * r), min_area=max(1, round(res.dp.min_area * r * r)))
    old_m, new_m, removed, added = diff_masks(to_gray(old_rgb), to_gray(new_rgb), dp)
    diff = colorize(old_m | new_m, removed, added, max(1, round(Sd * 72 / 1200)), 1.0)
    bx = (int(x0 * r - ox), int(y0 * r - oy), int((x1 - x0) * r), int((y1 - y0) * r))
    cv2.rectangle(diff, (bx[0], bx[1]), (bx[0] + bx[2], bx[1] + bx[3]), COLOR_BOX, max(2, w // 400))
    return diff, cv2.cvtColor(old_rgb, cv2.COLOR_RGB2BGR), cv2.cvtColor(new_rgb, cv2.COLOR_RGB2BGR)


# ----------------------------------------------------------------------------
# 出力
# ----------------------------------------------------------------------------
def _png_bytes(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    return buf.tobytes()


_CJK = None


def _cjk_font() -> fitz.Font:
    global _CJK
    if _CJK is None:
        _CJK = fitz.Font("cjk")
    return _CJK


def add_detail_page(pdf: fitz.Document, pno: int, no: int, g: Region, res: PageResult,
                    imgs: tuple[np.ndarray, np.ndarray, np.ndarray]) -> None:
    """A4 横の 1 ページに 差分 / 旧版 / 新版 を並べる"""
    page = pdf.new_page(width=842, height=595)
    page.insert_font(fontname="F0", fontbuffer=_cjk_font().buffer)  # 欧文も詰まって表示される日本語フォント
    mm = MM_PER_INCH / res.disp_dpi
    title = (f"変更箇所 {no}（{pno} ページ目）  {g.kind}   位置 x={g.x * mm:.1f}mm, y={g.y * mm:.1f}mm   "
             f"大きさ {g.w * mm:.1f}×{g.h * mm:.1f}mm")
    page.insert_text((28, 30), title, fontsize=11, fontname="F0")
    if g.notes:
        shown = g.notes[:12]
        note = "文字: " + " / ".join(shown) + (f" ほか {len(g.notes) - len(shown)} 件" if len(g.notes) > len(shown) else "")
        page.insert_textbox(fitz.Rect(28, 35, 814, 58), note, fontsize=7.5, fontname="F0", color=(0.6, 0.2, 0))
    captions = ("差分（赤＝削除　青＝追加）", "旧版", "新版")
    h, w = imgs[0].shape[:2]
    if w >= h * 1.3:   # 横長 → 縦に 3 段
        area_w, area_h, boxes = 786, (595 - 60 - 3 * 18) / 3, []
        y = 58
        for _ in range(3):
            boxes.append(fitz.Rect(28, y + 14, 28 + area_w, y + 14 + area_h)); y += area_h + 18
    else:              # 縦長・正方形 → 横に 3 列
        area_w, area_h = (842 - 56 - 2 * 12) / 3, 595 - 80
        boxes = [fitz.Rect(28 + i * (area_w + 12), 62, 28 + i * (area_w + 12) + area_w, 62 + area_h)
                 for i in range(3)]
    for img, cap, box in zip(imgs, captions, boxes):
        page.insert_text((box.x0, box.y0 - 4), cap, fontsize=9, fontname="F0")
        page.draw_rect(box, color=(0.75, 0.75, 0.75), width=0.5)
        page.insert_image(box, stream=_png_bytes(img), keep_proportion=True)


def process(old_pdf: Path, new_pdf: Path, out_dir: Path, p: Params, pages: list[int] | None) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    old_doc, new_doc = fitz.open(old_pdf), fitz.open(new_pdf)
    n_old, n_new = len(old_doc), len(new_doc)
    if n_old != n_new:
        print(f"[警告] ページ数が異なります（旧 {n_old} / 新 {n_new}）。共通ページ数分だけ比較します。")
    n = min(n_old, n_new)
    targets = [i for i in (pages or range(1, n + 1)) if 1 <= i <= n]

    out_pdf = fitz.open()
    detail_pages: list = []
    rows = []
    total = 0
    for pno in targets:
        t0 = time.time()
        print(f"[p{pno}]")
        res = compare_page(old_doc[pno - 1], new_doc[pno - 1], p)
        total += len(res.regions)
        print(f"    変更箇所 {len(res.regions)}  ({time.time() - t0:.1f}s)")

        png_path = out_dir / f"diff_p{pno:03d}.png"
        cv2.imwrite(str(png_path), res.overview, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        rect = old_doc[pno - 1].rect
        page = out_pdf.new_page(width=rect.width, height=rect.height)
        page.insert_image(page.rect, filename=str(png_path))

        mm = MM_PER_INCH / res.disp_dpi
        for i, g in enumerate(res.regions, 1):
            rows.append([pno, i, g.kind, round(g.x * mm, 1), round(g.y * mm, 1),
                         round(g.w * mm, 1), round(g.h * mm, 1), " / ".join(g.notes)])
        if res.details:
            ddir = out_dir / "details"
            ddir.mkdir(exist_ok=True)
            for old_f in ddir.glob(f"p{pno:03d}_*.png"):
                old_f.unlink()
            for i, (g, imgs) in enumerate(zip(res.regions, res.details), 1):
                diff, old_i, new_i = imgs
                sep = np.full((8, diff.shape[1], 3), 255, np.uint8) if diff.shape[1] >= diff.shape[0] * 1.3 \
                    else np.full((diff.shape[0], 8, 3), 255, np.uint8)
                stack = np.vstack if sep.shape[0] == 8 else np.hstack
                cv2.imwrite(str(ddir / f"p{pno:03d}_{i:03d}.png"), stack([diff, sep, old_i, sep, new_i]))
                detail_pages.append((pno, i, g, res, imgs))
            if len(res.regions) > len(res.details):
                print(f"    [注意] 拡大図は先頭 {len(res.details)} 箇所のみ作成しました（--details で変更）")

    for args in detail_pages:
        add_detail_page(out_pdf, *args)
    pdf_path = out_dir / "diff_result.pdf"
    if detail_pages:
        out_pdf.subset_fonts()  # 埋め込んだ日本語フォントを使った文字だけに減らす
    out_pdf.save(str(pdf_path), deflate=True, garbage=3)
    csv_path = out_dir / "changes.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:  # BOM 付き: Excel で文字化けしない
        w = csv.writer(f)
        w.writerow(["page", "no", "type", "x_mm", "y_mm", "w_mm", "h_mm", "text_change"])
        w.writerows(rows)

    print(f"\n完了: 変更箇所 合計 {total} 件")
    print(f"  PDF : {pdf_path}（全体図 + 変更箇所ごとの拡大図）")
    print(f"  PNG : {out_dir}/diff_pNNN.png, {out_dir}/details/")
    print(f"  CSV : {csv_path}")
    return total


def parse_pages(s: str | None) -> list[int] | None:
    if not s:
        return None
    out: list[int] = []
    for part in s.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def main(argv: list[str] | None = None) -> int:
    d = Params()
    ap = argparse.ArgumentParser(
        description="図面PDF（旧版/新版）をピクセル単位で比較し、削除=赤・追加=青でハイライトします。",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    ap.add_argument("old_pdf", type=Path, help="旧版PDF")
    ap.add_argument("new_pdf", type=Path, help="新版PDF")
    ap.add_argument("-o", "--out", type=Path, default=Path("diff_out"), help="出力フォルダ")
    ap.add_argument("--pages", help="比較するページ（例: 1,3,5-7）。省略時は全ページ")
    ap.add_argument("--kind", choices=["auto", "cad", "scan"], default=d.kind,
                    help="図面の種類。auto=自動判定、cad=CAD出力のベクターPDF、scan=スキャン画像のPDF")
    ap.add_argument("--dpi", type=int, default=d.dpi,
                    help="解析解像度。0=自動（CAD: 600、文字情報のないCAD: 1200、スキャン: 300）")
    ap.add_argument("--tolerance", type=int, default=d.tolerance,
                    help="[スキャン] 位置ズレ許容幅[px@300dpi]。誤検出が多い→上げる / 見逃す→下げる")
    ap.add_argument("--threshold", type=int, default=d.threshold,
                    help="線の濃さのしきい値。0=自動、1-254=固定（薄い線を拾うなら上げる）")
    ap.add_argument("--blur", type=int, default=d.blur, help="[スキャン] 二値化前のぼかし（0で無効）")
    ap.add_argument("--open-kernel", type=int, default=d.open_kernel, help="[スキャン] 点ノイズ除去[px@300dpi]")
    ap.add_argument("--min-area", type=int, default=d.min_area, help="[スキャン] この面積[px@300dpi]未満の差分は無視")
    ap.add_argument("--align", choices=["auto", "none"], default=d.align, help="位置合わせ")
    ap.add_argument("--cluster", type=int, default=d.cluster, help="この距離[px@300dpi]以内の差分を1つの枠にまとめる")
    ap.add_argument("--common-alpha", type=float, default=d.common_alpha, help="共通部分の濃さ 0〜1")
    ap.add_argument("--no-text", action="store_true", help="文字情報による比較をしない（画素の比較だけ）")
    ap.add_argument("--details", type=int, default=d.details, help="拡大図を作る変更箇所の上限（0で作らない）")
    ap.add_argument("--max-display-pixels", type=int, default=d.max_display_pixels, help="全体図の最大画素数")
    ap.add_argument("--max-analysis-pixels", type=int, default=d.max_analysis_pixels, help="解析の最大画素数")
    a = ap.parse_args(argv)

    for f in (a.old_pdf, a.new_pdf):
        if not f.exists():
            ap.error(f"ファイルが見つかりません: {f}")

    p = Params(dpi=a.dpi, kind=a.kind, blur=a.blur, threshold=a.threshold, tolerance=a.tolerance,
               open_kernel=a.open_kernel, min_area=a.min_area, align=a.align, cluster=a.cluster,
               common_alpha=a.common_alpha, details=a.details, text=not a.no_text, max_display_pixels=a.max_display_pixels,
               max_analysis_pixels=a.max_analysis_pixels)
    process(a.old_pdf, a.new_pdf, a.out, p, parse_pages(a.pages))
    return 0


if __name__ == "__main__":
    sys.exit(main())
