#!/bin/sh
# pull the head onto a mouth.
#
# main owns persona/, core/, memory/ and knowledge/: the manifest, the loader, the register
# rules, the brief, the connections, the memory scope and the axes of what she knows. a surface
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
# the synced folders become exactly main's content, so a file deleted on the head does
# not live forever on a mouth
git rm -rq --ignore-unmatch persona core memory knowledge media generation publishing personas >/dev/null 2>&1 || true
git checkout FETCH_HEAD -- persona core memory knowledge media generation publishing personas requirements.txt
python3 -m pip install -q -r requirements.txt 2>/dev/null || \
  echo "clawbuzz: retelldb not installed here (no python); the pin in requirements.txt still records the version."
echo "head synced: persona/, core/, memory/ and knowledge/ are byte-identical to main, retelldb pinned per requirements.txt."
