// POST /api/guardsmann/recruiters
//
// Finds GRC-specialised recruiters and staffing agencies to contact directly.
// Two modes:
//   mode: 'recruiters'  — individual LinkedIn recruiters hiring GRC roles now
//   mode: 'agencies'    — staffing/recruitment agencies with active GRC mandates
//
// Strategy: contact recruiters BEFORE roles are publicly posted.
// Recruiters with active GRC mandates often place candidates before
// the job even appears on LinkedIn.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 90;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── DM template generator ─────────────────────────────────────────────────
function buildDMTemplate(recruiterName: string, specialisation: string): string {
  return `Hi ${recruiterName},

I came across your profile and noticed you recruit in the ${specialisation} space.

I'm a GRC professional with hands-on experience in ISO 27001, risk assessment, compliance, and audit preparation. CompTIA Security+, Google Cybersecurity Professional, and ISACA member.

Actively seeking remote entry-level GRC roles — open to global opportunities.

Happy to share my CV if you have relevant mandates. Would a quick conversation make sense?

Best,
Posi`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mode = 'recruiters', region = 'global' } = await req.json();

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const regionContext = region === 'global'
    ? 'US, UK, Europe, Canada, Australia — companies that hire internationally'
    : region === 'Nigeria' || region === 'Africa'
    ? 'Nigeria, Ghana, Kenya, South Africa — African multinationals and international firms with African offices'
    : region;

  try {
    let prompt = '';

    if (mode === 'recruiters') {
      prompt = `Today is ${today}. Find LinkedIn recruiters who are ACTIVELY hiring for GRC, Risk, or Compliance roles right now.

Search LinkedIn for recruiters who have recently:
- Posted about GRC/compliance/risk job openings
- Shared posts mentioning "GRC Analyst", "Compliance Analyst", "Risk Analyst" + "hiring" or "open role"
- Are tagged as "Recruiter", "Talent Acquisition", "Technical Recruiter" at firms in: ${regionContext}

Also search: site:linkedin.com "GRC" "hiring" recruiter posted:week
And: site:linkedin.com "compliance analyst" "we're hiring" recruiter

For each recruiter found, return:
{
  "name": "string",
  "title": "string e.g. Senior Recruiter, Talent Acquisition Partner",
  "company": "string — their employer or agency",
  "specialisation": "string — GRC / Cybersecurity / Risk & Compliance",
  "linkedinUrl": "string or null",
  "recentActivity": "string — what they recently posted or did that shows active GRC hiring",
  "activeRoles": ["string — job titles they are currently recruiting for"],
  "region": "string — where they typically place candidates",
  "dmTemplate": "string — personalised 3-sentence outreach message for Posi to send",
  "priorityScore": number 1-10 — 10 = most likely to have relevant mandates right now,
  "whyContact": "string — why this recruiter is worth messaging today"
}

Return as JSON array. Focus on ACTIVE recruiters with current GRC mandates, not generic career coaches.
JSON array only, no markdown.`;

    } else {
      // mode === 'agencies'
      prompt = `Today is ${today}. Find staffing and recruitment agencies that specialise in cybersecurity and GRC placement, and that actively place candidates in remote roles or roles in ${regionContext}.

Target agency types:
1. Cybersecurity-focused agencies: CyberSN, Heidrick & Struggles (tech security), Robert Half Technology, Kforce, TEKsystems, Experis, Modis
2. GRC-specialist agencies: agencies with "risk", "compliance", "governance" in their name or specialisation
3. African-focused tech recruiters: Andela Talent, TalentQL, Jobberman (for MNC roles), Shortlist.pro
4. Big 4 internal talent acquisition (Deloitte, PwC, KPMG, EY recruiting portals)

For each agency:
{
  "agencyName": "string",
  "specialisation": "string",
  "website": "string or null",
  "contactMethod": "string — how to reach them: jobs page URL, email format, LinkedIn page",
  "typicalRoles": ["string — GRC/compliance roles they regularly fill"],
  "regions": ["string — where they place"],
  "openToNigerianCandidates": boolean,
  "submissionProcess": "string — how to get on their radar: apply via portal, send CV to email, etc.",
  "priorityScore": number 1-10,
  "whyThisAgency": "string — why worth submitting to for entry-level GRC"
}

Return as JSON array. Focus on agencies ACTIVELY placing GRC candidates now.
JSON array only, no markdown.`;
    }

    const msg = await claude.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      tools:      [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages:   [{ role: 'user', content: prompt }],
    });

    const text = msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let results: any[] = [];
    try {
      results = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
    } catch {
      return NextResponse.json({ results: [], raw: text });
    }

    // Sort by priority score descending
    results.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

    // Inject DM templates for recruiters if not already set
    if (mode === 'recruiters') {
      results = results.map(r => ({
        ...r,
        dmTemplate: r.dmTemplate || buildDMTemplate(
          r.name?.split(' ')[0] || 'there',
          r.specialisation || 'GRC and compliance'
        ),
      }));
    }

    return NextResponse.json({ results, mode, count: results.length });
  } catch (err: any) {
    console.error('[guardsmann/recruiters]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
