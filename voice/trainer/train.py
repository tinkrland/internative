"""train: the gpu half, and the part that must never lie about what it did.

three things make this honest. a dry run resolves the whole job and touches no gpu.
a real run writes provenance next to the weights, so a model can always be traced to
the digest of the voice it learned. and a model directory is bound to one identity:
training a second voice over a first one silently would replace her without a word.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from .dataset import load_manifest

CONFIG = "config.json"
PLAN = "plan.json"


def gpu_facts() -> dict:
    """measured, never assumed. torch is imported here and only here."""
    try:
        import torch  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - depends on the host
        return {"torch": False, "detail": f"{type(exc).__name__}: {exc}"}
    available = bool(getattr(torch, "cuda", None) and torch.cuda.is_available())
    facts = {"torch": True, "cuda": available, "devices": 0, "vram_gb": 0.0}
    if available:
        facts["devices"] = torch.cuda.device_count()
        props = torch.cuda.get_device_properties(0)
        facts["vram_gb"] = round(props.total_memory / (1024 ** 3), 1)
        facts["name"] = props.name
    return facts


def digest_of(paths: list[Path]) -> str:
    h = hashlib.sha256()
    for path in sorted(paths):
        h.update(path.name.encode("utf-8"))
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
    return h.hexdigest()[:32]


def previous_identity(model_dir: Path) -> str | None:
    config = model_dir / CONFIG
    if not config.exists():
        return None
    try:
        return json.loads(config.read_text(encoding="utf-8")).get("identity_digest")
    except Exception:
        return None


def vendor_command(entry: str, dataset: Path, model_dir: Path, device: str) -> list[str]:
    """the vendor keeps its own trainer; we hand it a folder and a device and nothing else."""
    return [sys.executable, entry, "--dataset", str(dataset), "--out", str(model_dir), "--device", device]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="voice.trainer.train")
    ap.add_argument("--manifest", required=True, type=Path)
    ap.add_argument("--dataset", type=Path, default=None)
    ap.add_argument("--out", default="model", type=Path)
    ap.add_argument("--device", choices=["cpu", "gpu"], default="gpu")
    ap.add_argument("--vendor", default="diffsinger")
    ap.add_argument("--entry", default=None, help="the vendor's train module, a python file path")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    manifest = load_manifest(args.manifest)
    dataset = args.dataset or args.manifest.parent
    wavs = dataset / "wavs"
    if not wavs.is_dir() or not any(wavs.glob("*.wav")):
        print(f"refused: {wavs} has no takes, so prep has not run", file=sys.stderr)
        return 2
    transcriptions = dataset / "transcriptions.txt"
    if not transcriptions.exists():
        print("refused: no transcriptions.txt, and a take without words has no phonemes", file=sys.stderr)
        return 2

    model_dir = args.out
    was = previous_identity(model_dir)
    if was and was != manifest["identity_digest"]:
        print(
            f"refused: {model_dir} holds a voice trained from {was}, and this job is {manifest['identity_digest']}. "
            "train into a fresh directory instead of replacing her in place",
            file=sys.stderr,
        )
        return 2

    facts = gpu_facts()
    plan = {
        "voice_id": manifest["voice_id"],
        "identity_digest": manifest["identity_digest"],
        "vendor": args.vendor,
        "device": args.device,
        "host": facts,
        "dataset": str(dataset),
        "takes": len(list(wavs.glob("*.wav"))),
        "dataset_digest": digest_of(sorted(wavs.glob("*.wav")) + [transcriptions]),
        "command": None if not args.entry else vendor_command(args.entry, dataset, model_dir, args.device),
        "resolved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    model_dir.mkdir(parents=True, exist_ok=True)

    if args.device == "gpu" and not facts.get("cuda"):
        detail = facts.get("detail") or "cuda is not available on this host"
        print(f"refused: the job asks for a gpu and {detail}", file=sys.stderr)
        (model_dir / PLAN).write_text(json.dumps({**plan, "refused": "no gpu"}, indent=2) + "\n", encoding="utf-8")
        return 2

    if args.dry_run:
        (model_dir / PLAN).write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
        print(f"dry run: {plan['takes']} takes, digest {plan['dataset_digest']}, device {args.device}")
        print(f"plan written to {model_dir / PLAN}")
        if not args.entry:
            print("no vendor entry given, so this run resolved the job and stopped before the trainer")
        return 0

    if not args.entry:
        print("refused: a real run needs --entry pointing at the vendor's train module", file=sys.stderr)
        return 2

    subprocess.run(vendor_command(args.entry, dataset, model_dir, args.device), check=True)

    weights = sorted(model_dir.glob("*.onnx")) + sorted(model_dir.glob("*.ckpt"))
    if not weights:
        print("refused: the trainer exited clean and left no weights, so it did not train", file=sys.stderr)
        return 2

    config = {
        "voice_id": manifest["voice_id"],
        "identity_digest": manifest["identity_digest"],
        "vendor": args.vendor,
        "device": args.device,
        "host": facts,
        "dataset_digest": plan["dataset_digest"],
        "takes": plan["takes"],
        "weights": [w.name for w in weights],
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": "provenance for the digest this voice already speaks in, not a new identity",
    }
    (model_dir / CONFIG).write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    if (model_dir / PLAN).exists():
        (model_dir / PLAN).unlink()
    print(f"trained {config['voice_id']} on {config['device']}: {', '.join(config['weights'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
