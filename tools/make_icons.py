#!/usr/bin/env python3
"""
Generates the Unit Lens icons with no third-party dependencies.
Renders a diagonal ruler on an indigo rounded square, 4x supersampled.

Usage: python3 tools/make_icons.py
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
SIZES = (16, 32, 48, 128)
SS = 4  # supersampling factor per axis

BG_A = (0x63, 0x66, 0xF1)  # indigo-500
BG_B = (0x8B, 0x5C, 0xF6)  # violet-500
INK = (0xFF, 0xFF, 0xFF)


def rounded_rect_sd(px, py, cx, cy, hw, hh, r):
    """Signed distance to a rounded rectangle (negative = inside)."""
    dx = abs(px - cx) - (hw - r)
    dy = abs(py - cy) - (hh - r)
    outside = math.hypot(max(dx, 0.0), max(dy, 0.0))
    inside = min(max(dx, dy), 0.0)
    return outside + inside - r


def rotate(px, py, cx, cy, deg):
    a = math.radians(deg)
    x, y = px - cx, py - cy
    return (x * math.cos(a) - y * math.sin(a) + cx, x * math.sin(a) + y * math.cos(a) + cy)


def blend(dst, src, alpha):
    return tuple(round(d + (s - d) * alpha) for d, s in zip(dst, src))


def sample(x, y, n):
    """Colour + alpha for one sub-sample point on an n x n canvas."""
    pad = n * 0.055
    cx = cy = n / 2.0

    # background plate
    bg_sd = rounded_rect_sd(x, y, cx, cy, cx - pad, cy - pad, n * 0.235)
    if bg_sd > 0.5:
        return None

    t = (x + y) / (2.0 * n)
    color = tuple(round(a + (b - a) * t) for a, b in zip(BG_A, BG_B))

    # ruler body, rotated -45 degrees
    rx, ry = rotate(x, y, cx, cy, 45.0)
    body_hw = n * 0.34
    body_hh = n * 0.115
    body_sd = rounded_rect_sd(rx, ry, cx, cy, body_hw, body_hh, n * 0.045)

    if body_sd < 0.0:
        color = INK
        # tick marks hanging from the ruler's top edge
        tick_h = n * 0.052
        long_h = n * 0.075
        for i, off in enumerate((-0.215, -0.072, 0.072, 0.215)):
            h = long_h if i % 2 == 0 else tick_h
            tsd = rounded_rect_sd(
                rx, ry,
                cx + n * off, cy - body_hh + h,
                max(n * 0.018, 0.6), h, n * 0.008,
            )
            if tsd < 0.0:
                color = tuple(round(a + (b - a) * t) for a, b in zip(BG_A, BG_B))
                break
    elif body_sd < 0.9:
        # soft edge between plate and ruler
        color = blend(color, INK, max(0.0, 1.0 - body_sd))

    return color


def render(size):
    n = size * SS
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc_r = acc_g = acc_b = acc_a = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = px * SS + sx + 0.5
                    y = py * SS + sy + 0.5
                    c = sample(x, y, n)
                    if c is not None:
                        acc_r += c[0]
                        acc_g += c[1]
                        acc_b += c[2]
                        acc_a += 1
            total = SS * SS
            if acc_a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                row += bytes(
                    (
                        acc_r // acc_a,
                        acc_g // acc_a,
                        acc_b // acc_a,
                        round(255 * acc_a / total),
                    )
                )
        rows.append(bytes(row))
    return rows


def write_png(path, rows, size):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    for s in SIZES:
        path = os.path.join(OUT, f"icon{s}.png")
        write_png(path, render(s), s)
        print(f"  wrote {path} ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main()
