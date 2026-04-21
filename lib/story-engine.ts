// ═══════════════════════════════════════════════════════════
// Ascentor Video Engine — Claude Story Engine (Phase 5 patched)
// Drop in: lib/video/story-engine.ts
//
// Phase 5 change:
//   • Now returns { story, cost } so the Trigger task can
//     persist the actual Claude spend per job. Previous
//     version only console.log'd the cost.
//   • Public API: new `generateVideoStoryWithCost()` — returns
//     both the story and the cost/usage metadata.
//   • `generateVideoStory()` preserved as a backwards-compatible
//     wrapper so existing callers (/preview route) still work.
// ═══════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk'
import type {
  VideoFormInput,
  StoryEngineResponse,
  AudienceTier,
  NarrativeStyle,
} from '@/types/video'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Sonnet 4.6 pricing (same as 4.5): $3/M input, $15/M output
const CLAUDE_INPUT_COST_PER_M  = 3
const CLAUDE_OUTPUT_COST_PER_M = 15

export interface StoryEngineCost {
  inputTokens:  number
  outputTokens: number
  costUsd:      number
}

export interface StoryEngineResult {
  story: StoryEngineResponse
  cost:  StoryEngineCost
}

// ── Audience voice profiles ──────────────────────────────────
const AUDIENCE_VOICE: Record<AudienceTier, string> = {
  explorer: `
AUDIENCE: Early-career professionals, 22–30. Ambitious but uncertain.
They want more but aren't sure if they're allowed to want it.
They've been told to "pay their dues" and "wait their turn."
They need someone to speak to them like an older sibling who made it and came back honest.

VOICE RULES FOR THIS AUDIENCE:
- Write like you're talking to a smart friend, not addressing a crowd
- Use "you" directly and often — make it personal
- Short punchy sentences. No corporate language at all.
- Reference the feeling of being overlooked, being the youngest in the room, proving people wrong
- The story should make them feel SEEN before it makes them feel inspired
- Never say "in today's competitive landscape" — that is a death sentence`,

  builder: `
AUDIENCE: Mid-career professionals, 30–42. Smart, experienced, quietly frustrated.
They've done everything right — degrees, certifications, promotions.
But the next level feels like a glass ceiling they can't name.
They're tired of generic advice that ignores the African professional context.

VOICE RULES FOR THIS AUDIENCE:
- Speak peer-to-peer. You've both been in the room.
- Acknowledge the specific frustration: doing everything right and still being passed over
- Be direct. They have no patience for fluff or motivational filler.
- Reference real professional dynamics — sponsorship vs mentorship, visibility politics, the cost of being excellent but unknown
- Short-to-medium sentences. No padding. Every line earns its place.
- The tone is: respected colleague sharing what the game actually is`,

  climber: `
AUDIENCE: Senior leaders and executives, 42+. They've made it by conventional metrics.
But they're asking bigger questions now — legacy, real impact, what comes next.
They know the rules of the game. They want to change the game.

VOICE RULES FOR THIS AUDIENCE:
- Speak as an equal. Don't be awed by their titles or experience.
- Challenge them gently but directly — they respect that more than agreement
- Reference the loneliness of senior leadership, the weight of being first, the responsibility of visibility
- Medium sentences with occasional weight. Let a single line land.
- The tone is: one leader to another, no pretense`,

  founders: `
AUDIENCE: Entrepreneurs and founders. They're building something real and they know the cost.
They've chosen uncertainty on purpose. They're not looking for permission.
They need clarity, not motivation.

VOICE RULES FOR THIS AUDIENCE:
- Be direct and useful. Cut everything that doesn't serve the argument.
- Reference the specific loneliness and weight of building — not the glamour
- Use concrete specifics over abstract inspiration
- Short, sharp sentences that land like decisions
- The tone is: founder to founder. No pretense, no performance.`,
}

