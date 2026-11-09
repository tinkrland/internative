"""the python half, tested without a gpu and without ffmpeg.

run: python3 -m unittest discover -s voice/trainer/tests -t .
"""

from __future__ import annotations

import json
import math
import struct
import sys
import tempfile
import unittest
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from voice.trainer import dataset, prep, train  # noqa: E402


def write_wav(path: Path, seconds: float = 6.0, rate: int = 44100, channels: int = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = int(seconds * rate)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        for i in range(frames):
            value = int(12000 * math.sin(2 * math.pi * 220 * i / rate))
            w.writeframesraw(struct.pack("<h", value) * channels)


class Base(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="trainer-"))
        self.manifest = self.make_manifest()

    def tearDown(self) -> None:
        import shutil

        shutil.rmtree(self.tmp, ignore_errors=True)

    def make_manifest(self, takes=None, digest="digest-1") -> Path:
        takes = takes or [
            {"id": f"take_{i}", "file": f"src/take_{i}.wav", "seconds": 6.0, "sung": True,
             "text": "a line of ordinary words, usually sunny"}
            for i in range(1, 7)
        ]
        for t in takes:
            target = self.tmp / "dataset" / t.get("file", "")
            if t.get("file", "").startswith("src/") and not target.exists():
                # takes are resolved against the manifest, so the dataset is movable
                write_wav(self.tmp / "dataset" / t["file"], t.get("seconds", 6.0))
        path = self.tmp / "dataset" / "manifest.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({
            "voice_id": "voice-1",
            "identity_digest": digest,
            "seconds": sum(t.get("seconds", 0) for t in takes),
            "takes": takes,
        }), encoding="utf-8")
        return path


class BuildTests(Base):
    def test_build_keeps_what_can_be_aligned(self):
        built = dataset.build(self.manifest, self.tmp / "out", val_every=2)
        self.assertTrue(built.ok)
        self.assertEqual(len(built.kept), 6)
        lines = built.transcriptions.read_text().splitlines()
        self.assertEqual(len(lines), 6)
        self.assertTrue(lines[0].startswith("take_1|a line"))
        self.assertEqual(built.val_list.read_text().split(), ["take_1", "take_3", "take_5"])
        self.assertEqual(built.train_list.read_text().split(), ["take_2", "take_4", "take_6"])
        config = built.config.read_text()
        self.assertIn("voice_id: voice-1", config)
        self.assertIn("sample_rate: 44100", config)
        self.assertTrue((built.root / "wavs" / "take_1.wav").is_symlink())

    def test_build_drops_and_says_why(self):
        takes = [
            {"id": "tiny", "file": "src/tiny.wav", "seconds": 1.0, "text": "so short"},
            {"id": "long", "file": "src/long.wav", "seconds": 40.0, "text": "too long"},
            {"id": "mute", "file": "src/mute.wav", "seconds": 6.0, "text": ""},
            {"id": "gone", "file": "absent/gone.wav", "seconds": 6.0, "text": "not on disk"},
        ]
        manifest = self.make_manifest(takes=takes)
        built = dataset.build(manifest, self.tmp / "out")
        reasons = dict(built.dropped)
        self.assertIn("too short", reasons["tiny"])
        self.assertIn("drift", reasons["long"])
        self.assertIn("no phonemes", reasons["mute"])
        self.assertTrue(reasons["gone"].startswith("fatal"))
        self.assertFalse(built.ok)

    def test_a_stereo_take_is_not_a_take(self):
        write_wav(self.tmp / "dataset" / "src" / "wide.wav", channels=2)
        manifest = self.make_manifest(takes=[
            {"id": "wide", "file": "src/wide.wav", "seconds": 6.0, "text": "two channels"},
        ])
        built = dataset.build(manifest, self.tmp / "out")
        self.assertIn("mono", dict(built.dropped)["wide"])

    def test_a_manifest_of_the_wrong_shape_is_not_read(self):
        path = self.tmp / "bad.json"
        path.write_text(json.dumps({"takes": []}))
        with self.assertRaises(ValueError):
            dataset.load_manifest(path)
        path.write_text(json.dumps({"voice_id": "v", "identity_digest": "d", "takes": []}))
        with self.assertRaises(ValueError):
            dataset.load_manifest(path)


