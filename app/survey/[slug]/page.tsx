// app/survey/[slug]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SurveyClient from './SurveyClient';
import type { Metadata } from 'next';
import type { Survey } from '@/types/survey';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('surveys')
    .select('title, description')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  return {
    title: data ? `${data.title} — Ascentor` : 'Survey — Ascentor',
    description: data?.description ?? 'Share your feedback and help us build what you actually need.',
  };
}

export default async function SurveyPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from('surveys')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!data) redirect('/');

  return <SurveyClient survey={data as Survey} />;
}
