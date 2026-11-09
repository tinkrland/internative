# the trainer

two halves, and only one of them needs a graphics card.

## what was measured, on tenki

a 4 vCPU AMD EPYC sandbox with 8GB of memory and 20GB of disk, holding a 24 take
reference set of 12 minutes at 48k stereo, the shape a phone or a mic hands you.

| step | result |
| --- | --- |
| ffmpeg install | 43s |
| generate 24 takes | 3.9s |
| prep to mono 44.1k | 2.9s for 12 minutes of audio, about 250x realtime |
| identical bytes on a second prep | yes, same sha256 |
| ffprobe the set | 24 takes, 30.0s each, 44100 Hz, 1 channel, 61MB |
| gate on the measured facts | 0 problems |
| gpu present | no, nvidia-smi does not exist on the image |

prep is not the cost. twelve minutes of audio is normalised in under three seconds, and
the same input produces the same bytes, so a dataset can be rebuilt from the takes
whenever anyone doubts it.

## the numbers that decide it

a job is refused on this host for one reason and it is the real one: an svs run wants a
gpu and the image has none, so at 4 cores the same job is a ninety six hour night that
would be eight hours on a card. `hoursOn` says both out loud rather than letting a plan
look cheap.

the contract refuses more than hardware:

- a non commercial licence cannot train a voice that gets released
- fewer than ten minutes of audio trains an impression, not a voice
- a job with no reference digest learned from audio nobody can name
- a step containing a shell is a step that cannot be sandboxed
- prep ordered after train is a job that trains on nothing
- artifacts are checked on disk, and a model without its config cannot be loaded

## the code, built while waiting for the card

`voice/trainer/` is now a real package, not a command name. prep reads each take with the
wave module rather than believing the manifest, refuses anything that is not mono at
44.1k, outside 3 to 30 seconds, or wordless, and writes the wav links, transcriptions, a
train/val split and a seed config to be diffed against the vendor template.

train resolves the job, refuses a gpu job without cuda and records the refusal, refuses
to put a second identity in a model directory that already holds one, refuses a clean
exit that left no weights, and on a real run writes provenance (identity digest, dataset
digest, host facts, weight names) into `config.json`, which is what the typescript gate
checks for afterwards. 14 python tests cover it with generated wavs and a fake vendor
that writes a fake weight and admits it trained nothing.

## what is still not built

the vendor's own trainer. `--entry` points at its train module, so the wrapper is done
and what remains is pointing it at a rented card: it is the one piece that cannot be
faked: an svs model needs a gpu for hours, and a rented
card is the honest next step rather than a longer night on a cpu.

the melody readback (`basic-pitch`) also did not install on the probe host: its
dependency chain wants to build against numpy 1.x distutils, and numpy is 2.4.1 on
python 3.12, so the build fails before any code runs. that matters less than it sounds.
the svs input comes from our own score, so reading a melody back out of a reference take
is a convenience for borrowed audio, not a requirement for our own songs.
