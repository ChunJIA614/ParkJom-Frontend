#!/usr/bin/env python
"""Verify the hero frame sets before you deploy.

The landing hero scrubs an image sequence, so three things can silently break it:

  * the frame count in `HeroScrollCanvas.jsx` drifts from the files on disk
    (a missing tail frame shows as a frozen hero, a stale extra frame is
    fetched and 404s);
  * the master opens with a focus pull or fade, so frame 1 paints blurry
    even though every later frame is sharp;
  * the three sets get rebuilt at different lengths, so phones and desktops
    scrub slightly different sequences.

All three are invisible in a screenshot and cost minutes to spot by eye.
This script checks them in about a second.

Usage (run from the project root):

    python scripts/check-hero-frames.py

    # check a different tree (e.g. a backup set before swapping it in)
    python scripts/check-hero-frames.py --root .tmp_hero/old2

Exit code is 0 when everything passes, 1 when something would break the hero.

Requires: pillow.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter, ImageStat
except ImportError:
    # Bare `python` on PATH is not necessarily the interpreter used for the build.
    sys.exit(
        "pillow is not installed for this interpreter.\n"
        f"  running: {sys.executable}\n"
        "Use the same Python environment that builds the frames "
        "(see the 'Requires' line in scripts/build-hero-frames.py), e.g. the venv's "
        "python.exe directly rather than whatever `python` resolves to."
    )

# First-frame sharpness is judged against the median of the sampled frames.
# Measured on real footage: a focus-pulled opening sits near 0.06-0.37 of the
# median depending on codec and frame size, a healthy set sits around 1.0. The
# gap is wide enough that these cutoffs are not delicate — they exist to catch a
# whole blurry opening, not to grade grain.
BLUR_FAIL_RATIO = 0.45
BLUR_WARN_RATIO = 0.60

# How many frames to sample when measuring sharpness. Cheap and representative.
SAMPLE = 5


def parse_frame_sets(hero_jsx: Path) -> dict[str, dict]:
    """Read FRAME_SETS out of HeroScrollCanvas.jsx — the single source of truth."""
    text = hero_jsx.read_text(encoding="utf-8")
    pattern = re.compile(
        r"(\w+):\s*\{\s*dir:\s*'([^']+)',\s*ext:\s*'([^']+)',\s*count:\s*(\d+),\s*width:\s*(\d+)\s*\}"
    )
    sets = {}
    for key, directory, ext, count, width in pattern.findall(text):
        sets[key] = {"dir": directory, "ext": ext, "count": int(count), "width": int(width)}
    if not sets:
        sys.exit(f"Could not parse FRAME_SETS from {hero_jsx}")
    return sets


def sharpness(path: Path) -> float:
    """Edge variance. Higher is sharper; a defocused frame collapses toward zero."""
    with Image.open(path) as im:
        grey = im.convert("L").filter(ImageFilter.FIND_EDGES)
        return ImageStat.Stat(grey).var[0]


def check_set(key: str, spec: dict, root: Path) -> tuple[list[str], list[str]]:
    """Return (errors, warnings) for one frame set."""
    errors: list[str] = []
    warnings: list[str] = []

    directory = root / spec["dir"].lstrip("/")
    ext = spec["ext"]
    expected = spec["count"]

    if not directory.is_dir():
        return [f"{key}: directory missing — {directory}"], warnings

    files = sorted(directory.glob(f"frame_*.{ext}"))
    if not files:
        return [f"{key}: no frame_*.{ext} files in {directory}"], warnings

    # Count must match the constant the component scrubs against.
    if len(files) != expected:
        errors.append(f"{key}: {len(files)} files on disk but FRAME_SETS says {expected}")

    # Indices must be contiguous from 1 — a gap means a frame 404s mid-scrub.
    indices = []
    for f in files:
        try:
            indices.append(int(f.stem.split("_")[1]))
        except (IndexError, ValueError):
            errors.append(f"{key}: unparseable filename {f.name}")
    if indices:
        missing = sorted(set(range(1, max(indices) + 1)) - set(indices))
        if missing:
            preview = ", ".join(str(i) for i in missing[:5])
            errors.append(f"{key}: {len(missing)} missing index(es), e.g. {preview}")

    # Dimensions must match the declared width, and stay 16:9-ish.
    try:
        with Image.open(files[0]) as im:
            width, height = im.size
        if width != spec["width"]:
            errors.append(f"{key}: first frame is {width}px wide, FRAME_SETS says {spec['width']}px")
        if abs(width / height - 16 / 9) > 0.02:
            errors.append(f"{key}: aspect {width}x{height} is not 16:9")
    except Exception as exc:  # pragma: no cover - corrupt file
        errors.append(f"{key}: cannot open {files[0].name} ({exc})")

    # Opening-frame sharpness: the bug that made the hero look "蒙" on first paint.
    step = max(1, len(files) // SAMPLE)
    sample = [files[0]] + files[step::step][: SAMPLE - 1]
    scores = [sharpness(f) for f in sample]
    median = sorted(scores[1:])[len(scores[1:]) // 2] if len(scores) > 1 else scores[0]
    ratio = scores[0] / median if median else 0.0
    if ratio < BLUR_FAIL_RATIO:
        errors.append(
            f"{key}: frame 1 looks defocused (edge variance {scores[0]:.0f} vs median {median:.0f}, "
            f"ratio {ratio:.2f}) — rebuild with --trim-start"
        )
    elif ratio < BLUR_WARN_RATIO:
        warnings.append(f"{key}: frame 1 is softer than the rest (ratio {ratio:.2f}) — check by eye")

    return errors, warnings


def main() -> None:
    ap = argparse.ArgumentParser(description="Verify the landing hero frame sets.")
    ap.add_argument("--root", default=Path("public"), type=Path,
                    help="directory containing frames/, frames-hd/, frames-sm/ (default: public)")
    ap.add_argument("--hero", default=Path("src/components/HeroScrollCanvas.jsx"), type=Path,
                    help="component that declares FRAME_SETS")
    args = ap.parse_args()

    sets = parse_frame_sets(args.hero)
    print(f"source   {args.hero}")
    print(f"root     {args.root}")
    print()

    all_errors: list[str] = []
    all_warnings: list[str] = []

    for key, spec in sets.items():
        errors, warnings = check_set(key, spec, args.root)
        all_errors += errors
        all_warnings += warnings
        status = "FAIL" if errors else ("WARN" if warnings else "ok")
        print(f"  {key:3s} {spec['dir']:12s} {spec['ext']:4s} count={spec['count']:<4d} {status}")

    # The three sets must scrub the same number of frames or phones and desktops
    # drift apart over the same scroll distance.
    counts = {k: v["count"] for k, v in sets.items()}
    if len(set(counts.values())) > 1:
        all_errors.append(f"FRAME_SETS counts disagree across sets: {counts}")

    print()
    for w in all_warnings:
        print(f"warn     {w}")
    for e in all_errors:
        print(f"error    {e}")

    if all_errors:
        print(f"\nfailed   {len(all_errors)} problem(s) — do not deploy until these are fixed")
        sys.exit(1)

    print(f"passed   {len(sets)} set(s) consistent" + (f", {len(all_warnings)} warning(s)" if all_warnings else ""))


if __name__ == "__main__":
    main()
