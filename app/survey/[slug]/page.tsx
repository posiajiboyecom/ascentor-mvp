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

  const url = `${supabaseUrl}/rest/v1/surveys?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=*&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey:        supabaseAnon,
      Authorization: `Bearer ${supabaseAnon}`,
      Accept:        'application/json',
    },
    // Always fetch fresh — don't serve a cached unpublished survey
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const rows: Survey[] = await res.json();
  return rows[0] ?? null;
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
