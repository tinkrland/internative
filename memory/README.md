# memory

the head's side of remembering: one client, one scope rule, used by every surface.

`client.ts` is the transport. it talks to the persona's memory server (retelldb, pinned
in `requirements.txt`, never vendored) and carries the scope on every call, so the head
always knows which mouth is asking and who is standing in front of it.

`scope.ts` is the rule. a platform plus a handle resolves to one of four states, and the
difference matters:

- **anchored**: the handle is one of the persona's known connections, so the memory is
  about a specific person
- **owner**: the handle is hers, so the memory is about herself
- **stranger**: a real conversation with nobody identified, so facts are kept but not
  attributed
- **no_config / ambiguous**: nothing is known, and it says so rather than guessing

two things this layer will not do. it will not fabricate: an unset `CLAWBUZZ_RETELLDB_URL`
is a warn and a no-op, and a failed query returns null so the caller can admit not knowing.
and it will not fill a silent gap: when the head drops a node, the drop comes back with
its reason attached.

the scope carried here is what makes a stranger on a new platform safe to talk to. the
same name on two platforms is two different people until a handle says otherwise.
