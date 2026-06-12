#!/usr/bin/env python3
"""
高解像度PDF差分比較スクリプト

OCRを行わず、極小文字を含む長尺PDFを画質劣化なしで比較する。
- PyMuPDF (fitz) で1ページをグリッド状にタイル分割し、各タイルを超高解像度
  (Matrix倍率 5〜8倍 = 約360〜576dpi、ZOOM_FACTORでさらに上げ可能) でラスタライズ
- タイルごとに処理してメモリへの一括展開を避け、ページ完了後はメモリ/一時ファイルを解放
- OpenCVで絶対差分(absdiff)を取り、面積フィルターで微小ノイズを除去
- 差分領域に赤枠を描画し、元画像(pdf1/pdf2)を横に並べて1ページにまとめ、
  最終的に1つのPDFとして出力する
"""

import argparse
import gc
import math
import os
import shutil
import tempfile

import cv2
import fitz
import numpy as np

# ============================================================
# 調整可能パラメータ
# ============================================================

# 拡大率 (PDFのポイント座標に対する倍率)。72dpi基準なので ZOOM_FACTOR=8 で約576dpi。
# 1200dpi相当が必要な場合は ZOOM_FACTOR = 1200/72 ≒ 16.7 のように指定する。
ZOOM_FACTOR = 8.0

# 1タイルあたりの出力画素数(正方形に近い辺の長さ)。
# 大きいほどタイル数が減るがメモリ消費が増える。OOMが出る場合は小さくする。
TILE_PIXELS = 2048

# 差分とみなすグレースケール輝度差の閾値 (0-255)
DIFF_PIXEL_THRESHOLD = 25

# 差分ピクセルを膨張させて近接領域を1つの輪郭にまとめるためのカーネルサイズ・反復回数
DILATE_KERNEL_SIZE = 5
DILATE_ITERATIONS = 2

# ノイズ除去用の面積フィルター閾値(px^2)。
# 高解像度になるほど数ミリのズレでも画素数が大きくなるため、
# 解像度に応じて大きめの値に調整すること。
MIN_CONTOUR_AREA = 400

# 赤枠の色(BGR)と太さ
BOX_COLOR = (0, 0, 255)
BOX_THICKNESS = 4

# 出力画像のJPEG品質(0-100)。100に近いほど高画質・大容量。
JPEG_QUALITY = 95

# 2つの画像を並べる際の間隔(px)
GAP_PIXELS = 40


def render_page_tiled(page: fitz.Page, zoom: float, tile_px: int, out_path: str):
    """ページをタイル分割して超高解像度ラスタライズし、メモリマップファイルに書き込む。

    戻り値: (memmap配列, (height, width))
    """
    rect = page.rect
    full_w = max(1, int(round(rect.width * zoom)))
    full_h = max(1, int(round(rect.height * zoom)))

    mm = np.memmap(out_path, dtype=np.uint8, mode="w+", shape=(full_h, full_w, 3))

    cols = max(1, math.ceil(full_w / tile_px))
    rows = max(1, math.ceil(full_h / tile_px))

    mat = fitz.Matrix(zoom, zoom)

    for r in range(rows):
        y0 = r * tile_px
        y1 = min(y0 + tile_px, full_h)
        for c in range(cols):
            x0 = c * tile_px
            x1 = min(x0 + tile_px, full_w)

            clip = fitz.Rect(x0 / zoom, y0 / zoom, x1 / zoom, y1 / zoom)
            pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)

            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, pix.n
            )
            # PyMuPDFはRGB、OpenCVはBGRを期待するため変換
            arr_bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)

            th = min(y1 - y0, arr_bgr.shape[0])
            tw = min(x1 - x0, arr_bgr.shape[1])
            mm[y0 : y0 + th, x0 : x0 + tw] = arr_bgr[:th, :tw]

            del pix, arr, arr_bgr
            gc.collect()

    mm.flush()
    return mm, (full_h, full_w)


