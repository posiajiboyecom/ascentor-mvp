// ═══════════════════════════════════════════════════════════
// Agent 1: Content Researcher — Nigerian Professional Edition
//
// Key upgrades:
//   - Nigeria-FIRST targeting: Lagos, Abuja, PH, Ibadan context
//   - 3 age-segmented Nigerian personas with hyper-specific pain points
//   - Naija cultural codes baked into research context
//   - Platform-specific voice guides per channel
//   - Ascentor brand confidence woven into every prompt
//   - "Relatable daily experience" mandate in all research
//
// Free tier constraints preserved:
//   - ONE combined Claude call (trends + research together)
//   - Haiku model for speed + rate limits
//   - maxDuration 60s — total compute ~10-15s
// ═══════════════════════════════════════════════════════════

import { schedules, tasks, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Audience Presets ─────────────────────────────────────────
// Built specifically around the lived Nigerian professional experience.
// Every field maps to what actually happens in their daily work life.

export type AudiencePreset =
  | 'young_professional'   // 21-28, entry/mid-level in Lagos/Abuja/PH
  | 'mid_career'           // 29-38, rising manager/senior IC
  | 'executive'            // 39-50, director/C-suite
  | 'general';             // balanced mix

export const AUDIENCE_META: Record<AudiencePreset, {
  label: string;
  ageRange: string;
  researchContext: string;
  // Per-platform voice instructions (used by content-writer)
  voices: {
    linkedin: string;
    twitter: string;
    instagram: string;
    blog: string;
    newsletter: string;
  };
  fallbackPersona: string;
  // Real pain points unique to this segment in Nigeria
  painPoints: string[];
  // Cultural reference points that instantly signal "this is for me"
  culturalMarkers: string[];
}> = {

  young_professional: {
    label: 'Young Nigerian Professional (21–28)',
    ageRange: '21–28',
    researchContext:
      'Focus on Nigerian professionals aged 21–28 in cities like Lagos, Abuja, Port Harcourt, and Ibadan. ' +
      'Their real daily life: earning ₦80k–₦350k/month in their first or second job, still living with family ' +
      'or splitting rent in a shared flat in Surulere, Yaba, Maitama, or GRA. ' +
      'Key pain points: salary not matching their degree, watching mates on LinkedIn announce big roles, ' +
      'not knowing how to negotiate a raise, imposter syndrome in rooms full of "big people", ' +
      'office politics they can\'t decode, LinkedIn that feels performative and hollow, ' +
      'pressure from family to "be doing well" and "settle down", side hustles to survive, ' +
      'JAPA pressure vs staying and building in Nigeria, toxic workplace cultures, ' +
      'managers who gatekeep opportunities, and dreaming of being their own boss someday. ' +
      'They consume content on Instagram Reels, TikTok, Twitter/X and respond to voice notes. ' +
      'Research must surface topics that feel like someone read their diary.',

    voices: {
      linkedin:
        'Write like a brilliant older sibling who made it and is pulling you up. ' +
        'Warm but direct. Start with a one-liner that stops the scroll — ideally a truth they feel but never heard said out loud. ' +
        'Use line breaks generously (LinkedIn algorithm rewards white space). ' +
        'Avoid corporate buzzwords — nobody says "synergy" in real life. ' +
        'Mix English and occasional Nigerian expressions naturally (e.g. "e don do", "sharp sharp", "carry yourself well") — ' +
        'NOT as a gimmick, only when it genuinely fits. ' +
        'End with a question that makes them comment. Never be preachy.',

      twitter:
        'Write like the smartest person in the group chat. ' +
        'Punchy, opinionated, slightly provocative but never reckless. ' +
        'First tweet must be a hot take or a hard truth. ' +
        'Use numbered threads (1/, 2/, 3/) naturally. ' +
        'Reference real Nigerian scenarios: NYSC postings, "connection" culture, Lagos traffic, ' +
        '"my oga said...", owambe weekends, nepa bills, generator costs. ' +
        'End with a CTA that feels like a conversation, not a pitch.',

      instagram:
        'Caption-first thinking. First sentence IS the hook — it must show in the preview before "more". ' +
        'Short punchy sentences. Maximum 3 ideas per caption. ' +
        'Use Naija-native phrasing that feels warm and real. ' +
        'End with a relatable question or a bold statement. ' +
        'Hashtags: 5–8 max, mix career + Nigeria + Ascentor branded tags. ' +
        'Tone: like a trusted friend who also happens to give the best career advice.',

      blog:
        'Write like a mentor who has been in the trenches AND built something real. ' +
        'Open with a scenario they will recognise immediately — not a generic intro. ' +
        'E.g. "You\'ve been in this role for 8 months. Your manager never says your name in meetings..." ' +
        'Use Nigerian settings, companies, and contexts where possible. ' +
        'Subheadings should be punchlines not labels. ' +
        'End with a specific action they can take in the next 24 hours. ' +
        'Ascentor is positioned as the trusted guide that makes the path clear — confident, not boastful.',

      newsletter:
        'Write like a Sunday-morning voice note from someone who genuinely cares about your career. ' +
        'Warm, personal, slightly informal. Use "I" and "you" generously. ' +
        'Reference something real happening in Nigeria that week if possible. ' +
        'One core insight. One action. One Ascentor CTA that feels like a gift, not an ad. ' +
        'Subject line: curiosity + benefit. Preview text should make them open it.',
    },

    fallbackPersona:
      'Ambitious Nigerian professional aged 21–28, navigating their first real job in Lagos or Abuja, ' +
      'earning under ₦300k/month, building their career while managing family expectations and JAPA pressure',

    painPoints: [
      'Salary not matching qualifications or effort',
      'Not getting credit for work in front of senior management',
      'Feeling invisible or overlooked for promotion',
      'Imposter syndrome in rooms with "big names"',
      'Not knowing how to navigate office politics without selling out',
      'LinkedIn anxiety — watching peers announce promotions while you feel stuck',
      'Side hustle vs full focus on main job dilemma',
      'JAPA or stay? Building in Nigeria vs seeking greener pastures abroad',
      'Family pressure to "have something to show" for your education',
      'Toxic managers who don\'t mentor, just micromanage',
    ],

    culturalMarkers: [
      'NYSC, Corp member, PPA, CDS',
      'Yaba, Surulere, Lekki, VI, Ajah, Maitama, Wuse, GRA',
      'Owambe, Friday Jollof, TGIF vibes',
      'Pepper dem gang, soft life, big girl/big boy energy',
      'Generator fuel costs, NEPA/PHCN, remote work struggles',
      'LinkedIn Naija community, tech bros, banker life',
      '"My oga", "ehen", "e don do", "sharp sharp", "no dulling"',
      'Jollof rice wars, Afrobeats playlist at work',
    ],
  },

  mid_career: {
    label: 'Mid-Career Nigerian Professional (29–38)',
    ageRange: '29–38',
    researchContext:
      'Focus on Nigerian professionals aged 29–38 who are in management or senior individual contributor roles. ' +
      'Real daily life: managing a team for the first time and discovering nobody taught them how, ' +
      'earning ₦400k–₦1.5m/month but still feeling financial pressure (school fees, rent, car loans, parents), ' +
      'navigating organisational politics at a new level, being the "young manager" that older staff resist, ' +
      'balancing ambition with burnout, seeking promotions that seem blocked by "settlement" culture, ' +
      'building a personal brand while doubting if it\'s worth it, ' +
      'career pivots into tech or consulting, executive MBA debates, and legacy thinking starting to creep in.',
    voices: {
      linkedin:
        'Peer-to-peer, confident, and practical. Share lessons like a trusted colleague at a rooftop event in Lagos. ' +
        'Use personal storytelling + frameworks. Acknowledge the complexity of leadership in the Nigerian context. ' +
        'No toxic positivity. Acknowledge the hard stuff — then show the path through.',
      twitter:
        'Authoritative but accessible. Mix sharp professional insights with real talk about Nigerian corporate life. ' +
        'Not afraid to name the dysfunction. Offers real solutions, not just commentary.',
      instagram:
        'Aspirational but grounded. They want to see what success looks like without the fakeness. ' +
        'Tone: successful but not arrogant, mentoring from the trenches.',
      blog:
        'Long-form, structured, with real frameworks. They have 10 mins to read. Make every paragraph earn it. ' +
        'Reference real Nigerian business scenarios and leadership challenges.',
      newsletter:
        'Weekly anchor. Feels like the most useful email in their inbox. One insight, one tool, one action.',
    },
    fallbackPersona:
      'Nigerian manager aged 29–38, leading a team for the first time, navigating Lagos corporate culture ' +
      'while building toward a Director or VP role',
    painPoints: [
      'Managing people older than you who don\'t respect your authority',
      'Being passed over for promotion despite strong performance',
      '"Who you know" culture blocking meritocracy',
      'Burnout from overworking without proportional growth',
      'Building a team with no budget, no tools, and high expectations',
      'Personal brand vs company loyalty tension',
      'Imposter syndrome at the next level',
    ],
    culturalMarkers: [
      'Lagos Island vs Mainland commute', 'Corporate Nigeria politics',
      'GRA, Ikoyi, Banana Island goals', 'School fees for the kids',
      '"The economy is not smiling"', 'Aso Rock, NNPC, Dangote, MTN, Access Bank',
    ],
  },

  executive: {
    label: 'Nigerian Executive / Senior Leader (39–50)',
    ageRange: '39–50',
    researchContext:
      'Focus on Nigerian executives, directors, and C-suite professionals aged 39–50. ' +
      'Dealing with board dynamics, building legacy, navigating Nigerian regulatory environments, ' +
      'cross-border business in West Africa, mentoring the next generation, and executive visibility.',
    voices: {
      linkedin:
        'Authoritative, reflective, strategic. Peers at a Lagos Business School event. ' +
        'Data-backed. Acknowledges systemic context in Nigeria. Slightly longer content.',
      twitter: 'Concise thought leadership. Big ideas in small packages. Strategic and bold.',
      instagram: 'Legacy, impact, and gravitas. Aspirational for younger professionals.',
      blog:
        'Sophisticated long-form. Case studies, frameworks, real Nigerian business stories. ' +
        'Ascentor positioned as the platform serious executives trust.',
      newsletter:
        'Executive briefing style. Curated, direct, valuable. Respect their time above all.',
    },
    fallbackPersona:
      'Nigerian executive aged 39–50, focused on organisational leadership, legacy building, ' +
      'and developing the next generation of African leaders',
    painPoints: [
      'Building teams that can execute without constant oversight',
      'Navigating Nigerian regulatory and political environments',
      'Leaving a meaningful legacy beyond financial success',
      'Bridging generational gaps in the workplace',
    ],
    culturalMarkers: [
      'Lagos Business School', 'ICAN, CIBN', 'Eko Atlantic', 'Nigerian Stock Exchange',
      'West Africa expansion', 'Dangote model', 'BRT vs helicopter',
    ],
  },

  general: {
    label: 'Nigerian Professional (All Levels)',
    ageRange: '22–45',
    researchContext:
      'Nigerian professionals across career stages in Lagos, Abuja, Port Harcourt, and diaspora. ' +
      'Universal themes: career growth, leadership, AI tools impact on Nigerian jobs, ' +
      'financial resilience, community, and building something that matters.',
    voices: {
      linkedin: 'Warm, inspiring, practical. Accessible to professionals at any stage. Balance aspiration with real talk.',
      twitter: 'Sharp and relatable. Mix professional insight with cultural commentary.',
      instagram: 'Motivational but grounded. Not generic quotes — real scenarios.',
      blog: 'Accessible depth. Anyone from NYSC to C-suite can get value.',
      newsletter: 'The career mentor in your inbox. One key insight. Real Nigerian context.',
    },
    fallbackPersona: 'Ambitious Nigerian professional, navigating career growth in a challenging economy',
    painPoints: ['Career stagnation', 'Salary not reflecting value', 'Lack of mentorship', 'Economic pressure'],
    culturalMarkers: ['Nigerian economy', 'Lagos hustle', 'Tech in Nigeria', 'African professional pride'],
  },
};

// ── Content Pillars ───────────────────────────────────────────
const PILLAR_ROTATION = [
  "leadership",
  "career",
  "ai",
  "coaching",
  "community",
] as const;

type Pillar = typeof PILLAR_ROTATION[number];

// Nigerian-specific pillar context for research
const PILLAR_CONTEXT: Record<Pillar, string> = {
  leadership:
    'Leadership in Nigerian and West African organisations: managing up, managing teams, ' +
    'executive presence, culture at work, generational clashes in Nigerian offices',
  career:
    'Career growth for Nigerian professionals: salary negotiation in naira, ' +
    'promotions in Nigerian companies, tech job market in Lagos, JAPA vs stay debate, ' +
    'LinkedIn personal branding, career pivots, job hunting in a tough Nigerian economy',
  ai:
    'AI tools and tech trends impacting Nigerian professionals: which AI tools to use now, ' +
    'how AI changes jobs in banking, oil & gas, tech, consulting in Nigeria, ' +
    'building AI skills as a non-technical Nigerian professional',
  coaching:
    'Mentorship and coaching for Nigerian professionals: finding mentors, ' +
    'the culture of "who you know", structured self-development, goal setting, ' +
    'therapy/coaching acceptance growing in Nigerian professional culture',
  community:
    'Professional community building for Nigerians: networking beyond owambe, ' +
    'LinkedIn community, Twitter/X Naija professional space, cohorts, peer accountability, ' +
    'mastermind groups, building in public in Nigeria',
};

// ── Research + Discovery (single call) ───────────────────────
async function researchAndDiscover(
  pillar: Pillar,
  weekNumber: number,
  audience: AudiencePreset
): Promise<{
  trends: string[];
  news: { title: string; snippet: string }[];
  summary: string;
  research: string;
}> {
  const audienceMeta = AUDIENCE_META[audience];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{
      role: "user",
      content:
        `You are a research assistant for Ascentor — Nigeria's leading AI-powered mentorship and ` +
        `career development platform. We help Nigerian professionals grow faster than they ever thought possible.\n\n` +
        `Target audience: ${audienceMeta.label}\n` +
        `Their daily reality: ${audienceMeta.researchContext}\n\n` +
        `Search the web and return ONLY this JSON structure (no markdown):\n` +
        `{\n` +
        `  "trends": ["top trend 1 relevant to Nigerian professionals", "trend 2", "trend 3"],\n` +
        `  "news": [{"title": "headline", "snippet": "one sentence — must be Nigeria or Africa relevant"}],\n` +
        `  "summary": "2 sentences: what is HOT this week in ${PILLAR_CONTEXT[pillar]} specifically for ${audienceMeta.ageRange}-year-old Nigerian professionals",\n` +
        `  "research": "4 sentences of specific insights, real stats, and Nigerian/African examples that will resonate with ${audienceMeta.label}. ` +
        `Include at least one Nigerian-specific context (company, city, salary range in naira, cultural reality)"\n` +
        `}\n\n` +
        `Pillar: ${PILLAR_CONTEXT[pillar]}\n` +
        `Make every insight feel like it was written specifically for someone in Lagos or Abuja reading this on their phone.`,
    }],
  });

  const text = response.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    console.log(`[Researcher] Trends: ${parsed.trends?.length || 0}, news: ${parsed.news?.length || 0}`);
    return {
      trends:   parsed.trends   || [],
      news:     parsed.news     || [],
      summary:  parsed.summary  || "",
      research: parsed.research || text,
    };
  } catch {
    console.warn("[Researcher] Parse failed — using text as research");
    return {
      trends:   [],
      news:     [],
      summary:  text.substring(0, 200),
      research: text.substring(0, 500),
    };
  }
}

