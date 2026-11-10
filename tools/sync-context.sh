#!/bin/sh
# pull the head onto a mouth.
#
# main owns persona/, core/, memory/, knowledge/ and access/: the manifest, the loader, the register
# rules, the brief, the connections, the memory scope and the axes of what she knows. a surface
# branch carries a byte-identical copy of both, synced from here, and
# never edits them locally. if a surface needs something from the head,
# it changes here and syncs down, so seven branches cannot grow seven
# slightly different definitions of who the persona is.
#
# run from a surface branch, then commit the synced copies:
#   sh tools/sync-context.sh
#
# the script syncs itself too, so a mouth cannot keep running last month's idea of what the
# head owns (this was learned by fixing knowledge/ on main and watching five branches not
# receive it).
#
# retelldb itself is not copied: it is installed from the tag pinned in
# requirements.txt, so a surface cannot silently run a different memory
# layer than the one that was reviewed.

set -e
git fetch origin main
# the synced folders become exactly main's content, so a file deleted on the head does
# not live forever on a mouth
git rm -rq --ignore-unmatch persona core memory knowledge interests access media generation publishing personas >/dev/null 2>&1 || true
git checkout FETCH_HEAD -- persona core memory knowledge interests access media generation publishing personas requirements.txt tools/sync-context.sh
python3 -m pip install -q -r requirements.txt 2>/dev/null || \
  echo "clawbuzz: retelldb not installed here (no python); the pin in requirements.txt still records the version."
echo "head synced: persona/, core/, memory/, knowledge/ and access/ are byte-identical to main, retelldb pinned per requirements.txt."
