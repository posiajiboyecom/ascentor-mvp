// POST /api/admin/personal-brand
// Generates LinkedIn and/or Twitter posts for Posi's personal brand
// Cybersecurity authority + job-seeking signal
// Uses Claude directly — no Trigger.dev needed, instant generation

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PILLAR_CONTEXT: Record<string, string> = {
  authority:  'Share deep cybersecurity expertise. Educate. Be specific about tools, frameworks, attack patterns, or defence strategies. The goal is to make readers think "this person really knows their stuff." Avoid generic advice. Get granular.',
  career:     'Post with visible job-seeking intent — but from a position of strength. Not "I am looking for work" but signals that attract hiring managers: sharing what you are working on, your approach to problems, your values as a practitioner. Make recruiters want to reach out.',
  insight:    'A strong take on something happening in cybersecurity right now. Could be a trend, a breach analysis, a policy development, or a tool observation. Have a real opinion. Do not sit on the fence.',
  story:      'A specific experience from your cybersecurity work — what happened, what you learned, what you would do differently. The more concrete the detail, the more credible and engaging. Vulnerability without oversharing.',
  tool:       'Share a specific tool, technique, resource, or framework that actually works. Not a list — a single thing, explained with enough depth that the reader can immediately use or understand it.',
  myth:       'Correct a common misconception in cybersecurity. Something that most people believe but is wrong, incomplete, or more nuanced than it appears. Direct, evidence-based, respectful but clear.',
};

const INTENT_CONTEXT: Record<string, string> = {
  authority:  'Build thought leadership. Make cybersecurity professionals and hiring managers follow you. Every post should make readers think you are someone worth paying attention to in this space.',
  apply:      'You are currently applying for cybersecurity roles. This post should demonstrate depth that makes a hiring manager check your profile before even reading your CV.',
  inbound:    'The goal is to make hiring managers reach out to you. The post should demonstrate rare expertise or perspective that makes them think "we need someone who thinks like this."',
  network:    'Build relationships with peers and senior practitioners. Engage, educate, be generous with knowledge. Position as a collaborator, not just a job seeker.',
};

const POSI_VOICE = `
You are writing social media content for Posi Ajiboye Samuel — a cybersecurity professional with a background as a Security Analyst, CompTIA Security+ certified, Google Cybersecurity Professional certified, ISACA member.

POSI'S VOICE:
- Direct and specific — no vague generalisations
- Practitioner tone — writes from experience, not from reading about it
- Confident but not arrogant — shares knowledge generously
- Global perspective — not region-specific
- Concise — respects the reader's time
- No corporate speak, no buzzword soup
- First person, active voice
- When he gives advice it is specific enough to act on immediately

BACKGROUND CONTEXT:
- Currently seeking a well-paying cybersecurity role (Security Analyst, Pentest, GRC, or adjacent)
- Wants to establish himself as a recognised practitioner worth recruiting
- Experience in penetration testing lab setup, vulnerability assessment, GRC
- Credentials: CompTIA Security+, Google Cybersecurity Professional, ISACA member
- Also founder of Ascentor — so understands both technical and leadership dimensions
`;

function buildLinkedInPrompt(pillar: string, intent: string, topic: string): string {
  return `${POSI_VOICE}

TASK: Write ONE high-quality LinkedIn post.

CONTENT PILLAR: ${PILLAR_CONTEXT[pillar] || pillar}

INTENT: ${INTENT_CONTEXT[intent] || intent}

${topic ? `SPECIFIC TOPIC/ANGLE: ${topic}` : 'Choose a topic that fits the pillar and would genuinely resonate with cybersecurity professionals and hiring managers.'}

LINKEDIN FORMAT RULES:
- Hook in the first line — must stop the scroll (no "I am excited to share")
- No bullet points in the first 3 lines — start with prose
- Short paragraphs — 1-3 sentences max each
- White space between paragraphs — LinkedIn rewards this
- 150-300 words ideal for engagement
- End with one clear takeaway or question that invites comments
- 3-5 relevant hashtags at the very end (on a separate line)
- Do NOT use these openers: "Excited to share", "Hot take:", "Unpopular opinion:", "Let's talk about"

Return ONLY the post content — no preamble, no "Here is the post:", just the post itself, then a new line, then the hashtags.`;
}

function buildTwitterPrompt(pillar: string, intent: string, topic: string): string {
  return `${POSI_VOICE}

TASK: Write ONE Twitter/X thread (4-6 tweets).

CONTENT PILLAR: ${PILLAR_CONTEXT[pillar] || pillar}

INTENT: ${INTENT_CONTEXT[intent] || intent}

${topic ? `SPECIFIC TOPIC/ANGLE: ${topic}` : 'Choose a topic that fits the pillar and would genuinely resonate with cybersecurity professionals.'}

TWITTER FORMAT RULES:
- Tweet 1 is the hook — must make someone stop scrolling AND want to read the rest
- Each tweet stands alone but flows into the next
- Tweet 1: max 240 chars (hook)
- Tweets 2-5: the substance — specific, concrete, actionable
- Final tweet: the takeaway + optional CTA
- Number each tweet: "1/" "2/" etc.
- No hashtags in the thread except optionally on the last tweet (max 2)
- Conversational but knowledgeable tone
- Total thread: 4-6 tweets

Return ONLY the thread — numbered tweets separated by blank lines. No preamble.`;
}

export async function POST(req: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { pillar = 'authority', platform = 'both', topic = '', intent = 'authority' } = await req.json();

  const posts: any[] = [];

  try {
    // Generate LinkedIn post
    if (platform === 'linkedin' || platform === 'both') {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: buildLinkedInPrompt(pillar, intent, topic) }],
      });

      const raw = (msg.content[0] as any).text || '';
      // Split hashtags from body
      const lines = raw.trim().split('\n');
      const hashtagLine = lines.findLast((l: string) => l.trim().startsWith('#'));
      const bodyLines = hashtagLine
        ? lines.filter((l: string) => l !== hashtagLine)
        : lines;

      posts.push({
        platform: 'linkedin',
        type: 'Long-form post',
        pillar,
        intent,
        content: bodyLines.join('\n').trim(),
        hashtags: hashtagLine || '',
      });
    }

    // Generate Twitter thread
    if (platform === 'twitter' || platform === 'both') {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: buildTwitterPrompt(pillar, intent, topic) }],
      });

      const raw = (msg.content[0] as any).text || '';
      posts.push({
        platform: 'twitter',
        type: 'Thread',
        pillar,
        intent,
        content: raw.trim(),
        hashtags: '',
      });
    }

    return NextResponse.json({ posts });
  } catch (err: any) {
    console.error('[personal-brand]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
