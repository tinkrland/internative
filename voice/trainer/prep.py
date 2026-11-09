"""prep: the cpu half. normalise, build, and refuse before anyone books a card.

run as: python3 -m voice.trainer.prep --manifest dataset/manifest.json --out dataset
exit 2 means refused, and the reason is on stderr, not in a log nobody reads.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from .dataset import RATE, build, probe


def normalise(source: Path, target: Path) -> None:
    """ffmpeg does the conversion because it is the same tool that will measure the
    master later, and one tool that reads audio is better than two."""
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source), "-ac", "1", "-ar", str(RATE), "-c:a", "pcm_s16le", str(target),
        ],
        check=True,
    )


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="voice.trainer.prep")
    ap.add_argument("--manifest", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--normalise", action="store_true", help="rewrite takes through ffmpeg first")
    ap.add_argument("--val-every", type=int, default=8)
    args = ap.parse_args(argv)

    if args.normalise:
        raw = args.out / "raw"
        for wav in sorted((args.manifest.parent).rglob("*.wav")):
            normalise(wav, raw / wav.name)
        if not any(raw.glob("*.wav")):
            print("refused: --normalise was asked for and found no wavs to normalise", file=sys.stderr)
            return 2

    built = build(args.manifest, args.out, val_every=args.val_every)
    for take_id, reason in built.dropped:
        print(f"dropped {take_id}: {reason}", file=sys.stderr)
    if not built.ok:
        print("refused: the dataset did not survive its own checks", file=sys.stderr)
        return 2
    seconds = sum(probe(built.root / "wavs" / f"{t}.wav")[0] for t in built.kept)
    print(f"built {len(built.kept)} takes, {seconds:.1f}s, at {built.root}")
    print(f"transcriptions {built.transcriptions}")
    print(f"split train {built.train_list} val {built.val_list}")
    print(f"config seed {built.config} (diff against the trainer template)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
