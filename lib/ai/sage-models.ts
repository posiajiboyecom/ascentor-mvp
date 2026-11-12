import 'server-only';
// lib/ai/sage-models.ts
// Sage's language models: a chain of providers, each tried in turn until one answers. Built for running Sage with no
// AI budget on free tiers; a paid provider can be added at the end later.
//
//   Order (env SAGE_PROVIDERS, comma separated; default "groq,cloudflare,sambanova,openrouter"):
//     groq        Groq free plan, OpenAI's open gpt-oss models. Two models with separate daily quotas: 120b first,
//                 then 20b. About 200K tokens a day each. Groq does not keep inference data by default.  GROQ_API_KEY
//     cloudflare  Cloudflare Workers AI, Gemma 4 26B. 10,000 free "neurons" a day (roughly 300 Sage replies).
//                 CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN (a token with Workers AI permission)
//     sambanova   SambaNova Cloud free tier, DeepSeek V3.1, then Gemma 4 31B. A small daily allowance (about 20 requests),
//                 so it only covers Groq and Cloudflare being busy.  SAMBANOVA_API_KEY
//     openrouter  OpenRouter's free-model router (about 50 requests a day). Last resort: some free models behind it
//                 may log prompts, depending on the account's privacy settings.  OPENROUTER_API_KEY
//     anthropic   Claude (paid). Only used if listed in SAGE_PROVIDERS.  ANTHROPIC_API_KEY
//
//   Until any free key is added, Sage keeps using Claude (the changeover rule in sageChain).
//   A provider without its keys is skipped. A provider that says "too many requests" or fails is skipped for a while
//   (in this server instance) and the next one is tried. If none answers, SageBusyError is thrown and Sage tells the
//   member it is busy. Every call has a time limit, so one slow provider cannot hang a reply.

import Anthropic from '@anthropic-ai/sdk';

export interface ChatTurn { role: 'user' | 'assistant'; content: string }
export interface SageAnswer { text: string; provider: string; model: string }

export class SageBusyError extends Error {
  constructor(public tried: string[]) { super(`No Sage provider answered (${tried.join(', ') || 'none configured'})`); }
}

interface Target {
  id: string;            // e.g. "groq:openai/gpt-oss-120b"
  provider: string;
  model: string;
  ready: () => boolean;
  call: (system: string, turns: ChatTurn[], maxTokens: number, signal: AbortSignal) => Promise<string>;
}

const TIMEOUT_MS = 20_000;

/** Provider cool-downs after a rate limit or failure, per server instance: id -> time it may be tried again. */
const coolUntil = new Map<string, number>();

class HttpError extends Error {
  constructor(public status: number, public retryAfter: number | null, body: string) { super(`${status} ${body.slice(0, 160)}`); }
}

/** One call to an OpenAI-compatible chat endpoint. */
async function openAiCompatible(url: string, headers: Record<string, string>, body: Record<string, unknown>, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const ra = Number(res.headers.get('retry-after'));
    throw new HttpError(res.status, Number.isFinite(ra) && ra > 0 ? ra : null, await res.text().catch(() => ''));
  }
  const j = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return (j.choices?.[0]?.message?.content ?? '').trim();
}

const asMessages = (system: string, turns: ChatTurn[]) => [{ role: 'system', content: system }, ...turns];