class PrepTests(Base):
    def test_prep_cli_builds_and_reports(self):
        code = prep.main(["--manifest", str(self.manifest), "--out", str(self.tmp / "out")])
        self.assertEqual(code, 0)
        self.assertTrue((self.tmp / "out" / "ds.yaml").exists())

    def test_prep_refuses_a_set_where_nothing_survives(self):
        manifest = self.make_manifest(takes=[
            {"id": "tiny", "file": "src/tiny.wav", "seconds": 1.0, "text": "no"},
        ])
        self.assertEqual(prep.main(["--manifest", str(manifest), "--out", str(self.tmp / "out")]), 2)


class TrainTests(Base):
    def setUp(self) -> None:
        super().setUp()
        self.dataset = self.tmp / "out"
        self.assertEqual(prep.main(["--manifest", str(self.manifest), "--out", str(self.dataset)]), 0)
        self.model = self.tmp / "model"

    def test_dry_run_resolves_the_job_and_touches_no_weights(self):
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.dataset),
                           "--out", str(self.model), "--device", "cpu", "--dry-run"])
        self.assertEqual(code, 0)
        plan = json.loads((self.model / "plan.json").read_text())
        self.assertEqual(plan["takes"], 6)
        self.assertEqual(plan["identity_digest"], "digest-1")
        self.assertEqual(len(plan["dataset_digest"]), 32)
        self.assertFalse((self.model / "config.json").exists())

    def test_the_dataset_digest_is_stable(self):
        args = ["--manifest", str(self.manifest), "--dataset", str(self.dataset), "--device", "cpu", "--dry-run"]
        train.main([*args, "--out", str(self.tmp / "a")])
        train.main([*args, "--out", str(self.tmp / "b")])
        a = json.loads((self.tmp / "a" / "plan.json").read_text())["dataset_digest"]
        b = json.loads((self.tmp / "b" / "plan.json").read_text())["dataset_digest"]
        self.assertEqual(a, b)

    def test_a_gpu_job_without_a_gpu_is_refused_and_recorded(self):
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.dataset),
                           "--out", str(self.model), "--device", "gpu"])
        self.assertEqual(code, 2)
        plan = json.loads((self.model / "plan.json").read_text())
        self.assertEqual(plan["refused"], "no gpu")

    def test_no_prep_means_no_run(self):
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.tmp / "empty"),
                           "--out", str(self.model), "--device", "cpu", "--dry-run"])
        self.assertEqual(code, 2)

    def test_one_model_directory_belongs_to_one_voice(self):
        self.model.mkdir(parents=True, exist_ok=True)
        (self.model / "config.json").write_text(json.dumps({"identity_digest": "somebody-else"}))
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.dataset),
                           "--out", str(self.model), "--device", "cpu", "--dry-run"])
        self.assertEqual(code, 2)

    def test_a_real_run_writes_provenance_beside_the_weights(self):
        entry = self.tmp / "fake_vendor.py"
        entry.write_text(
            "import pathlib, sys\n"
            "out = pathlib.Path(sys.argv[sys.argv.index('--out') + 1])\n"
            "out.mkdir(parents=True, exist_ok=True)\n"
            "(out / 'model.onnx').write_bytes(b'not really a model')\n"
            "print('fake vendor trained nothing, honestly')\n"
        )
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.dataset),
                           "--out", str(self.model), "--device", "cpu", "--entry", str(entry)])
        self.assertEqual(code, 0)
        config = json.loads((self.model / "config.json").read_text())
        self.assertEqual(config["weights"], ["model.onnx"])
        self.assertEqual(config["identity_digest"], "digest-1")
        self.assertIn("provenance", config["note"])
        self.assertFalse((self.model / "plan.json").exists())

    def test_a_clean_exit_with_no_weights_is_not_a_training(self):
        entry = self.tmp / "lazy_vendor.py"
        entry.write_text("print('did nothing and said nothing')\n")
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.dataset),
                           "--out", str(self.model), "--device", "cpu", "--entry", str(entry)])
        self.assertEqual(code, 2)

    def test_a_real_run_without_a_vendor_entry_is_refused(self):
        code = train.main(["--manifest", str(self.manifest), "--dataset", str(self.dataset),
                           "--out", str(self.model), "--device", "cpu"])
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
