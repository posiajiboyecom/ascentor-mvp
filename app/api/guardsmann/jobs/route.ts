// POST /api/guardsmann/jobs
// Searches for entry-level GRC jobs open to foreign remote workers
// paid in USD from companies outside Africa
//
// Uses Claude web search to find real current listings from:
// - LinkedIn, Greenhouse, Lever, Workday, Ashby job boards
// - Focuses on: GRC Analyst, Risk Analyst, Compliance Analyst,
//   InfoSec Analyst, Junior GRC Consultant, Risk & Compliance Analyst
//
// Filters: Remote + Open to international/foreign applicants + USD pay

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const {
    role     = 'GRC Analyst',
    keywords = '',
    region   = 'global',
  } = await req.json();

  const searchQuery = [
    role, 'remote', 'entry level',
    keywords || 'open to international applicants',
    region !== 'global' ? region : '',
    'USD',
  ].filter(Boolean).join(' ');

  try {
    const msg = await claude.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      tools:      [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages: [{
        role:    'user',
        content: `You are a job search assistant for Posi Ajiboye Samuel — a GRC professional in Nigeria seeking remote entry-level GRC roles from global companies that pay in USD and accept foreign/international applicants.

Search for: "${searchQuery}"

CRITICAL FILTERS (all must apply):
1. Remote or fully remote — OR based in Nigeria/Africa if the company is a multinational
2. Open to Nigerian/African applicants
3. Entry-level or 0-3 years experience
4. USD compensation OR competitive local equivalent for African multinationals
5. Company must be one of: (a) global/Western company hiring internationally, OR (b) a multinational operating in Nigeria or Africa (banks, telecoms, consulting, tech, oil & gas, FMCG)

COMPANY TYPES TO INCLUDE:
- Global companies hiring remote (Deloitte, PwC, KPMG, EY, Accenture, IBM, etc.)
- Multinationals with Nigerian/African offices (MTN, Airtel, Access Bank, GTBank, Stanbic IBTC, Standard Chartered, Citibank Nigeria, Shell, TotalEnergies, Nestlé, Unilever, P&G, Microsoft Nigeria, Google Nigeria, etc.)
- Tech companies with African presence or remote-friendly hiring
- Any company with GRC/Risk/Compliance function that accepts Nigerian applicants

ROLES TO FIND: GRC Analyst, Risk Analyst, Compliance Analyst, Information Security Analyst, Junior GRC Consultant, Risk & Compliance Analyst, GRC Associate

For each job found, return:
- Company name and location/hq
- Job title
- Salary range in USD if listed
- Whether it explicitly mentions remote + international
- Direct application URL if available
- Key requirements (keep to 3-4 bullet points)
- Why it's a good fit for an entry-level GRC professional

Return as JSON array:
[{
  "company": "string",
  "hq": "string (city, country)",
  "title": "string",
  "salary": "string or null — USD for global remote, or local USD-equivalent for African multinationals",
  "remote": true,
  "openToInternational": true,
  "experienceRequired": "string e.g. 0-2 years",
  "url": "string or null",
  "requirements": ["string"],
  "fitNote": "string — why this is good for entry-level GRC",
  "postedRecently": "string e.g. 2 days ago or null",
  "companyType": "global_remote | africa_multinational | nigeria_based"
}]

If you cannot find jobs matching ALL filters, return what you found and mark which filters they fail on in the fitNote. Return a JSON array only, no markdown.`,
      }],
    });

    const text = msg.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    let jobs: any[] = [];
    try {
      jobs = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
    } catch {
      // Return raw text if JSON parse fails
      return NextResponse.json({ jobs: [], raw: text, error: 'Could not parse results as JSON — see raw' });
    }

    return NextResponse.json({ jobs, searchQuery, count: jobs.length });
  } catch (err: any) {
    console.error('[guardsmann/jobs]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