function groq(model: string): Target {
  return {
    id: `groq:${model}`, provider: 'groq', model,
    ready: () => !!process.env.GROQ_API_KEY,
    call: (system, turns, maxTokens, signal) => openAiCompatible('https://api.groq.com/openai/v1/chat/completions',
      { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      // gpt-oss models reason before answering; keep that short and out of the reply so it doesn't eat the quota.
      { model, messages: asMessages(system, turns), max_completion_tokens: maxTokens + 300, temperature: 0.7, reasoning_effort: 'low', include_reasoning: false },
      signal),
  };
}

const CF_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const cloudflare: Target = {
  id: `cloudflare:${CF_MODEL}`, provider: 'cloudflare', model: CF_MODEL,
  ready: () => !!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_AI_TOKEN,
  call: (system, turns, maxTokens, signal) => openAiCompatible(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
    { Authorization: `Bearer ${process.env.CLOUDFLARE_AI_TOKEN}` },
    { model: CF_MODEL, messages: asMessages(system, turns), max_tokens: maxTokens, temperature: 0.7 },
    signal),
};

function sambanova(model: string): Target {
  return {
    id: `sambanova:${model}`, provider: 'sambanova', model,
    ready: () => !!process.env.SAMBANOVA_API_KEY,
    call: (system, turns, maxTokens, signal) => openAiCompatible('https://api.sambanova.ai/v1/chat/completions',
      { Authorization: `Bearer ${process.env.SAMBANOVA_API_KEY}` },
      { model, messages: asMessages(system, turns), max_tokens: maxTokens, temperature: 0.7 },
      signal),
  };
}

const openrouter: Target = {
  id: 'openrouter:openrouter/free', provider: 'openrouter', model: 'openrouter/free',
  ready: () => !!process.env.OPENROUTER_API_KEY,
  call: (system, turns, maxTokens, signal) => openAiCompatible('https://openrouter.ai/api/v1/chat/completions',
    { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://joinascentor.com', 'X-Title': 'Ascentor Sage' },
    { model: 'openrouter/free', messages: asMessages(system, turns), max_tokens: maxTokens, temperature: 0.7 },
    signal),
};

const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const anthropic: Target = {
  id: `anthropic:${ANTHROPIC_MODEL}`, provider: 'anthropic', model: ANTHROPIC_MODEL,
  ready: () => !!process.env.ANTHROPIC_API_KEY,
  call: async (system, turns, maxTokens, signal) => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await client.messages.create({ model: ANTHROPIC_MODEL, max_tokens: maxTokens, system, messages: turns }, { signal });
    const b = r.content[0];
    return b && b.type === 'text' ? b.text.trim() : '';
  },
};

const BY_NAME: Record<string, Target[]> = {
  groq: [groq('openai/gpt-oss-120b'), groq('openai/gpt-oss-20b')],
  cloudflare: [cloudflare],
  sambanova: [sambanova('DeepSeek-V3.1'), sambanova('gemma-4-31B-it')],
  openrouter: [openrouter],
  anthropic: [anthropic],
};

/** The chain in order, from SAGE_PROVIDERS. */
export function sageChain(env = process.env.SAGE_PROVIDERS): Target[] {
  const names = (env ?? 'groq,cloudflare,sambanova,openrouter').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const chain = names.flatMap((n) => BY_NAME[n] ?? []);
  // Changeover: until a free provider's keys are added (and SAGE_PROVIDERS is not set), keep using Claude as before,
  // so Sage never goes quiet in between. As soon as one free key exists, Claude drops out unless listed.
  if (env == null && !chain.some((t) => t.ready())) return BY_NAME.anthropic;
  return chain;
}

/** Is any provider set up at all? (Keys present.) */
export function sageConfigured(): boolean {
  return sageChain().some((t) => t.ready());
}

/** How long to skip a provider after this error, in ms. */
export function coolDownFor(err: unknown): number {
  if (err instanceof HttpError) {
    if (err.status === 429) return Math.min(30 * 60_000, Math.max(60_000, (err.retryAfter ?? 120) * 1000));
    if (err.status === 401 || err.status === 403) return 30 * 60_000;   // wrong or missing key: no point retrying soon
    if (err.status >= 500) return 60_000;
    return 60_000;
  }
  return 30_000; // timeout or network
}

/** Ask the chain. Returns the first non-empty answer, or throws SageBusyError. */
export async function askSage(system: string, turns: ChatTurn[], maxTokens = 500, now = Date.now()): Promise<SageAnswer> {
  const tried: string[] = [];
  for (const t of sageChain()) {
    if (!t.ready()) continue;
    if ((coolUntil.get(t.id) ?? 0) > now) continue;
    tried.push(t.id);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const text = await t.call(system, turns, maxTokens, ctl.signal);
      if (text) return { text, provider: t.provider, model: t.model };
      coolUntil.set(t.id, Date.now() + 30_000);
    } catch (e) {
      coolUntil.set(t.id, Date.now() + coolDownFor(e));
      console.error(`[sage] ${t.id} failed:`, e instanceof Error ? e.message : e);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new SageBusyError(tried);
}
