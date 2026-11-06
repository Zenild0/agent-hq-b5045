/**
 * Choosing the announcer's voice. Browsers expose whatever voices the computer has, named very
 * differently on Windows ("Microsoft Zira"), Chrome ("Google UK English Female") and Mac ("Samantha").
 * We rank them so the default is a clear female voice, preferring English (India first).
 */
export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

const FEMALE_NAMES =
  /\b(zira|aria|jenny|samantha|karen|moira|tessa|veena|heera|neerja|hazel|susan|libby|sonia|natasha|catherine|allison|ava|serena|kate|fiona|victoria|amy|emma|joanna|salli|kendra|kimberly|ivy|raveena|swara|shruti|priya|nova|siri|kalpana|lekha|google us english|google हिन्दी|google hindi)(?![a-z])/i;
const MALE_NAMES =
  /\b(david|mark|george|ravi|prabhat|daniel|alex|fred|guy|ryan|brian|eric|matthew|james|richard|rishi|bruce|tom|thomas|oliver|arthur|aaron|gordon|rocko|reed|ralph|junior|albert|hemant|madhur|kabir|sagar|rocko)\b/i;

export function isFemaleVoice(v: VoiceLike): boolean {
  if (/\b(female|woman)\b/i.test(v.name)) return true;
  if (/(^|[^a-z])male([^a-z]|$)/i.test(v.name)) return false;
  if (MALE_NAMES.test(v.name)) return false;
  return FEMALE_NAMES.test(v.name);
}

export function isEnglish(v: VoiceLike): boolean {
  return /^en([-_]|$)/i.test(v.lang);
}

/** Higher is better. */
export function rankVoice(v: VoiceLike): number {
  if (!isEnglish(v)) return -100;
  let score = 0;
  const lang = v.lang.replace('_', '-').toLowerCase();
  score += lang === 'en-in' ? 4 : /^en-(gb|us|au|ca|ie|za)$/.test(lang) ? 3 : 2;
  score += isFemaleVoice(v) ? 6 : /(^|[^a-z])male([^a-z]|$)/i.test(v.name) || MALE_NAMES.test(v.name) ? -10 : 0;
  if (/natural|neural|online|premium|enhanced/i.test(v.name)) score += 2;
  if (/google/i.test(v.name)) score += 0.5;
  if (v.localService) score += 0.25;
  return score;
}

/** The voice to use: the person's own choice if it exists, otherwise the best-ranked female English voice. */
export function pickVoice<T extends VoiceLike>(voices: T[], preferredName?: string): T | undefined {
  if (preferredName) {
    const chosen = voices.find((v) => v.name === preferredName);
    if (chosen) return chosen;
  }
  return [...voices].sort((a, b) => rankVoice(b) - rankVoice(a))[0];
}

/** English voices, best (female) first — for the voice picker. */
export function englishVoices<T extends VoiceLike>(voices: T[]): T[] {
  return voices.filter(isEnglish).sort((a, b) => rankVoice(b) - rankVoice(a));
}

export function isHindi(v: VoiceLike): boolean {
  return /^hi([-_]|$)/i.test(v.lang);
}

/**
 * The voice for an announcer STYLE. `hi` styles need a Hindi voice (returns undefined when the device has none, so the
 * caller can read the Latin-letter version with an English voice instead). `en` styles want a deep male voice if one exists.
 */
export function pickStyleVoice<T extends VoiceLike>(voices: T[], lang: 'en' | 'hi', gender: 'male' | 'female' = 'male'): T | undefined {
  const pool = voices.filter((v) => (lang === 'hi' ? isHindi(v) : isEnglish(v)));
  const score = (v: T) => {
    let n = 0;
    const female = isFemaleVoice(v);
    n += gender === 'male' ? (female ? -6 : 6) : female ? 6 : -6;
    const l = v.lang.replace('_', '-').toLowerCase();
    n += lang === 'hi' ? 0 : l === 'en-in' ? 3 : l === 'en-us' || l === 'en-gb' ? 2.5 : 1;
    if (/natural|neural|online|premium|enhanced/i.test(v.name)) n += 2;
    if (v.localService) n += 0.25;
    return n;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}