// ── Brief Synthesis ───────────────────────────────────────────
async function buildBrief(params: {
  pillar: Pillar;
  weekNumber: number;
  trends: string[];
  news: { title: string; snippet: string }[];
  summary: string;
  research: string;
  audience: AudiencePreset;
}) {
  const audienceMeta = AUDIENCE_META[params.audience];

  const painPointsSnippet = audienceMeta.painPoints.slice(0, 4).join("; ");
  const culturalSnippet = audienceMeta.culturalMarkers.slice(0, 4).join(", ");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [{
      role: "user",
      content:
        `You are the lead content strategist for Ascentor — the AI mentorship platform ` +
        `that is transforming how Nigerian professionals grow their careers.\n\n` +
        `Our brand voice: Confident, warm, direct, deeply rooted in Nigerian professional culture. ` +
        `We speak like someone who has been where our audience is, made it through, and ` +
        `is now genuinely pulling them up. We don't lecture. We connect.\n\n` +
        `Target: ${audienceMeta.label} (${audienceMeta.ageRange} year olds)\n` +
        `Their real pain points this week: ${painPointsSnippet}\n` +
        `Cultural reference points they relate to: ${culturalSnippet}\n` +
        `Pillar: ${params.pillar} | Week: ${params.weekNumber}\n` +
        `Trends: ${params.trends.slice(0, 3).join(", ") || "General " + params.pillar}\n` +
        `Research summary: ${params.summary}\n` +
        `Research details: ${params.research.substring(0, 500)}\n\n` +
        `Return ONLY valid JSON:\n` +
        `{"chosenTopic":"punchy topic max 12 words — must feel like it was written for a Nigerian professional",` +
        `"angle":"our unique, confident Ascentor take — show we understand their reality deeply",` +
        `"pillar":"${params.pillar}",` +
        `"targetAudience":"hyper-specific Nigerian persona for ${audienceMeta.ageRange}-year-olds",` +
        `"keyMessages":["msg1 — must reference a real Nigerian professional experience","msg2","msg3"],` +
        `"hooks":{` +
        `"linkedin":"scroll-stopping first line for Lagos professionals on LinkedIn",` +
        `"twitter":"hot take opener that Naija Twitter will retweet",` +
        `"instagram":"caption hook that stops the scroll before the 'more' button",` +
        `"email":"subject line with high open rate for Nigerian professionals"},` +
        `"nigerianContext":"one specific Nigerian workplace scenario, salary reality, or cultural moment to anchor all content",` +
        `"dataPoints":["stat with source — preferably Nigeria or Africa data"],` +
        `"seoKeywords":["primary","secondary","long-tail with Nigeria"],` +
        `"urgencyReason":"why this topic matters to them THIS WEEK"}`,
    }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : text;

  try {
    return JSON.parse(jsonStr);
  } catch {
    console.warn("[Researcher] Brief parse failed — using fallback");
    const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    return {
      chosenTopic:     `How Nigerian Professionals Are Winning in ${month}`,
      angle:           "Practical strategies rooted in the Nigerian career reality",
      pillar:          params.pillar,
      targetAudience:  audienceMeta.fallbackPersona,
      keyMessages:     [
        "Your environment doesn't define your ceiling — your strategy does",
        "The professionals winning in Nigeria are using systems, not just hustle",
        "Ascentor was built for exactly where you are right now",
      ],
      hooks: {
        linkedin: "Nobody tells you this when you start working in Nigeria...",
        twitter:  "Hot take: the Nigerian career advice on LinkedIn is mostly wrong. Here's what actually works 🧵",
        instagram: "Still grinding with no results? Here's what's actually missing 👇",
        email:    "The career move Nigerian professionals are sleeping on",
      },
      nigerianContext:
        "A 26-year-old analyst in Victoria Island working 70-hour weeks with no promotion in sight",
      dataPoints:      ["Africa has the world's youngest workforce — 60% under 25 (African Development Bank)"],
      seoKeywords:     [`Nigerian ${params.pillar}`, `career growth Nigeria`, `professional development Lagos`],
      urgencyReason:   "The Nigerian job market is shifting fast — those who act now will lead",
    };
  }
}

// ═══════════════════════════════════════════════════════════
// SHARED CORE
// ═══════════════════════════════════════════════════════════
async function runResearch(params: {
  pillar?: Pillar;
  topicOverride?: string;
  audience?: AudiencePreset;
  triggeredBy?: string;
}) {
  const now = new Date();
  const weekNumber = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000)
  );

  const pillar: Pillar = params.pillar ?? PILLAR_ROTATION[weekNumber % PILLAR_ROTATION.length];
  // Default to young_professional — our primary growth audience
  const audience: AudiencePreset = params.audience ?? 'young_professional';

  console.log(`[Researcher] Week ${weekNumber} — pillar: ${pillar} — audience: ${audience}`);

  const { trends, news, summary, research } = await researchAndDiscover(pillar, weekNumber, audience);
  const brief = await buildBrief({ pillar, weekNumber, trends, news, summary, research, audience });

  if (params.topicOverride?.trim()) {
    brief.chosenTopic = params.topicOverride.trim();
  }

  console.log(`[Researcher] Brief: "${brief.chosenTopic}"`);

  let savedBriefId: string | null = null;
  try {
    const { data: savedBrief, error } = await supabase
      .from("research_briefs")
      .insert({
        week_number:  weekNumber,
        pillar,
        topic:        brief.chosenTopic,
        angle:        brief.angle,
        brief_data:   { ...brief, audience },
        trends_raw:   trends,
        news_raw:     news,
        research_raw: research,
        status:       "ready",
        created_at:   now.toISOString(),
      })
      .select("id")
      .single();
    if (error) console.error("[Researcher] Supabase error:", error.message);
    else savedBriefId = savedBrief?.id || null;
  } catch (err: any) {
    console.error("[Researcher] Supabase insert failed (non-fatal):", err.message);
  }

  const triggeredBy = params.triggeredBy ?? `researcher-agent:week-${weekNumber}`;
  const writerHandle = await tasks.trigger("content-writer-agent", {
    topic:           brief.chosenTopic,
    pillar,
    week:            weekNumber,
    audience,
    triggeredBy,
    briefId:         savedBriefId,
    hooks:           brief.hooks,
    keyMessages:     brief.keyMessages,
    dataPoints:      brief.dataPoints,
    nigerianContext: brief.nigerianContext,
    angle:           brief.angle,
    targetAudience:  brief.targetAudience,
  });

  console.log(`[Researcher] Content Writer triggered — run: ${writerHandle.id}`);

  return {
    success:            true,
    week:               weekNumber,
    pillar,
    audience,
    topic:              brief.chosenTopic,
    trendsFound:        trends.length,
    briefId:            savedBriefId,
    contentWriterRunId: writerHandle.id,
  };
}

// ═══════════════════════════════════════════════════════════
// MANUAL TASK — trigger from admin with custom topic/pillar
// ═══════════════════════════════════════════════════════════
export const contentResearcherManual = task({
  id: "content-researcher-manual",
  maxDuration: 60,
  run: async (payload: {
    topic?: string;
    pillar?: Pillar;
    audience?: AudiencePreset;
  }) => {
    console.log("[Researcher] Manual trigger:", payload);
    return runResearch({
      pillar:        payload.pillar,
      topicOverride: payload.topic,
      audience:      payload.audience,
      triggeredBy:   "manual",
    });
  },
});

// ═══════════════════════════════════════════════════════════
// SCHEDULED TASK — every Monday 06:00 WAT
// ═══════════════════════════════════════════════════════════
export const contentResearcherAgent = schedules.task({
  id: "content-researcher-agent",
  cron: "0 5 * * 1", // Monday 05:00 UTC = 06:00 WAT
  maxDuration: 60,
  run: async () => {
    console.log("[Researcher] Starting weekly Nigerian professional content research...");
    return runResearch({ triggeredBy: "schedule" });
  },
});
