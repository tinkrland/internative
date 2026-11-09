"""the dataset: a manifest in, a trainer-ready folder out.

the manifest is the reviewed thing (voice/manifest.ts builds it after the reference
gate has passed). this module never decides whether a voice is allowed to exist, it
decides whether the audio can be aligned, and says which takes it dropped and why.
"""

from __future__ import annotations

import json
import wave
from dataclasses import dataclass, field
from pathlib import Path

RATE = 44100
CHANNELS = 1
MIN_SECONDS = 3.0
MAX_SECONDS = 30.0


@dataclass
class Take:
    id: str
    file: str
    seconds: float
    sung: bool = False
    text: str = ""


@dataclass
class Built:
    root: Path
    kept: list[str] = field(default_factory=list)
    dropped: list[tuple[str, str]] = field(default_factory=list)
    transcriptions: Path | None = None
    train_list: Path | None = None
    val_list: Path | None = None
    config: Path | None = None

    @property
    def ok(self) -> bool:
        return bool(self.kept) and not any(r.startswith("fatal") for _, r in self.dropped)


def probe(path: Path) -> tuple[float, int, int]:
    """seconds, rate, channels read from the file itself, not from the manifest."""
    with wave.open(str(path), "rb") as w:
        rate, channels, frames = w.getframerate(), w.getnchannels(), w.getnframes()
    return round(frames / float(rate), 3), rate, channels


def load_manifest(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for key in ("voice_id", "identity_digest", "takes"):
        if key not in data:
            raise ValueError(f"manifest is missing {key}, so it is not one of ours")
    if not data["takes"]:
        raise ValueError("manifest has no takes, so there is nothing to build")
    return data


def check(take: Take, wav: Path) -> str | None:
    """None when usable, otherwise the reason it is not."""
    if not wav.exists():
        return "fatal: the audio file is not on disk"
    seconds, rate, channels = probe(wav)
    if channels != CHANNELS:
        return f"{channels} channels, and a take is mono"
    if rate != RATE:
        return f"{rate} Hz, and the dataset is {RATE} Hz"
    if seconds < MIN_SECONDS:
        return f"{seconds}s is too short to align"
    if seconds > MAX_SECONDS:
        return f"{seconds}s is long enough for an aligner to drift"
    if not take.text.strip():
        return "no text, and an svs take without words has no phonemes"
    return None


def build(manifest_path: Path, root: Path, val_every: int = 8) -> Built:
    """copy nothing: the takes are symlinked into wavs/ so the dataset is cheap and the
    originals stay the only copy of the audio."""
    manifest = load_manifest(manifest_path)
    if root.exists():
        for stale in (root / "transcriptions.txt", root / "train.txt", root / "val.txt"):
            if stale.exists():
                stale.unlink()
    (root / "wavs").mkdir(parents=True, exist_ok=True)
    built = Built(root=root)
    lines: list[str] = []
    for raw in manifest["takes"]:
        take = Take(
            id=raw["id"],
            file=raw.get("file", ""),
            seconds=float(raw.get("seconds", 0)),
            sung=bool(raw.get("sung", False)),
            text=str(raw.get("text", "")),
        )
        source = manifest_path.parent / take.file
        reason = check(take, source)
        if reason:
            built.dropped.append((take.id, reason))
            continue
        link = root / "wavs" / f"{take.id}.wav"
        if link.exists() or link.is_symlink():
            link.unlink()
        link.symlink_to(source.resolve())
        built.kept.append(take.id)
        lines.append(f"{take.id}|{take.text.strip()}")
    if not built.kept:
        built.dropped.append(("fatal", "no take survived, so there is no dataset"))
        return built
    built.transcriptions = root / "transcriptions.txt"
    built.transcriptions.write_text("\n".join(lines) + "\n", encoding="utf-8")
    held = built.kept[::val_every]
    trained = [t for t in built.kept if t not in held]
    built.train_list = root / "train.txt"
    built.val_list = root / "val.txt"
    built.train_list.write_text("\n".join(trained) + "\n", encoding="utf-8")
    built.val_list.write_text("\n".join(held) + "\n", encoding="utf-8")
    built.config = root / "ds.yaml"
    built.config.write_text(dataset_config(manifest), encoding="utf-8")
    return built


def dataset_config(manifest: dict) -> str:
    """a seed config, not an authority.

    the vendor ships its own template and it moves between releases, so this file is
    written to be diffed against that template rather than trusted over it. what it
    carries is the part only we know: which voice this is and which digest of it.
    """
    return "\n".join(
        [
            f"# voice_id: {manifest['voice_id']}",
            f"# identity_digest: {manifest['identity_digest']}",
            "# diff this against the trainer's own template before a run",
            "raw_data_dir: wavs",
            "speaker: internative",
            "spk_id: 0",
            "sample_rate: 44100",
            "hop_size: 512",
            "win_size: 2048",
            "fft_size: 2048",
            "num_mel_bins: 128",
            "mel_fmin: 40",
            "mel_fmax: 16000",
            "max_frames: 30000",
            "phonemizer: espeak",
            "use_lang_id: false",
            "augmentation: false",
            "seed: 20261109",
            "",
        ]
    )
