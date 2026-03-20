// app/survey/[slug]/page.tsx
// Fully public — no auth, no cookies, no middleware dependency.
// Fetches survey data directly via Supabase REST API using the anon key.

import { notFound } from 'next/navigation';
import SurveyClient from './SurveyClient';
import type { Metadata } from 'next';
import type { Survey } from '@/types/survey';

interface Props {
  params: Promise<{ slug: string }>;
}

async function fetchSurvey(slug: string): Promise<Survey | null> {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Fetch by slug only — check is_published in code after
  // (is_published=eq.true in the query can silently return [] if RLS blocks it)
  const url = `${supabaseUrl}/rest/v1/surveys?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey:         supabaseAnon,
      Authorization:  `Bearer ${supabaseAnon}`,
      Accept:         'application/json',
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error('[SurveyPage] REST fetch failed:', res.status, await res.text());
    return null;
  }

  const rows: Survey[] = await res.json();
  const survey = rows[0] ?? null;

  // Only serve published surveys publicly
  if (survey && !survey.is_published) return null;

  return survey;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const survey = await fetchSurvey(slug);

  return {
    title:       survey ? `${survey.title} — Ascentor` : 'Survey — Ascentor',
    description: survey?.description ?? 'Share your feedback and help us build what you actually need.',
  };
}

export default async function SurveyPage({ params }: Props) {
  const { slug } = await params;
  const survey = await fetchSurvey(slug);

  if (!survey) notFound();

  return <SurveyClient survey={survey} />;
}
