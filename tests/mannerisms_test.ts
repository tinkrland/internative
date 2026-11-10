import { assertEquals, assert } from "jsr:@std/assert@1";
import { mannerismBlock, mannerismProblems, setProblems, signature, signatureProblems, type Mannerism, type MannerismSet } from "../mannerisms/module.ts";

const m = (over: Partial<Mannerism> = {}): Mannerism => ({
  id: "tuck-ear",
  name: "tucks her hair behind the right ear",
  kind: "habit",
  site: "hair",
  what: "tucks her hair behind the right ear when a thought starts to form, then leaves her hand there for a beat",
  frequency: "always",
  intensity: 1,
  evidence: "authored",
  ...over,
});

const set = (items: Mannerism[]): MannerismSet => ({ id: "internative-body", items });

Deno.test("a mannerism a camera can catch passes", () => {
  assertEquals(mannerismProblems(m()), []);
});

Deno.test("an interior state is refused, because the body cannot be lit for it", () => {
  const p = m({ what: "radiates quiet confidence across the room, always magnetic" });
  assert(mannerismProblems(p).some((x) => x.includes("is an interior state")));
});

Deno.test("a movement with no trigger is a pose", () => {
  const p = m({ what: "tilts her head slightly to one side and holds it" });
  assert(mannerismProblems(p).some((x) => x.includes("a movement with no trigger is a pose")));
});

Deno.test("a posture is allowed to be still, because stillness is the posture", () => {
  const p = m({ kind: "posture", what: "stands with her weight on one hip, shoulders level" });
  assertEquals(mannerismProblems(p), []);
});

Deno.test("a mannerism has to be placed on a real site", () => {
  const p = m({ site: "soul" });
  assert(mannerismProblems(p).some((x) => x.includes('"soul" is not a site')));
});

Deno.test("a maximal mannerism that runs always is choreography", () => {
  const p = m({ intensity: 3 });
  assert(mannerismProblems(p).some((x) => x.includes("stops being character")));
});

Deno.test("more than three always-on habits reads as a tic", () => {
  const many = set([
    m(),
    m({ id: "taps-thumb", name: "taps her thumb", site: "hands", what: "taps her thumb against her index finger while she listens" }),
    m({ id: "shifts-weight", kind: "posture", site: "waist", what: "shifts her weight to the other hip each time she finishes a thought" }),
    m({ id: "blinks-slow", kind: "gaze", site: "face/eyes", what: "blinks slowly after a question, before answering" }),
  ]);
  assert(setProblems(many).some((x) => x.includes("reads as a tic")));
});

Deno.test("two always habits in the same place make the body choose", () => {
  const clash = set([
    m({ what: "tucks her hair behind her right ear when a thought starts to form" }),
    m({ id: "loops-hair", name: "loops her hair", what: "loops a strand of hair around a finger while she talks" }),
  ]);
  assert(setProblems(clash).some((x) => x.includes("the body has to choose")));
});

Deno.test("a conflict naming a mannerism that is not there is a typo that will never fire", () => {
  const p = m({ conflicts_with: ["not-there"] });
  assert(setProblems(set([p])).some((x) => x.includes('"not-there", which is not in this set')));
});

Deno.test("the block leads with the always-on mannerisms and keeps a podcast one out of a photograph", () => {
  const items = [
    m({ id: "z-pause", name: "leaves a beat", kind: "timing", site: "face/lips", what: "leaves a beat before contradicting somebody", frequency: "often", surfaces: ["audio", "meetings"] }),
    m(),
  ];
  const block = mannerismBlock(set(items), "static");
  assertEquals(block.length, 1);
  assert(block[0].startsWith("always: tucks her hair"));
  assertEquals(mannerismBlock(set(items), "audio").length, 2);
});

Deno.test("a set with no always-on mannerism has no signature, and says so", () => {
  assertEquals(signature(set([m({ frequency: "rare" })])), []);
  assert(signatureProblems(set([m({ frequency: "rare" })]))[0].includes("no mannerism a stranger would recognise"));
});

Deno.test("the signature is the always set, capped at three", () => {
  const s = set([m(), m({ id: "b", frequency: "sometimes", site: "hands", what: "wraps her thumb inside her fist while she waits" })]);
  assertEquals(signature(s).map((x) => x.id), ["tuck-ear"]);
});
