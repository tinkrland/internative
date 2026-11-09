// the voice adapter: the one place the persona's fuzzy tone profile
// (scored 0..1, stored with the persona) meets a tts's named cues.
//
// ported from prixie's context branch, where it proved the point: the
// face (masky voiceStyle) and the voice (tts cues) read the same file,
// so the mapping cannot drift between surfaces. in clawbuzz every
// spoken surface imports this module, and the surfaces sync it from
// main byte for byte, so the voice is one voice across calls, streams,
// clips, videos and podcasts.
//
// VoiceStyle is duck-typed on purpose: masky's speak() takes
// { emotion?, prosody?, style? } and any tts with named cues can read
// the same shape. no provider import lives here.

import type { PersonaManifest, SurfaceName, ToneDefaults } from "./schema.ts";
import { SURFACE_MEDIUM } from "./registers.ts";

export interface VoiceStyle {
  emotion?: string;
  prosody?: string[];
  style?: string;
}

// profile -> delivery cues. the profile is fuzzy on purpose; tts layers
// take named cues. this is the only place the two vocabularies meet.
export function voiceStyleFromTone(tone: ToneDefaults | null | undefined): VoiceStyle {
  const style: VoiceStyle = {};
  if (!tone) return style;

  if (tone.sarcasm_level >= 0.6) style.emotion = "amusement";
  else if (tone.playfulness >= 0.65) style.emotion = "enthusiasm";
  else if (tone.warmth >= 0.7) style.emotion = "affection";
  else if (tone.confidence >= 0.7) style.emotion = "determination";

  const prosody: string[] = [];
  // measured personas speak slower and flatter; lively ones get
  // expressiveness. a confident persona is not slowed down.
  if (tone.confidence < 0.35) prosody.push("speed_slow", "expressive_low");
  if (tone.playfulness >= 0.7) prosody.push("expressive_high");
  if (prosody.length) style.prosody = prosody;

  return style;
}

// the register for a surface can carry a real cue (a late podcast, a
// quiet room): "whispered" is the one register every tts agrees on. the
// tone mapping is shared across surfaces (one person, many rooms); only
// the register text is read per surface.
export function voiceStyleForSurface(
  persona: PersonaManifest,
  surface: SurfaceName,
): VoiceStyle {
  const style = voiceStyleFromTone(persona.voice.tone_defaults);
  const written = persona.voice.register_by_surface[surface]?.register ?? "";
  if (/whisper|hushed|quiet/i.test(written)) style.style = "whispering";
  return style;
}

// the medium name is the surface's key in SURFACE_MEDIUM ("call",
// "stream", "clip", "narration", "podcast", "caption", "post"). spoken
// media get the surface mapping; written media still get the tone (a
// caption has no prosody, and the caller simply ignores it).
export function personaVoiceStyle(persona: PersonaManifest, medium = "call"): VoiceStyle {
  const surface = (Object.entries(SURFACE_MEDIUM).find(([, m]) => m === medium)?.[0] ??
    "meetings") as SurfaceName;
  return voiceStyleForSurface(persona, surface);
}
