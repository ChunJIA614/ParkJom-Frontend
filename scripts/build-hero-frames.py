#!/usr/bin/env python
"""Rebuild the scroll-driven hero frame sets from a master video.

The landing-page hero (`src/components/HeroScrollCanvas.jsx`) scrubs through an
image sequence. Those images are *derived* assets: they must be re-extracted
whenever the master video changes, otherwise the hero keeps showing an
old, over-compressed copy.

Usage (run from the project root):

    python scripts/build-hero-frames.py --input "landing video.mp4" --set hd \
        --width 1920 --extract-width 1920 --dest .tmp/hd

    # the master is 4K, so extract-width keeps the temp PNGs small and the
    # downscale single-pass; drop it to pull full-resolution frames.

Requires: pillow, pillow-avif-plugin, imageio-ffmpeg  (pip install those).
"""

from __future__ import annotations

import argparse
import io
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

try:  # AVIF support is optional; WebP always works.
    import pillow_avif  # noqa: F401
except ImportError:  # pragma: no cover
    pillow_avif = None


def find_ffmpeg() -> str:
    """Prefer imageio-ffmpeg's bundled binary, then fall back to PATH."""
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        found = shutil.which("ffmpeg")
        if not found:
            sys.exit("ffmpeg not found. `pip install imageio-ffmpeg` or add ffmpeg to PATH.")
        return found


def probe_size(ffmpeg: str, src: Path) -> tuple[int, int]:
    """Return (width, height) of the first video stream."""
    # ffmpeg prints stream info to stderr; -i without an output is enough.
    out = subprocess.run(
        [ffmpeg, "-hide_banner", "-i", str(src)],
        capture_output=True,
        text=True,
    ).stderr
    for line in out.splitlines():
        if "Video:" in line:
            # e.g. "3840x2160 [SAR 1:1 DAR 16:9]," — the trailing tags rule out
            # naive comma-splitting, so match the WxH token directly.
            match = re.search(r"\b(\d{2,5})x(\d{2,5})\b", line)
            if match:
                return int(match.group(1)), int(match.group(2))
    sys.exit(f"Could not determine video size for {src}")


def extract(ffmpeg: str, src: Path, dest: Path, fps: float, width: int | None = None) -> list[Path]:
    """Decode the video into lossless PNG frames at a constant fps.

    `width` downsamples during extraction (Lanczos). A 4K master shrunk here costs a
    fraction of the disk/time of pulling full-res PNGs and gives the same result for
    any target narrower than it — pass it whenever the master is larger than the set.
    """
    dest.mkdir(parents=True, exist_ok=True)
    filters = f"fps={fps}"
    if width:
        filters += f",scale={width}:-2:flags=lanczos"
    subprocess.run(
        [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src),
            "-vf", filters,
            str(dest / "src_%04d.png"),
        ],
        check=True,
    )
    frames = sorted(dest.glob("src_*.png"))
    if not frames:
        sys.exit("No frames extracted.")
    return frames


def encode(frame: Path, out: Path, width: int, height: int, args, fmt: str) -> int:
    """Upscale (Lanczos) + unsharp + encode one frame. Returns bytes written."""
    img = Image.open(frame).convert("RGB")
    if img.size != (width, height):
        img = img.resize((width, height), Image.LANCZOS)
    if args.sharpen:
        radius, percent, threshold = args.sharpen
        img = img.filter(ImageFilter.UnsharpMask(radius, percent, threshold))

    buf = io.BytesIO()
    if fmt == "avif":
        img.save(
            buf,
            "AVIF",
            quality=args.quality,
            subsampling=args.subsampling,
            speed=args.speed,
        )
    else:
        img.save(buf, "WEBP", quality=args.webp_quality, method=6)
    out.write_bytes(buf.getvalue())
    return len(buf.getvalue())


def parse_sharpen(value: str):
    if not value or value.lower() == "none":
        return None
    radius, percent, threshold = (float(v) for v in value.split(","))
    return radius, int(percent), int(threshold)


