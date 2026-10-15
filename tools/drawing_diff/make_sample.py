#!/usr/bin/env python3
"""
動作確認用のサンプル図面（旧版/新版）を生成する。
ベクター図面を描いた後、「スキャン」を模して画像化し（ズレ・回転・ノイズ付き）、
テキスト情報を持たない画像だけの PDF として保存する。

  python make_sample.py -o samples
  → samples/old_drawing.pdf, samples/new_drawing.pdf
"""
import argparse
from pathlib import Path

import cv2
import pymupdf as fitz
import numpy as np

MM = 72 / 25.4
W_MM, H_MM = 1189, 420  # 長尺図面（A0 長辺 × 420mm）


def draw(page: fitz.Page, new: bool) -> None:
    sh = page.new_shape()
    # 図枠
    sh.draw_rect(fitz.Rect(10, 10, W_MM - 10, H_MM - 10) * MM)
    sh.draw_rect(fitz.Rect(W_MM - 190, H_MM - 60, W_MM - 10, H_MM - 10) * MM)
    # 幹線（配線）
    for k in range(6):
        y = (60 + k * 50) * MM
        sh.draw_line((40 * MM, y), ((W_MM - 220) * MM, y))
    # 分岐・機器記号
    for k in range(20):
        x = (80 + k * 45) * MM
        for j in range(6):
            y = (60 + j * 50) * MM
            if new and (k, j) == (7, 2):
                continue  # 新版で削除される記号
            sh.draw_circle((x, y), 4 * MM)
            sh.draw_line((x, y + 4 * MM), (x, y + 18 * MM))
    if not new:
        sh.draw_rect(fitz.Rect(600, 205, 640, 225) * MM)    # 旧版にだけある機器
    else:
        sh.draw_rect(fitz.Rect(900, 105, 940, 125) * MM)    # 新版で追加された機器
        sh.draw_line((300 * MM, 330 * MM), (520 * MM, 330 * MM))  # 追加された配線
    sh.finish(color=(0, 0, 0), width=0.35 * MM)
    sh.commit()
    # 微細な変更: 0.5mm 程度の短線（線幅も細い）
    sh = page.new_shape()
    if new:
        sh.draw_line((750 * MM, 285 * MM), (752 * MM, 287 * MM))
    sh.finish(color=(0, 0, 0), width=0.18 * MM)
    sh.commit()
    # 文字（画像化されるので OCR なし状態になる）
    page.insert_text(((W_MM - 180) * MM, (H_MM - 35) * MM),
                     "DWG-001 REV." + ("B" if new else "A"), fontsize=10 * MM)
    page.insert_text((100 * MM, 380 * MM), "PUMP P-101" if not new else "PUMP P-102", fontsize=5 * MM)


def scan(page: fitz.Page, dpi: int, dx: float, dy: float, rot: float, seed: int) -> bytes:
    pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.stride)[:, :pix.width].copy()
    h, w = img.shape
    M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, 1.0)
    M[:, 2] += (dx, dy)
    img = cv2.warpAffine(img, M, (w, h), borderValue=255)
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 12, img.shape)
    img = np.clip(img.astype(np.float32) * 0.92 + 18 + noise, 0, 255).astype(np.uint8)  # 紙の地色+ノイズ
    # ゴミ点（スキャンの汚れ）
    for _ in range(300):
        cv2.circle(img, (int(rng.integers(0, w)), int(rng.integers(0, h))), 1, 60, -1)
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def build(path: Path, new: bool, dx: float, dy: float, rot: float, seed: int) -> None:
    src = fitz.open()
    pg = src.new_page(width=W_MM * MM, height=H_MM * MM)
    draw(pg, new)
    out = fitz.open()
    op = out.new_page(width=pg.rect.width, height=pg.rect.height)
    op.insert_image(op.rect, stream=scan(pg, 300, dx, dy, rot, seed))
    out.save(str(path), deflate=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("-o", "--out", type=Path, default=Path("samples"))
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    build(a.out / "old_drawing.pdf", False, 0, 0, 0.0, 1)
    build(a.out / "new_drawing.pdf", True, 14, -9, 0.25, 2)  # 新版は 14px/-9px ズレ + 0.25° 傾き
    print(f"生成: {a.out}/old_drawing.pdf, {a.out}/new_drawing.pdf")
