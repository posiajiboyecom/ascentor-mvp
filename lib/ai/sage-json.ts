// lib/ai/sage-json.ts
// Sage asks the model for JSON: {"reply", "draft"?, "note"?}. Open models sometimes wrap it in prose or code fences.
// Take the first {...} block that has a reply; otherwise the whole text is the reply. Pure, tested in rx-tests.

export type SageJson = { reply?: string; draft?: { cue?: string; action?: string; trigger?: string; fallback?: string }; note?: string };

export function parseSageJson(raw: string): SageJson {
  const clean = raw.replace(/```json|```/g, '').trim();
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  if (a !== -1 && b > a) {
    try {
      const j = JSON.parse(clean.slice(a, b + 1)) as SageJson;
      if (j && typeof j === 'object' && typeof j.reply === 'string') return j;
    } catch { /* fall through */ }
  }
  return { reply: clean };
}
