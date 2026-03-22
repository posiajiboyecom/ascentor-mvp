// POST /api/guardsmann/jobs
//
// Searches multiple sources for GRC jobs — no date restriction by default.
// Runs 3 parallel targeted searches to maximise coverage:
//   Search 1 — LinkedIn/Greenhouse/Lever: remote, global companies
//   Search 2 — African multinationals with GRC openings
//   Search 3 — Niche GRC job boards (ISACA, CyberSeek, InfoSec jobs)
//
// FRESH ONLY MODE (optional toggle):
//   When enabled, filters to jobs posted in the last 48 hours.
//   OFF by default — gathers all available jobs.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 90;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── How old is "posted recently"? ────────────────────────────────────────
function isWithin48Hours(postedText: string | null): boolean {
  if (!postedText) return false;
  const t = postedText.toLowerCase();
  // Accept: "just now", "1 hour ago", "2 hours ago" ... "47 hours ago",
  //         "today", "yesterday" (borderline — include it), "1 day ago"
  if (t.includes('just now') || t.includes('today') || t.includes('yesterday')) return true;
  if (t.includes('hour'))  return true; // any "X hours ago"
  if (t.includes('1 day') || t.includes('2 day')) return true; // 1-2 days old
  if (t.includes('minute')) return true;
  return false;
}

// ── Single search call ────────────────────────────────────────────────────
async function runSearch(prompt: string): Promise<any[]> {
  const msg = await claude.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    tools:      [{ type: 'web_search_20250305', name: 'web_search' } as any],
    messages:   [{ role: 'user', content: prompt }],
  });

  const text = msg.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try { return JSON.parse(jsonMatch[0]); } catch { return []; }
}

// ── Search 1: Global remote GRC jobs ──────────────────────────────────────
function globalSearchPrompt(role: string, region: string, keywords: string): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Today is ${today}. You are searching for FRESH job postings for a GRC professional in Nigeria.

Search LinkedIn, Greenhouse (greenhouse.io), Lever (lever.co), Ashby (ashbyhq.com), and Workday for:
"${role} remote entry level ${keywords} posted today OR posted yesterday"

STRICT FILTERS — reject anything that fails:
1. Posted within the LAST 48 HOURS only — "today", "yesterday", "X hours ago", "1 day ago"
   REJECT anything posted "3 days ago" or longer. We need fresh jobs only.
2. Fully remote — must explicitly say remote or work from anywhere
3. Open to applicants from Nigeria / international applicants
4. 0-3 years experience maximum
5. USD pay preferred${region && region !== 'global' ? `\n6. Company region: ${region}` : ''}

Search specifically on: site:linkedin.com/jobs OR site:greenhouse.io OR site:lever.co OR site:ashbyhq.com
Also search: "${role}" remote "posted today" OR "${role}" remote "1 hour ago" OR "${role}" remote "2 hours ago"

Return ONLY jobs meeting ALL filters as JSON array. If no fresh jobs found, return [].
[{
  "company": "string",
  "hq": "string",
  "title": "string",
  "salary": "string or null",
  "remote": true,
  "openToInternational": true,
  "experienceRequired": "string",
  "url": "string or null",
  "requirements": ["string — max 4 items"],
  "fitNote": "string — why good for entry-level GRC",
  "postedAt": "string — exact text e.g. '3 hours ago', '1 day ago'",
  "source": "linkedin | greenhouse | lever | ashby | other",
  "companyType": "global_remote | africa_multinational | nigeria_based",
  "hoursOld": number — estimated hours since posting (0-48 only),
  "jobLevel": "entry | mid | senior | management — classify from title and experience"
}]
Return JSON array only, no markdown.`;
}

// ── Search 2: African multinational GRC jobs ──────────────────────────────
function africaSearchPrompt(role: string): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Today is ${today}. Search for GRC/compliance/risk jobs posted IN THE LAST 48 HOURS at multinationals operating in Nigeria or Africa.

Target companies: MTN, Airtel, Glo, 9mobile, Access Bank, GTBank, Zenith Bank, UBA, First Bank, Stanbic IBTC, Standard Chartered Nigeria, Citibank Nigeria, Shell Nigeria, TotalEnergies Nigeria, ExxonMobil Nigeria, Nestlé Nigeria, Unilever Nigeria, PwC Nigeria, Deloitte Nigeria, KPMG Nigeria, EY Nigeria, Accenture Nigeria, Microsoft Nigeria, Google Nigeria, Flutterwave, Paystack, Interswitch, Andela, IFC, World Bank Nigeria, UN agencies Nigeria.

Search: "${role} Nigeria" site:linkedin.com/jobs
Also: "${role}" "Lagos" OR "Abuja" OR "Nigeria" site:linkedin.com/jobs

FILTERS:
1. No date restriction — include all available GRC/risk/compliance jobs you can find.
2. At a recognised multinational or major Nigerian institution
3. ANY experience level — include entry, mid, senior, and management roles
4. GRC, Risk, Compliance, or InfoSec function

Return JSON array (same schema as above) or [] if nothing found.
[{
  "company": "string",
  "hq": "string",
  "title": "string",
  "salary": "string or null",
  "remote": false,
  "openToInternational": true,
  "experienceRequired": "string",
  "url": "string or null",
  "requirements": ["string"],
  "fitNote": "string",
  "postedAt": "string",
  "source": "linkedin | company_site | other",
  "companyType": "africa_multinational | nigeria_based",
  "hoursOld": number,
  "jobLevel": "entry | mid | senior | management — classify from title and experience"
}]
JSON only.`;
}

