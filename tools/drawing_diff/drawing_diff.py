#!/usr/bin/env python3
"""
drawing_diff.py — 図面PDF（旧版 / 新版）の視覚的差分ハイライトツール

テキスト情報を持たないスキャン図面・ラスタ図面を、ピクセル単位で比較し、
  削除（旧版にのみ存在）  → 赤
  追加（新版にのみ存在）  → 青
  共通（両方に存在）      → 薄いグレー
で合成した画像 / PDF を出力する。変更箇所には番号付きの枠を描き、座標を CSV に書き出す。

処理パイプライン（ページごと）:
  1. PyMuPDF で高解像度（既定 300dpi）・グレースケールにラスタライズ
  2. 二値化（Otsu）で「インク（線・記号）」マスクを抽出
  3. 位置合わせ（ECC による回転+平行移動[+拡縮]の推定、失敗時は ORB 特徴点マッチング）
  4. 許容幅 (tolerance) 付き差分:
       removed = old_ink AND NOT dilate(new_ink, tol)
       added   = new_ink AND NOT dilate(old_ink, tol)
     → 数ピクセルのズレや線幅の違いを吸収
  5. ノイズ除去（モルフォロジー開処理 + 小面積成分の除去）
  6. 変更箇所のクラスタリング → 番号付き枠 + CSV
  7. 合成画像（PNG）と、全ページをまとめた PDF を出力

使い方:
  python drawing_diff.py old_drawing.pdf new_drawing.pdf -o diff_out
  python drawing_diff.py old.pdf new.pdf -o out --dpi 400 --tolerance 4 --min-area 40
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import pymupdf as fitz  # PyMuPDF
import numpy as np

# OpenCV は BGR 順
COLOR_REMOVED = (0, 0, 230)      # 赤
COLOR_ADDED = (230, 90, 0)       # 青
COLOR_COMMON = (200, 200, 200)   # 薄いグレー
COLOR_BOX = (0, 150, 255)        # 橙（変更箇所の枠）

MM_PER_INCH = 25.4


# ----------------------------------------------------------------------------
# パラメータ
# ----------------------------------------------------------------------------
@dataclass
class Params:
    dpi: int = 300
    blur: int = 3               # 二値化前のガウシアンぼかし（奇数, 0で無効）
    threshold: int = 0          # 0=Otsu自動 / 1-254=固定閾値（これより暗い画素をインクとみなす）
    tolerance: int = 3          # 位置ズレ許容幅 [px]（この距離以内に相手側の線があれば「同じ」とみなす）
    open_kernel: int = 2        # 差分マスクの開処理カーネル [px]（0で無効）。細かい点ノイズを除去
    min_area: int = 30          # これ未満の面積 [px] の差分成分は捨てる
    align: str = "ecc"          # ecc / orb / none
    motion: str = "euclidean"   # ecc の変換モデル: translation / euclidean / affine
    align_max_side: int = 3000  # 位置合わせに使う縮小画像の長辺 [px]
    cluster: int = 40           # 近接した差分をまとめる距離 [px]（枠の単位）
    box_pad: int = 15           # 枠の余白 [px]
    emphasize: int = 1          # 差分線を太らせて見やすくする [px]（0で無効）
    common_alpha: float = 1.0   # 共通部分の濃さ (0=非表示, 1=COLOR_COMMON)
    max_pixels: int = 400_000_000  # 1ページあたりの最大画素数（超えたら dpi を自動で下げる）


# ----------------------------------------------------------------------------
# 1. ラスタライズ
# ----------------------------------------------------------------------------
def render_page(doc: fitz.Document, index: int, dpi: int, max_pixels: int) -> tuple[np.ndarray, int]:
    """PDF の 1 ページをグレースケール画像（uint8, 白=255）にする。実際に使った dpi も返す。"""
    page = doc[index]
    w_in, h_in = page.rect.width / 72.0, page.rect.height / 72.0
    eff_dpi = dpi
    if w_in * h_in * dpi * dpi > max_pixels:
        eff_dpi = int((max_pixels / (w_in * h_in)) ** 0.5)
        print(f"    [警告] p{index + 1}: 画素数が多すぎるため dpi を {dpi} → {eff_dpi} に下げます "
              f"(--max-pixels で上限変更可)")
    zoom = eff_dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csGRAY, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.stride)[:, : pix.width]
    return img.copy(), eff_dpi


# ----------------------------------------------------------------------------
# 2. 二値化
# ----------------------------------------------------------------------------
def ink_mask(gray: np.ndarray, p: Params) -> np.ndarray:
    """線・記号（暗い画素）=255、背景=0 のマスク。"""
    g = gray
    if p.blur and p.blur > 1:
        k = p.blur if p.blur % 2 == 1 else p.blur + 1
        g = cv2.GaussianBlur(g, (k, k), 0)
    if p.threshold > 0:
        _, m = cv2.threshold(g, p.threshold, 255, cv2.THRESH_BINARY_INV)
    else:
        _, m = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    return m


# ----------------------------------------------------------------------------
# 3. 位置合わせ
# ----------------------------------------------------------------------------
_MOTIONS = {
    "translation": cv2.MOTION_TRANSLATION,
    "euclidean": cv2.MOTION_EUCLIDEAN,
    "affine": cv2.MOTION_AFFINE,
}


def _scale_affine(warp: np.ndarray, s: float) -> np.ndarray:
    """縮小画像で求めた 2x3 変換を、s 倍の画像用に変換する。"""
    w = warp.copy()
    w[:, 2] *= s
    return w


def _prep_for_align(mask: np.ndarray, scale: float) -> np.ndarray:
    small = cv2.resize(mask, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    # 細い線のままだと相関が取りにくいので、ぼかして「なだらかな山」にする
    small = cv2.GaussianBlur(small, (0, 0), 2.0)
    return small.astype(np.float32) / 255.0


def align_ecc(ref: np.ndarray, mov: np.ndarray, p: Params) -> np.ndarray | None:
    """ECC（画像相関最大化）で mov→ref の 2x3 変換を推定。粗→細の 2 段階。"""
    motion = _MOTIONS[p.motion]
    long_side = max(ref.shape)
    scales = []
    s_fine = min(1.0, p.align_max_side / long_side)
    s_coarse = min(s_fine, 1000 / long_side)
    scales.append(s_coarse)
    if s_fine > s_coarse * 1.5:
        scales.append(s_fine)

    warp = np.eye(2, 3, dtype=np.float32)
    prev_s = None
    for s in scales:
        if prev_s is not None:
            warp = _scale_affine(warp, s / prev_s)
        r = _prep_for_align(ref, s)
        m = _prep_for_align(mov, s)
        # サイズが異なるページ用に mov を ref と同サイズに揃える（パディング/クロップ）
        m = _fit_canvas(m, r.shape)
        criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
        try:
            _, warp = cv2.findTransformECC(r, m, warp, motion, criteria, None, 5)
        except cv2.error:
            return None
        prev_s = s
    return _scale_affine(warp, 1.0 / prev_s)


def align_orb(ref: np.ndarray, mov: np.ndarray, p: Params) -> np.ndarray | None:
    """ORB 特徴点 + RANSAC で相似変換（回転・拡縮・平行移動）を推定。大きなズレに強い。"""
    s = min(1.0, p.align_max_side / max(ref.shape))
    r = cv2.resize(ref, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    m = cv2.resize(mov, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    orb = cv2.ORB_create(nfeatures=8000)
    kr, dr = orb.detectAndCompute(r, None)
    km, dm = orb.detectAndCompute(m, None)
    if dr is None or dm is None or len(kr) < 10 or len(km) < 10:
        return None
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    pairs = matcher.knnMatch(dm, dr, k=2)
    good = [a for a, b in (x for x in pairs if len(x) == 2) if a.distance < 0.75 * b.distance]
    if len(good) < 10:
        return None
    src = np.float32([km[g.queryIdx].pt for g in good])
    dst = np.float32([kr[g.trainIdx].pt for g in good])
    # findTransformECC と同じ向き（ref 座標 → mov 座標）で返すため src/dst を逆にする
    warp, inliers = cv2.estimateAffinePartial2D(dst, src, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if warp is None or inliers is None or inliers.sum() < 10:
        return None
    return _scale_affine(warp.astype(np.float32), 1.0 / s)


def _fit_canvas(img: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    """img を shape (h, w) のキャンバスに左上合わせで配置（はみ出しはクロップ、不足は 0 埋め）。"""
    h, w = shape
    out = np.zeros((h, w), dtype=img.dtype)
    hh, ww = min(h, img.shape[0]), min(w, img.shape[1])
    out[:hh, :ww] = img[:hh, :ww]
    return out


def align(ref_mask: np.ndarray, mov_mask: np.ndarray, p: Params) -> tuple[np.ndarray, str]:
    """mov を ref に重ねるための 2x3 変換（ref 座標→mov 座標）と、使った手法名を返す。"""
    identity = np.eye(2, 3, dtype=np.float32)
    if p.align == "none":
        return identity, "none"
    order = ["ecc", "orb"] if p.align == "ecc" else ["orb", "ecc"]
    for method in order:
        warp = align_ecc(ref_mask, mov_mask, p) if method == "ecc" else align_orb(ref_mask, mov_mask, p)
        if warp is not None and _sane(warp, ref_mask.shape):
            return warp, method
    print("    [警告] 位置合わせに失敗。無補正で比較します（--align none と同等）")
    return identity, "failed"


def _sane(warp: np.ndarray, shape: tuple[int, int]) -> bool:
    """推定結果が非現実的（大回転・大拡縮・ページ外への移動）でないか確認。"""
    a = warp[:, :2]
    sx, sy = np.linalg.norm(a[:, 0]), np.linalg.norm(a[:, 1])
    if not (0.8 < sx < 1.25 and 0.8 < sy < 1.25):
        return False
    if abs(warp[0, 2]) > shape[1] * 0.3 or abs(warp[1, 2]) > shape[0] * 0.3:
        return False
    return True


def warp_to(img: np.ndarray, warp: np.ndarray, shape: tuple[int, int], border: int) -> np.ndarray:
    h, w = shape
    return cv2.warpAffine(
        img, warp, (w, h),
        flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
        borderMode=cv2.BORDER_CONSTANT, borderValue=border,
    )


# ----------------------------------------------------------------------------
# 4-5. 差分 + ノイズ除去
# ----------------------------------------------------------------------------
def _disk(r: int) -> np.ndarray:
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def remove_small(mask: np.ndarray, min_area: int) -> np.ndarray:
    if min_area <= 1:
        return mask
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    keep = np.zeros(n, dtype=np.uint8)
    keep[1:][stats[1:, cv2.CC_STAT_AREA] >= min_area] = 255
    return keep[labels]


def compute_diff(old_m: np.ndarray, new_m: np.ndarray, p: Params) -> tuple[np.ndarray, np.ndarray]:
    if p.tolerance > 0:
        k = _disk(p.tolerance)
        old_d = cv2.dilate(old_m, k)
        new_d = cv2.dilate(new_m, k)
    else:
        old_d, new_d = old_m, new_m
    removed = cv2.bitwise_and(old_m, cv2.bitwise_not(new_d))
    added = cv2.bitwise_and(new_m, cv2.bitwise_not(old_d))
    if p.open_kernel > 0:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (p.open_kernel, p.open_kernel))
        removed = cv2.morphologyEx(removed, cv2.MORPH_OPEN, k)
        added = cv2.morphologyEx(added, cv2.MORPH_OPEN, k)
    removed = remove_small(removed, p.min_area)
    added = remove_small(added, p.min_area)
    return removed, added


# ----------------------------------------------------------------------------
# 6. 変更箇所のクラスタリング
# ----------------------------------------------------------------------------
@dataclass
class Region:
    x: int
    y: int
    w: int
    h: int
    removed_px: int
    added_px: int

    @property
    def kind(self) -> str:
        if self.removed_px and self.added_px:
            return "変更"
        return "削除" if self.removed_px else "追加"


def find_regions(removed: np.ndarray, added: np.ndarray, p: Params) -> list[Region]:
    both = cv2.bitwise_or(removed, added)
    if not both.any():
        return []
    # 縮小してからクラスタリング（巨大画像での膨張処理を高速化）
    s = 4
    small = cv2.resize(both, (both.shape[1] // s + 1, both.shape[0] // s + 1), interpolation=cv2.INTER_AREA)
    small = (small > 0).astype(np.uint8) * 255
    r = max(1, p.cluster // s)
    merged = cv2.dilate(small, _disk(r))
    n, _, stats, _ = cv2.connectedComponentsWithStats(merged, connectivity=8)
    H, W = both.shape
    regions = []
    for i in range(1, n):
        x, y, w, h = (int(v) * s for v in stats[i, :4])
        # 膨張分を戻し、元解像度で実際の差分範囲に締め直す
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(W, x + w), min(H, y + h)
        sub = both[y0:y1, x0:x1]
        ys, xs = np.nonzero(sub)
        if len(xs) == 0:
            continue
        bx0, by0 = x0 + xs.min(), y0 + ys.min()
        bx1, by1 = x0 + xs.max() + 1, y0 + ys.max() + 1
        bx0, by0 = max(0, bx0 - p.box_pad), max(0, by0 - p.box_pad)
        bx1, by1 = min(W, bx1 + p.box_pad), min(H, by1 + p.box_pad)
        rp = int(np.count_nonzero(removed[by0:by1, bx0:bx1]))
        ap = int(np.count_nonzero(added[by0:by1, bx0:bx1]))
        regions.append(Region(int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0), rp, ap))
    # 読み順（上→下, 左→右）に並べる。行の判定は 帯の高さ = 画像高さ/40 単位
    band = max(1, H // 40)
    regions.sort(key=lambda r: (r.y // band, r.x))
    return regions


# ----------------------------------------------------------------------------
# 7. 合成
# ----------------------------------------------------------------------------
def compose(old_m: np.ndarray, new_m: np.ndarray, removed: np.ndarray, added: np.ndarray,
            regions: list[Region], p: Params) -> np.ndarray:
    H, W = old_m.shape
    out = np.full((H, W, 3), 255, dtype=np.uint8)

    if p.common_alpha > 0:
        common = cv2.bitwise_or(old_m, new_m) > 0
        c = np.array(COLOR_COMMON, dtype=np.float32)
        val = (255 - (255 - c) * p.common_alpha).astype(np.uint8)
        out[common] = val

    if p.emphasize > 0:
        k = _disk(p.emphasize)
        removed_v = cv2.dilate(removed, k)
        added_v = cv2.dilate(added, k)
    else:
        removed_v, added_v = removed, added
    out[removed_v > 0] = COLOR_REMOVED
    out[added_v > 0] = COLOR_ADDED

    thick = max(2, round(p.dpi / 100))
    font_scale = max(0.8, p.dpi / 150)
    for i, r in enumerate(regions, 1):
        cv2.rectangle(out, (r.x, r.y), (r.x + r.w, r.y + r.h), COLOR_BOX, thick)
        label = str(i)
        (tw, th), base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thick)
        ty = r.y - 4 if r.y - th - 8 > 0 else r.y + r.h + th + 4
        cv2.rectangle(out, (r.x, ty - th - 4), (r.x + tw + 6, ty + base), COLOR_BOX, -1)
        cv2.putText(out, label, (r.x + 3, ty), cv2.FONT_HERSHEY_SIMPLEX, font_scale,
                    (255, 255, 255), thick, cv2.LINE_AA)

    _draw_legend(out, len(regions), p)
    return out


def _draw_legend(img: np.ndarray, n_regions: int, p: Params) -> None:
    s = max(0.7, p.dpi / 200)
    t = max(1, round(p.dpi / 150))
    items = [("Removed (old only)", COLOR_REMOVED), ("Added (new only)", COLOR_ADDED),
             ("Unchanged", (150, 150, 150)), (f"Changes: {n_regions}", COLOR_BOX)]
    lh = int(36 * s)
    pad = int(12 * s)
    width = int(330 * s)
    height = lh * len(items) + pad * 2
    x0, y0 = pad, pad
    if img.shape[0] < height + 2 * pad or img.shape[1] < width + 2 * pad:
        return
    roi = img[y0:y0 + height, x0:x0 + width]
    roi[:] = (roi.astype(np.uint16) * 0.15 + 255 * 0.85).astype(np.uint8)
    cv2.rectangle(img, (x0, y0), (x0 + width, y0 + height), (90, 90, 90), t)
    for i, (txt, col) in enumerate(items):
        cy = y0 + pad + lh * i + lh // 2
        cv2.rectangle(img, (x0 + pad, cy - lh // 4), (x0 + pad + lh, cy + lh // 4), col, -1)
        cv2.putText(img, txt, (x0 + pad * 2 + lh, cy + lh // 5), cv2.FONT_HERSHEY_SIMPLEX,
                    s * 0.75, (30, 30, 30), t, cv2.LINE_AA)


# ----------------------------------------------------------------------------
# メイン処理
# ----------------------------------------------------------------------------
def process(old_pdf: Path, new_pdf: Path, out_dir: Path, p: Params, pages: list[int] | None,
            save_masks: bool) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    old_doc, new_doc = fitz.open(old_pdf), fitz.open(new_pdf)
    n_old, n_new = len(old_doc), len(new_doc)
    if n_old != n_new:
        print(f"[警告] ページ数が異なります（旧 {n_old} / 新 {n_new}）。共通ページ数分だけ比較します。")
    n = min(n_old, n_new)
    targets = [i for i in (pages or range(1, n + 1)) if 1 <= i <= n]

    out_pdf = fitz.open()
    rows = []
    total = 0
    for pno in targets:
        t0 = time.time()
        i = pno - 1
        print(f"[p{pno}] ラスタライズ中 ({p.dpi} dpi) ...")
        old_g, dpi_o = render_page(old_doc, i, p.dpi, p.max_pixels)
        new_g, dpi_n = render_page(new_doc, i, p.dpi, p.max_pixels)
        if dpi_n != dpi_o:  # ページサイズが違い片方だけ dpi が下がった場合に揃える
            new_g = cv2.resize(new_g, None, fx=dpi_o / dpi_n, fy=dpi_o / dpi_n, interpolation=cv2.INTER_LINEAR)
        pp = Params(**{**p.__dict__, "dpi": dpi_o})

        old_m = ink_mask(old_g, pp)
        new_m = ink_mask(new_g, pp)

        warp, method = align(old_m, new_m, pp)
        ang = np.degrees(np.arctan2(warp[1, 0], warp[0, 0]))
        print(f"    位置合わせ: {method}  dx={warp[0, 2]:+.1f}px dy={warp[1, 2]:+.1f}px rot={ang:+.3f}°")
        new_g = warp_to(new_g, warp, old_g.shape, border=255)
        new_m = ink_mask(new_g, pp)  # 補間後に再二値化（マスクを直接補間するより線が綺麗）

        removed, added = compute_diff(old_m, new_m, pp)
        regions = find_regions(removed, added, pp)
        total += len(regions)
        print(f"    差分: 削除 {np.count_nonzero(removed):,}px / 追加 {np.count_nonzero(added):,}px "
              f"/ 変更箇所 {len(regions)}  ({time.time() - t0:.1f}s)")

        img = compose(old_m, new_m, removed, added, regions, pp)
        png_path = out_dir / f"diff_p{pno:03d}.png"
        cv2.imwrite(str(png_path), img, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        if save_masks:
            cv2.imwrite(str(out_dir / f"removed_p{pno:03d}.png"), 255 - removed)
            cv2.imwrite(str(out_dir / f"added_p{pno:03d}.png"), 255 - added)
            cv2.imwrite(str(out_dir / f"new_aligned_p{pno:03d}.png"), new_g)

        # PDF: 元ページと同じ物理サイズで画像を貼る（拡大しても線が潰れない）
        rect = old_doc[i].rect
        page = out_pdf.new_page(width=rect.width, height=rect.height)
        page.insert_image(page.rect, filename=str(png_path))

        mm = MM_PER_INCH / pp.dpi
        for k, r in enumerate(regions, 1):
            rows.append([pno, k, r.kind, r.x, r.y, r.w, r.h,
                         round(r.x * mm, 1), round(r.y * mm, 1), round(r.w * mm, 1), round(r.h * mm, 1),
                         r.removed_px, r.added_px])

    pdf_path = out_dir / "diff_result.pdf"
    out_pdf.save(str(pdf_path), deflate=True, garbage=3)
    csv_path = out_dir / "changes.csv"
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:  # BOM 付き: Excel で文字化けしない
        w = csv.writer(f)
        w.writerow(["page", "no", "type", "x_px", "y_px", "w_px", "h_px",
                    "x_mm", "y_mm", "w_mm", "h_mm", "removed_px", "added_px"])
        w.writerows(rows)

    print(f"\n完了: 変更箇所 合計 {total} 件")
    print(f"  PDF : {pdf_path}")
    print(f"  PNG : {out_dir}/diff_pNNN.png")
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
    ap.add_argument("--dpi", type=int, default=d.dpi, help="ラスタライズ解像度")
    ap.add_argument("--tolerance", type=int, default=d.tolerance,
                    help="位置ズレ許容幅[px]。誤検出が多い→上げる / 細かい変更を見逃す→下げる")
    ap.add_argument("--threshold", type=int, default=d.threshold,
                    help="二値化閾値。0=Otsu自動、1-254=固定（薄い線を拾うなら上げる）")
    ap.add_argument("--blur", type=int, default=d.blur, help="二値化前のぼかし（奇数, 0で無効）")
    ap.add_argument("--open-kernel", type=int, default=d.open_kernel, help="差分の点ノイズ除去カーネル[px]")
    ap.add_argument("--min-area", type=int, default=d.min_area, help="この面積[px]未満の差分は無視")
    ap.add_argument("--align", choices=["ecc", "orb", "none"], default=d.align, help="位置合わせ手法")
    ap.add_argument("--motion", choices=list(_MOTIONS), default=d.motion,
                    help="ECC の変換モデル（スキャンの拡縮差があれば affine）")
    ap.add_argument("--align-max-side", type=int, default=d.align_max_side,
                    help="位置合わせ用縮小画像の長辺[px]（大きいほど精密・低速）")
    ap.add_argument("--cluster", type=int, default=d.cluster, help="この距離[px]以内の差分を1つの枠にまとめる")
    ap.add_argument("--emphasize", type=int, default=d.emphasize, help="差分線を太らせる量[px]")
    ap.add_argument("--common-alpha", type=float, default=d.common_alpha, help="共通部分の濃さ 0〜1")
    ap.add_argument("--max-pixels", type=int, default=d.max_pixels, help="1ページの最大画素数")
    ap.add_argument("--save-masks", action="store_true", help="削除/追加マスクと位置合わせ後の新版画像も保存")
    a = ap.parse_args(argv)

    for f in (a.old_pdf, a.new_pdf):
        if not f.exists():
            ap.error(f"ファイルが見つかりません: {f}")

    p = Params(dpi=a.dpi, blur=a.blur, threshold=a.threshold, tolerance=a.tolerance,
               open_kernel=a.open_kernel, min_area=a.min_area, align=a.align, motion=a.motion,
               align_max_side=a.align_max_side, cluster=a.cluster, emphasize=a.emphasize,
               common_alpha=a.common_alpha, max_pixels=a.max_pixels)
    process(a.old_pdf, a.new_pdf, a.out, p, parse_pages(a.pages), a.save_masks)
    return 0


if __name__ == "__main__":
    sys.exit(main())