// ── Narrative style templates ────────────────────────────────
const NARRATIVE_ARC: Record<NarrativeStyle, string> = {
  'authentic-story': `
STORY STRUCTURE — Authentic Story:
Scene 1 (Hook): Open with a specific, real-feeling moment or observation. Not a question. A statement that makes the reader pause.
Scenes 2–3 (Context): Set the scene. What was happening. Who was involved. What was at stake.
Scenes 4–5 (Tension): The moment something didn't work. The realisation. The uncomfortable truth.
Scenes 6–7 (Shift): What changed. The decision. The insight that reframed everything.
Scenes 8–9 (Resolution): What happened after. What became possible.
Final narrative scene (Bridge to CTA): One powerful line that directly connects the story to what you're inviting them to.
CTA scene: Clear, confident, zero desperation.

AUTHENTICITY RULES:
- Write as if this actually happened — specific details, real emotions
- Avoid: "I remember when I...", "Once upon a time..." — start in the middle of the action
- The story doesn't need to be Posi's personal story — it can be a composite truth written in first person
- The reader should feel like they're reading a real person's real experience`,

  'hard-truth': `
STORY STRUCTURE — Hard Truth:
Scene 1 (Provocation): State the uncomfortable truth directly. No warm-up.
Scenes 2–3 (Evidence): Back it up. What most people do. What the data shows. What nobody says out loud.
Scenes 4–5 (The cost): What happens when people ignore this truth. Specific and real.
Scenes 6–7 (Reframe): What becomes possible when you accept it.
Scene 8 (Challenge): Directly challenge the reader to act differently.
Final narrative scene (Bridge): Connect the truth to the invitation.
CTA scene: Position the offer as the natural next step for people who just accepted the truth.`,

  'contrast': `
STORY STRUCTURE — Before vs After (Contrast):
Scene 1 (Hook): Start with the "after" — the result, the transformation, the outcome. Make them want to know how.
Scenes 2–3 (Before): Now paint the before. The struggle, the plateau, the old thinking.
Scenes 4–5 (The turning point): What changed. One specific decision, insight, or encounter.
Scenes 6–7 (After, expanded): What the after actually looks like in practice. Specific and real.
Scene 8 (Generalise): This isn't just one person's story. This is a pattern.
Final narrative scene (Bridge): Connect the pattern to your invitation.
CTA scene: Position the offer as the bridge between their current before and the after.`,

  'insight': `
STORY STRUCTURE — Insider Insight:
Scene 1 (Hook): "Here's something most people in your position don't know yet."
Scenes 2–3 (Context): Why this insight matters. Who has it. Who doesn't.
Scenes 4–5 (The insight, unpacked): Explain it fully. Make it feel like insider knowledge being shared.
Scenes 6–7 (Implications): What this means for them specifically.
Scene 8 (Urgency): Why this matters now, not later.
Final narrative scene (Bridge): Connect the insight to your invitation.
CTA scene: Position the offer as access to more of this kind of thinking.`,

  'challenge': `
STORY STRUCTURE — Direct Challenge:
Scene 1 (Challenge): Issue the challenge directly. "You've been playing it safe. That ends today."
Scenes 2–3 (The comfortable lie): Name what they've been telling themselves. Be specific.
Scenes 4–5 (The real cost): What staying comfortable is actually costing them. Career, income, influence, time.
Scenes 6–7 (The alternative): Paint what's possible for someone who takes the challenge seriously.
Scene 8 (The gauntlet): Give them a specific, concrete action to take right now.
Final narrative scene (Bridge): That action is this.
CTA scene: Direct, confident, no hand-holding.`,

  'journey': `
STORY STRUCTURE — Personal Journey:
Scene 1 (Hook): Start at a specific moment in the journey — not the beginning, not the end. The middle of something real.
Scenes 2–3 (Who I was): Set up the starting point. The context. The beliefs I held.
Scenes 4–5 (What broke): The moment the old approach stopped working. The crisis, the failure, the realisation.
Scenes 6–7 (What I learned): The insight that changed the trajectory. Specific and earned.
Scene 8 (Who I became): Not triumphant — honest. What changed and what it cost.
Final narrative scene (Bridge): What I wish I'd had. What I'm building so others don't have to figure this out alone.
CTA scene: Invitation, not pitch.`,
}

// ── System prompt ────────────────────────────────────────────
function buildSystemPrompt(): string {
  return `You are the narrative intelligence behind Ascentor — Africa's premier career mentorship platform.

Your job is to write kinetic text video scripts that feel like a real human wrote them at 2am because they had something important to say.

WHAT YOU ARE NOT:
- You are not a content marketer
- You are not a copywriter writing ad copy
- You are not generating "motivational content"
- You are not writing LinkedIn thought leadership fluff

WHAT YOU ARE:
- A storyteller who understands the specific psychology of ambitious African professionals
- Someone who respects the reader's intelligence and doesn't waste their time
- A person who knows the difference between inspiration and manipulation — and only uses the former
- A writer who knows that the most powerful sentence is often the shortest one

THE FORMAT YOU'RE WRITING FOR:
This is a kinetic text video — lines of text appear, linger, and fade on screen.
Each scene is a beat. A breath. A moment.
The viewer reads and feels simultaneously.
There is no room for filler. Every line must earn its place.

WRITING RULES — NON-NEGOTIABLE:
1. Never start with a question. Start with a statement that creates tension.
2. No corporate language. Ever. Not even close.
3. Vary sentence length deliberately — short sentences land harder after longer ones.
4. The emotional arc must be: tension → recognition → shift → possibility → invitation.
5. The CTA must feel earned, not bolted on. The story must lead naturally to it.
6. Write as if you know the reader personally. Because the platform does.
7. No filler transitions like "And that's when I realized..." or "The truth is..."
8. African context is not a footnote — it's the lens. Write from inside it.
9. Each scene should feel like a beat, not a paragraph.
10. The last narrative scene before the CTA must be the most powerful line in the video.`
}