// ── Search 3: Niche GRC job boards ────────────────────────────────────────
function nicheSearchPrompt(role: string, keywords: string): string {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Today is ${today}. Search niche cybersecurity and GRC job boards for ALL available GRC job postings — no date restriction.

Search these sources:
- ISACA job board (isaca.org/job-board)
- CyberSecJobs (cybersecjobs.com)
- InfoSec-Jobs (infosec-jobs.com)
- CyberSN (cybersn.com)
- Dice.com (filter: GRC, remote)
- Indeed: "GRC Analyst" remote
- Indeed: "Compliance Analyst" remote
- Indeed: "Risk Analyst" remote

Role: "${role}" ${keywords ? `with keywords: ${keywords}` : ''}

FILTERS: Remote, open to international applicants, any experience level. No date restriction — gather all available GRC roles.

Return JSON array or [] if nothing found.
[{
  "company": "string",
  "hq": "string",
  "title": "string",
  "salary": "string or null",
  "remote": true,
  "openToInternational": true,
  "experienceRequired": "string",
  "url": "string or null",
  "requirements": ["string"],
  "fitNote": "string",
  "postedAt": "string",
  "source": "isaca | infosec-jobs | dice | indeed | other",
  "companyType": "global_remote | africa_multinational | nigeria_based",
  "hoursOld": number,
  "jobLevel": "entry | mid | senior | management — classify from title and experience"
}]
JSON only.`;
}

// ── Classify job level from title + experienceRequired ───────────────────
// Returns: 'entry' | 'mid' | 'senior' | 'management'
function classifyLevel(job: any): string {
  const title = (job.title || '').toLowerCase();
  const exp   = (job.experienceRequired || '').toLowerCase();

  // Management indicators
  if (/\b(manager|director|head of|vp |vice president|chief|ciso|cro|cco|lead|principal)\b/.test(title)) return 'management';

  // Senior indicators
  if (/\b(senior|sr\.|sr |specialist|consultant|advisor|experienced|iii|iv|level 3|level 4)\b/.test(title)) return 'senior';
  if (/\b(5\+|6\+|7\+|8\+|10\+|5 year|6 year|7 year)\b/.test(exp)) return 'senior';

  // Mid-level indicators
  if (/\b(mid.level|mid level|intermediate|ii|level 2|2\+|3\+|4\+|2-4|3-5|2 to 4|3 to 5)\b/.test(title + ' ' + exp)) return 'mid';

  // Entry indicators
  if (/\b(junior|jr\.|jr |associate|entry.level|entry level|graduate|analyst i|level 1|0-2|0-3|1-2|1-3|0 to 2|fresh)\b/.test(title + ' ' + exp)) return 'entry';

  // Default heuristic from experience string
  if (/0|1|2/.test(exp.match(/\d+/)?.[0] || '')) return 'entry';
  if (/3|4/.test(exp.match(/\d+/)?.[0] || '')) return 'mid';

  // Default — treat unknown as entry (conservative for job seeker)
  return 'entry';
}

// ── Deduplicate by company+title ──────────────────────────────────────────
function deduplicate(jobs: any[]): any[] {
  const seen = new Set<string>();
  return jobs.filter(j => {
    const key = `${(j.company || '').toLowerCase()}|${(j.title || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    role      = 'GRC Analyst',
    keywords  = '',
    region    = 'global',
    freshOnly = true,
  } = await req.json();

  try {
    // Run all 3 searches in parallel
    const [globalJobs, africaJobs, nicheJobs] = await Promise.allSettled([
      runSearch(globalSearchPrompt(role, region, keywords)),
      runSearch(africaSearchPrompt(role)),
      runSearch(nicheSearchPrompt(role, keywords)),
    ]);

    const allJobs = [
      ...(globalJobs.status === 'fulfilled' ? globalJobs.value : []),
      ...(africaJobs.status === 'fulfilled' ? africaJobs.value : []),
      ...(nicheJobs.status  === 'fulfilled' ? nicheJobs.value  : []),
    ];

    // Deduplicate
    let jobs = deduplicate(allJobs);

    // Apply fresh filter (optional — user can toggle off to see all jobs)
    if (freshOnly) {
      jobs = jobs.filter(j =>
        isWithin48Hours(j.postedAt) || (typeof j.hoursOld === 'number' && j.hoursOld <= 48)
      );
    }
    // When freshOnly is OFF — keep all jobs regardless of age

    // Classify each job by level
    jobs = jobs.map(j => ({ ...j, jobLevel: classifyLevel(j) }));

    // Sort by freshness first, then by level priority (entry first for this user)
    const levelOrder: Record<string, number> = { entry: 0, mid: 1, senior: 2, management: 3 };
    jobs.sort((a, b) => {
      const hoursDiff = (a.hoursOld ?? 99) - (b.hoursOld ?? 99);
      if (hoursDiff !== 0) return hoursDiff;
      return (levelOrder[a.jobLevel] ?? 0) - (levelOrder[b.jobLevel] ?? 0);
    });

    // Build level breakdown counts
    const byLevel = {
      entry:      jobs.filter(j => j.jobLevel === 'entry').length,
      mid:        jobs.filter(j => j.jobLevel === 'mid').length,
      senior:     jobs.filter(j => j.jobLevel === 'senior').length,
      management: jobs.filter(j => j.jobLevel === 'management').length,
    };

    return NextResponse.json({
      jobs,
      count:      jobs.length,
      searchRole: role,
      freshOnly,
      byLevel,
      sources: {
        global:  globalJobs.status === 'fulfilled' ? globalJobs.value.length : 0,
        africa:  africaJobs.status === 'fulfilled' ? africaJobs.value.length : 0,
        niche:   nicheJobs.status  === 'fulfilled' ? nicheJobs.value.length  : 0,
      },
    });
  } catch (err: any) {
    console.error('[guardsmann/jobs]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