def compute_diff_boxes(mm1, mm2, shape, threshold, min_area, dilate_size, dilate_iter):
    """2枚の高解像度画像(memmap)から差分の矩形リストを求める。

    グレースケール変換・絶対差分・二値化・膨張・輪郭抽出は
    ページ全体サイズに対して1回だけ行う(1チャンネルなのでメモリ負荷は小さい)。
    """
    h, w = shape

    gray1 = cv2.cvtColor(np.asarray(mm1), cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(np.asarray(mm2), cv2.COLOR_BGR2GRAY)

    diff = cv2.absdiff(gray1, gray2)
    del gray1, gray2
    gc.collect()

    _, diff_bin = cv2.threshold(diff, threshold, 255, cv2.THRESH_BINARY)
    del diff
    gc.collect()

    if dilate_size > 0 and dilate_iter > 0:
        kernel = np.ones((dilate_size, dilate_size), np.uint8)
        diff_bin = cv2.dilate(diff_bin, kernel, iterations=dilate_iter)

    contours, _ = cv2.findContours(diff_bin, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    boxes = []
    for cnt in contours:
        if cv2.contourArea(cnt) >= min_area:
            x, y, bw, bh = cv2.boundingRect(cnt)
            boxes.append((x, y, bw, bh))

    del diff_bin, contours
    gc.collect()
    return boxes


def draw_boxes(mm, boxes, color, thickness):
    for (x, y, bw, bh) in boxes:
        cv2.rectangle(mm, (x, y), (x + bw, y + bh), color, thickness)
    mm.flush()


def build_side_by_side_page(mm1, shape1, mm2, shape2, gap, out_path, jpeg_quality):
    """img1とimg2を横に並べた1枚の画像をJPEGとして保存する(高解像度のまま結合)。"""
    h1, w1 = shape1
    h2, w2 = shape2
    out_h = max(h1, h2)
    out_w = w1 + gap + w2

    combined = np.memmap(out_path + ".raw", dtype=np.uint8, mode="w+", shape=(out_h, out_w, 3))
    combined[:] = 255  # 白背景

    combined[:h1, :w1] = mm1[:]
    combined[:h2, w1 + gap : w1 + gap + w2] = mm2[:]
    combined.flush()

    cv2.imwrite(out_path, combined, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])

    del combined
    gc.collect()
    os.remove(out_path + ".raw")

    return out_h, out_w


def compare_pdfs(
    pdf1_path,
    pdf2_path,
    output_path,
    zoom=ZOOM_FACTOR,
    tile_px=TILE_PIXELS,
    diff_threshold=DIFF_PIXEL_THRESHOLD,
    min_area=MIN_CONTOUR_AREA,
    dilate_size=DILATE_KERNEL_SIZE,
    dilate_iter=DILATE_ITERATIONS,
    gap=GAP_PIXELS,
    jpeg_quality=JPEG_QUALITY,
):
    doc1 = fitz.open(pdf1_path)
    doc2 = fitz.open(pdf2_path)

    n_pages = min(len(doc1), len(doc2))
    if len(doc1) != len(doc2):
        print(
            f"[警告] ページ数が異なります (pdf1={len(doc1)}, pdf2={len(doc2)}). "
            f"先頭から {n_pages} ページのみ比較します。"
        )

    out_doc = fitz.open()
    tmp_dir = tempfile.mkdtemp(prefix="pdf_diff_")

    try:
        for i in range(n_pages):
            print(f"[INFO] ページ {i + 1}/{n_pages} を処理中 (zoom={zoom})...")

            page1 = doc1[i]
            page2 = doc2[i]

            mm1_path = os.path.join(tmp_dir, f"p{i}_1.dat")
            mm2_path = os.path.join(tmp_dir, f"p{i}_2.dat")

            mm1, shape1 = render_page_tiled(page1, zoom, tile_px, mm1_path)
            mm2, shape2 = render_page_tiled(page2, zoom, tile_px, mm2_path)

            if shape1 != shape2:
                print(
                    f"[警告] ページ {i + 1} のサイズが異なります "
                    f"({shape1} vs {shape2})。差分検出はスキップし、並べて出力します。"
                )
                boxes = []
            else:
                boxes = compute_diff_boxes(
                    mm1, mm2, shape1, diff_threshold, min_area, dilate_size, dilate_iter
                )
                print(f"  -> 検出された差分領域: {len(boxes)} 件")
                draw_boxes(mm1, boxes, BOX_COLOR, BOX_THICKNESS)
                draw_boxes(mm2, boxes, BOX_COLOR, BOX_THICKNESS)

            combined_img_path = os.path.join(tmp_dir, f"p{i}_combined.jpg")
            out_h, out_w = build_side_by_side_page(
                mm1, shape1, mm2, shape2, gap, combined_img_path, jpeg_quality
            )

            # 出力PDFへ高解像度画像をそのまま1ページとして挿入(再エンコードなし)
            page_w_pt = out_w / zoom
            page_h_pt = out_h / zoom
            new_page = out_doc.new_page(width=page_w_pt, height=page_h_pt)
            new_page.insert_image(fitz.Rect(0, 0, page_w_pt, page_h_pt), filename=combined_img_path)

            # メモリ・一時ファイルの解放
            del mm1, mm2
            gc.collect()
            for p in (mm1_path, mm2_path, combined_img_path):
                if os.path.exists(p):
                    os.remove(p)

        out_doc.save(output_path)
        print(f"[INFO] 出力完了: {output_path}")

    finally:
        out_doc.close()
        doc1.close()
        doc2.close()
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(
        description="極小文字を含む長尺PDFを超高解像度で比較し、差分を赤枠表示するPDFを出力する"
    )
    parser.add_argument("pdf1", help="比較元PDF")
    parser.add_argument("pdf2", help="比較先PDF")
    parser.add_argument("-o", "--output", default="diff_result.pdf", help="出力PDFパス")
    parser.add_argument(
        "--zoom",
        type=float,
        default=ZOOM_FACTOR,
        help=f"拡大率(72dpi基準の倍率)。デフォルト {ZOOM_FACTOR} (={72*ZOOM_FACTOR:.0f}dpi相当)",
    )
    parser.add_argument(
        "--tile-px",
        type=int,
        default=TILE_PIXELS,
        help=f"タイル1辺の画素数(OOM対策)。デフォルト {TILE_PIXELS}",
    )
    parser.add_argument(
        "--diff-threshold",
        type=int,
        default=DIFF_PIXEL_THRESHOLD,
        help=f"差分とみなす輝度差の閾値(0-255)。デフォルト {DIFF_PIXEL_THRESHOLD}",
    )
    parser.add_argument(
        "--min-area",
        type=float,
        default=MIN_CONTOUR_AREA,
        help=f"差分領域として扱う最小面積(px^2)。微細なズレを無視する閾値。デフォルト {MIN_CONTOUR_AREA}",
    )
    parser.add_argument(
        "--dilate-size",
        type=int,
        default=DILATE_KERNEL_SIZE,
        help=f"差分膨張カーネルサイズ。デフォルト {DILATE_KERNEL_SIZE}",
    )
    parser.add_argument(
        "--dilate-iter",
        type=int,
        default=DILATE_ITERATIONS,
        help=f"差分膨張の反復回数。デフォルト {DILATE_ITERATIONS}",
    )

    args = parser.parse_args()

    compare_pdfs(
        args.pdf1,
        args.pdf2,
        args.output,
        zoom=args.zoom,
        tile_px=args.tile_px,
        diff_threshold=args.diff_threshold,
        min_area=args.min_area,
        dilate_size=args.dilate_size,
        dilate_iter=args.dilate_iter,
    )


if __name__ == "__main__":
    main()