function buildUserPrompt(input: VideoFormInput): string {
  const audienceVoice = AUDIENCE_VOICE[input.audienceTier]
  const narrativeArc  = NARRATIVE_ARC[input.narrativeStyle]

  return `Write a complete kinetic text video script for Ascentor.

GOAL OF THIS VIDEO: ${input.goal}

KEY MESSAGE (what the viewer must feel and do):
${input.keyMessage}

${audienceVoice}

${narrativeArc}

CRITICAL INSTRUCTIONS:
- Write exactly 6–8 scenes. Hard maximum: 8 scenes. No more.
- Every scene must earn its place — if it can be cut without losing the arc, cut it.
- Each scene has 1–4 lines. No scene should feel crowded.
- durationSeconds: assign based on emotional weight. Hard maximum: 5 seconds per scene. Most scenes: 4–5s. A single punchy line: 3–4s.
- For emphasis: "bold" = strong statement, "accent" = the emotional peak of a scene (use sparingly — max 1 per scene), "whisper" = quiet/reflective, "normal" = everything else
- For animation: "fade-up" for most scenes, "word-by-word" for high-impact single lines, "fade-in" for quiet moments, "slide-left" for contrast/shift scenes

Respond ONLY with valid JSON, no markdown, no preamble, no explanation:
{
  "scenes": [
    {
      "id": "scene_01",
      "lines": [
        { "text": "line text here", "emphasis": "normal|bold|accent|whisper", "delayMs": 0 },
        { "text": "second line", "emphasis": "normal", "delayMs": 600 }
      ],
      "durationSeconds": 4,
      "animation": "fade-up|fade-in|word-by-word|slide-left"
    }
  ],
  "ctaHeadline": "Short powerful CTA headline — max 8 words",
  "ctaSubtitle": "One sentence that closes the story and opens the door",
  "closingLine": "The final line of the last narrative scene — used in minimal-link template",
  "voiceoverScript": "The complete video as a single flowing voiceover script. Natural speech. No scene markers. This is what ElevenLabs will read.",
  "totalDurationSeconds": <sum of all scene durations + 8 for CTA>
}`
}

// ═══════════════════════════════════════════════════════════
// PUBLIC — returns both the story AND the cost metadata
// ═══════════════════════════════════════════════════════════
export async function generateVideoStoryWithCost(
  input: VideoFormInput
): Promise<StoryEngineResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(input) }],
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('')

  const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  let parsed: StoryEngineResponse
  try {
    parsed = JSON.parse(clean)
  } catch {
    console.error('[story-engine] Failed to parse Claude response:', clean.slice(0, 500))
    throw new Error('Story engine returned invalid JSON')
  }

  if (!parsed.scenes || parsed.scenes.length === 0) {
    throw new Error('Story engine returned no scenes')
  }

  const inputTokens  = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const costUsd =
    (inputTokens  / 1_000_000) * CLAUDE_INPUT_COST_PER_M +
    (outputTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_M

  console.log(
    `[story-engine] ${parsed.scenes.length} scenes. ` +
    `Tokens: ${inputTokens}in/${outputTokens}out. Cost: $${costUsd.toFixed(5)}`
  )

  return {
    story: parsed,
    cost: { inputTokens, outputTokens, costUsd },
  }
}

// ═══════════════════════════════════════════════════════════
// PUBLIC — backwards-compatible wrapper (old signature)
// Existing callers (/preview route, old trigger task) still work
// ═══════════════════════════════════════════════════════════
export async function generateVideoStory(
  input: VideoFormInput
): Promise<StoryEngineResponse> {
  const result = await generateVideoStoryWithCost(input)
  return result.story
}
