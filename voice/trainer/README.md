# the trainer, as code

two commands, one python package, no gpu needed to prove either of them works.

```
python3 -m voice.trainer.prep  --manifest dataset/manifest.json --out dataset
python3 -m voice.trainer.train --manifest dataset/manifest.json --dataset dataset --out model --device gpu
```

`prep` is the cpu half: it reads each take with the wave module rather than the
manifest, refuses anything that is not mono at 44.1k or that sits outside 3 to 30
seconds or that carries no words, links the survivors into `wavs/`, writes
`transcriptions.txt` (`name|text`), a train/val split, and a `ds.yaml` seed config that
is written to be diffed against the vendor's own template rather than trusted over it.

`train` is the gpu half and is deliberately paranoid:

- a dry run resolves takes, dataset digest, host facts and the vendor command, and
  touches nothing
- a gpu job on a host without cuda is refused with the reason written into `plan.json`,
  so the refusal is evidence rather than a missing line in a log
- a model directory belongs to one identity: training a different digest into the same
  folder is refused, because silently replacing her is the failure nobody notices
- a clean exit that left no weights is refused, so a trainer that did nothing cannot be
  mistaken for one that trained
- a real run writes `config.json` with the identity digest, dataset digest, host facts
  and the weight filenames, which is exactly what the typescript `artifactProblems` gate
  asks for afterwards

## tested without a gpu

`python3 -m unittest discover -s voice/trainer/tests -t .` runs 14 tests using generated
wavs, a fake vendor entry that writes a fake weight file, and no torch. the fake vendor
is the honest part: it proves the invocation, the provenance and the artifact checks,
and it never claims a voice was trained.

## what is still true

the vendor's trainer is a command, not a dependency. `--entry` points at its train
module, so DiffSinger or RVC can be swapped without touching this code, and until a
rented card is pointed at it this package has resolved jobs and trained nothing.