def main() -> None:
    ap = argparse.ArgumentParser(description="Rebuild hero scroll frames.")
    ap.add_argument("--input", required=True, type=Path, help="master video file")
    ap.add_argument("--out", default=Path("public"), type=Path, help="public/ directory")
    ap.add_argument("--set", default="hd", choices=["hd", "sd"], help="which frame set to write")
    ap.add_argument("--width", type=int, default=1920, help="output width (height = 9/16 of it)")
    ap.add_argument("--quality", type=int, default=66, help="AVIF quality 0-100")
    ap.add_argument("--subsampling", default="4:4:4", choices=["4:2:0", "4:2:2", "4:4:4"])
    ap.add_argument("--speed", type=int, default=4, help="AVIF encoder speed 0-10 (higher = faster/worse)")
    ap.add_argument("--sharpen", default="1.4,78,2", help="unsharp radius,percent,threshold or 'none'")
    ap.add_argument("--fps", type=float, default=24.0, help="frame rate to sample the master at")
    ap.add_argument("--extract-width", type=int, default=None,
                    help="downscale to this width while extracting (default: master size)")
    ap.add_argument("--trim-start", type=int, default=0,
                    help="drop the first N sampled frames (e.g. a focus-pull or fade-in "
                         "that would leave the hero's opening frame looking soft)")
    ap.add_argument("--webp-quality", type=int, default=82)
    ap.add_argument("--dest", type=Path, default=None, help="explicit output directory (overrides --out/--set)")
    args = ap.parse_args()

    args.sharpen = parse_sharpen(args.sharpen)
    fmt = "avif" if args.set == "hd" else "webp"
    if fmt == "avif" and pillow_avif is None:
        sys.exit("pillow-avif-plugin is not installed (`pip install pillow-avif-plugin`).")

    ffmpeg = find_ffmpeg()
    src_w, src_h = probe_size(ffmpeg, args.input)
    width = args.width
    height = round(width * src_h / src_w)
    out_dir = args.dest or (args.out / ("frames-hd" if args.set == "hd" else "frames"))

    print(f"master   {args.input} ({src_w}x{src_h})")
    print(f"target   {out_dir}  {width}x{height}  {fmt}")
    if width > src_w:
        print(f"note     upscaling {width / src_w:.2f}x from the master — real detail is capped at {src_w}px")

    with tempfile.TemporaryDirectory() as tmp:
        frames = extract(ffmpeg, args.input, Path(tmp), args.fps, args.extract_width)
        if args.trim_start:
            if args.trim_start >= len(frames):
                sys.exit(f"--trim-start {args.trim_start} would drop every frame ({len(frames)} extracted).")
            print(f"trim     dropping first {args.trim_start} frame(s): "
                  f"{len(frames)} -> {len(frames) - args.trim_start}")
            frames = frames[args.trim_start:]
        out_dir.mkdir(parents=True, exist_ok=True)

        # Never delete existing frames here: write the whole set, then let the
        # caller swap directories. A half-deleted frame set breaks the hero.
        stale = [p for p in out_dir.glob(f"frame_*.{fmt}") if int(p.stem.split("_")[1]) > len(frames)]
        if stale:
            print(f"warn     {len(stale)} stale frame(s) in {out_dir} (higher index than the new set)")

        total = 0
        for i, frame in enumerate(frames, start=1):
            name = f"frame_{i:04d}.{fmt}"
            total += encode(frame, out_dir / name, width, height, args, fmt)
            if i % 20 == 0 or i == len(frames):
                print(f"  {i}/{len(frames)} frames  {total / 1024 / 1024:.1f} MB", flush=True)

    print(f"done     {len(frames)} frames, {total / 1024 / 1024:.1f} MB total")
    print(f"         avg {total / len(frames) / 1024:.1f} KB per frame")
    print("next     update FRAME_SETS in src/components/HeroScrollCanvas.jsx if the count/width changed")


if __name__ == "__main__":
    main()
