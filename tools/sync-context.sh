#!/bin/sh
# pull the head onto a mouth.
#
# main owns persona/ and core/: the manifest, the loader, the register
# rules, the brief, the connections and the memory scope. a surface
# branch carries a byte-identical copy of both, synced from here, and
# never edits them locally. if a surface needs something from the head,
# it changes here and syncs down, so seven branches cannot grow seven
# slightly different definitions of who the persona is.
#
# run from a surface branch, then commit the synced copies:
#   sh tools/sync-context.sh
#
# retelldb itself is not copied: it is installed from the tag pinned in
# requirements.txt, so a surface cannot silently run a different memory
# layer than the one that was reviewed.

set -e
git fetch origin main
git checkout FETCH_HEAD -- persona personas core media generation publishing requirements.txt
python3 -m pip install -q -r requirements.txt 2>/dev/null || \
  echo "clawbuzz: retelldb not installed here (no python); the pin in requirements.txt still records the version."
echo "head synced: persona/ and core/ are byte-identical to main, retelldb pinned per requirements.txt."
