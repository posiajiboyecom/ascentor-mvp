// ============================================================
// API — /api/admin/agents
// GET  → returns status of all agents (last run, next run, run count)
// POST → manually triggers a specific agent
// Protected: admin only
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";

// ── Agent registry — maps UI agent IDs to Trigger.dev task IDs ──
const AGENT_REGISTRY = [
  {
    id: "1",
    name: "Content Researcher",
    triggerTaskId: "content-researcher-manual",
    type: "manual",
    description: "SerpAPI Google Trends + Perplexity deep research → Claude brief → auto-triggers Content Writer",
    schedule: "Monday 05:00 UTC (06:00 WAT) — or trigger manually with a custom topic",
    toolStack: "SerpAPI + Perplexity + Claude + Supabase",
    requiresPayload: true,
    // stage is set via the stage-picker modal in the UI — shown here for reference only
    payloadSchema: { stage: "explorer|builder|climber — picked via modal", topic: "optional: override the AI-chosen topic", pillar: "optional: leadership|career|ai|coaching|community" },
  },
  {
    id: "2",
    name: "Content Writer",
    triggerTaskId: "content-writer-agent",
    type: "manual",
    description: "Claude API → blog post, 5 LinkedIn posts, 3 threads, newsletter segment",
    schedule: "Manual / After Research",
    toolStack: "Claude API + Supabase",
    requiresPayload: true,
    payloadSchema: { topic: "string", pillar: "leadership|career|ai|coaching|community", week: "number" },
  },
  {
    id: "3",
    name: "Social Scheduler",
    triggerTaskId: "social-scheduler-agent",
    type: "manual",
    description: "Takes approved content from Content Calendar → assigns optimal posting times → queues in Social Queue",
    schedule: "Monday 10:00 WAT (after founder review)",
    toolStack: "Supabase + Claude",
    requiresPayload: true,
    payloadSchema: { week: "week number e.g. 12", pillar: "leadership|career|ai|coaching|community (optional)", autoApprove: "true|false" },
  },
  {
    id: "4",
    name: "Email Sequence Manager",
    triggerTaskId: "send-welcome-email",
    type: "event-driven",
    description: "New Supabase signup → MailerLite sequence enrol → tracks cold leads",
    schedule: "Continuous (event-driven)",
    toolStack: "Supabase + MailerLite API",
  },
  {
    id: "5",
    name: "Lead Scorer",
    triggerTaskId: "lead-scorer-agent",
    type: "scheduled",
    description: "Behaviour analysis → score 1–100 → upgrade notification at 70+",
    schedule: "Daily 02:00 UTC",
    toolStack: "Supabase + MailerLite Tags",
  },
  {
    id: "6",
    name: "Goal Reminder",
    triggerTaskId: "daily-goal-reminder",
    type: "scheduled",
    description: "Nudges users inactive 3–14 days to return and coach with Sage",
    schedule: "Daily 08:00 UTC",
    toolStack: "Supabase + Resend",
  },
  {
    id: "7",
    name: "Analytics Reporter",
    triggerTaskId: "analytics-reporter-agent",
    type: "scheduled",
    description: "Weekly metrics → Claude narrative → founder summary email",
    schedule: "Monday 07:00 UTC",
    toolStack: "Supabase + Resend + Claude",
  },
  {
    id: "8",
    name: "Coaching Summary",
    triggerTaskId: "process-coaching-summary",
    type: "event-driven",
    description: "Session ends → Claude summarises → sends key takeaways email to user",
    schedule: "After every coaching session",
    toolStack: "Claude + Resend + Supabase",
    requiresPayload: true,
    payloadSchema: { sessionId: "uuid", userId: "uuid" },
  },
  {
    id: "9",
    name: "Newsletter Sender",
    triggerTaskId: "send-newsletter",
    type: "manual",
    description: "Batch sends a newsletter to all active Supabase subscribers via Resend",
    schedule: "Manual — triggered from admin",
    toolStack: "Resend + Supabase",
    requiresPayload: true,
    payloadSchema: { subject: "Email subject line", content: "Full HTML email body", sentBy: "admin" },
  },
  {
    id: "10",
    name: "Personal Brand Researcher",
    triggerTaskId: "personal-brand-researcher-manual",
    type: "scheduled",
    description: "Researches recent global cybersecurity news (CVEs, breaches, GRC developments) → builds content brief → triggers Personal Brand Writer. 70% Pentest / 30% GRC mix.",
    schedule: "Mon/Wed/Fri 05:00 UTC (06:00 WAT) — or trigger manually with a topic",
    toolStack: "Claude web search + Supabase",
    requiresPayload: false,
    payloadSchema: { topic: "optional: override the auto-chosen topic", pillar: "optional: penetration_testing|offensive_security|vulnerability_research|red_team|exploit_technique|governance_risk_compliance|security_frameworks|compliance_regulation", intent: "optional: authority|career_signal|inbound_magnet" },
  },
  {
    id: "12",
    name: "Guardsmann Job Alert",
    triggerTaskId: "guardsmann-job-alert",
    type: "scheduled",
    description: "Scans for fresh GRC jobs (last 6 hours) 3× daily — 07:00, 13:00, 18:00 WAT. Sends push notification to Posi's phone when fresh roles are found. Zero manual action required.",
    schedule: "Daily 06:00, 12:00, 17:00 UTC (07:00, 13:00, 18:00 WAT)",
    toolStack: "Claude web search + Web Push + Supabase",
    requiresPayload: false,
  },
  {
    id: "11",
    name: "Personal Brand Writer",
    triggerTaskId: "personal-brand-writer",
    type: "manual",
    description: "Writes LinkedIn post + Twitter thread + single tweet for Posi's cybersecurity personal brand. Practitioner voice, job-seeking signal, authority-building. Saves to content_calendar with pillar=personal_brand.",
    schedule: "Triggered automatically by Personal Brand Researcher",
    toolStack: "Claude Sonnet + Supabase",
    requiresPayload: true,
    payloadSchema: { topic: "string", pillar: "string", intent: "authority|career_signal|inbound_magnet", weekNumber: "number", briefId: "string|null", hook_linkedin: "string", hook_twitter: "string", keyPoints: "string[]", practitionerInsight: "string", careerAngle: "string", recentReference: "string", callToAction: "string" },
  },
];

// ── Fetch recent runs from Trigger.dev Management API ─────────
async function fetchTriggerRuns(taskId: string): Promise<{
  lastRun: string | null;
  lastStatus: string | null;
  runsThisWeek: number;
}> {
  const secretKey = process.env.TRIGGER_SECRET_KEY;
  if (!secretKey) return { lastRun: null, lastStatus: null, runsThisWeek: 0 };

  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const res = await fetch(
      `https://api.trigger.dev/api/v1/runs?taskIdentifier=${taskId}&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return { lastRun: null, lastStatus: null, runsThisWeek: 0 };

    const data = await res.json();
    const runs = data?.data || [];

    const lastRun = runs[0]
      ? new Date(runs[0].createdAt).toLocaleString("en-GB", {
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
        })
      : null;

    const lastStatus = runs[0]?.status || null;

    const runsThisWeek = runs.filter(
      (r: any) => new Date(r.createdAt).toISOString() >= weekAgo
    ).length;

    return { lastRun, lastStatus, runsThisWeek };
  } catch {
    return { lastRun: null, lastStatus: null, runsThisWeek: 0 };
  }
}

// ── Determine agent status from Trigger.dev run data ─────────
function deriveStatus(agent: typeof AGENT_REGISTRY[0], runData: {
  lastStatus: string | null;
  lastRun: string | null;
}): "active" | "idle" | "error" | "building" {
  if (!agent.triggerTaskId) return "building";
  if (runData.lastStatus === "FAILED" || runData.lastStatus === "CRASHED") return "error";
  if (runData.lastStatus === "COMPLETED" || runData.lastStatus === "EXECUTING") return "active";
  if (runData.lastRun) return "idle";
  return "idle";
}

// ── GET — return all agent statuses ──────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "moderator"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch run data for all agents with a task ID in parallel
  const agentStatuses = await Promise.all(
    AGENT_REGISTRY.map(async (agent) => {
      const runData = agent.triggerTaskId
        ? await fetchTriggerRuns(agent.triggerTaskId)
        : { lastRun: null, lastStatus: null, runsThisWeek: 0 };

      return {
        id:            agent.id,
        name:          agent.name,
        description:   agent.description,
        schedule:      agent.schedule,
        toolStack:     agent.toolStack,
        type:          agent.type,
        triggerTaskId: agent.triggerTaskId,
        canTrigger:    !!agent.triggerTaskId,
        requiresPayload: agent.requiresPayload || false,
        payloadSchema: agent.payloadSchema || null,
        lastRun:       runData.lastRun,
        lastStatus:    runData.lastStatus,
        runsThisWeek:  runData.runsThisWeek,
        status:        deriveStatus(agent, runData),
      };
    })
  );

  return NextResponse.json({ agents: agentStatuses });
}

// ── POST — manually trigger an agent ─────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
  }

  const { agentId, payload = {} } = await req.json();

  const agent = AGENT_REGISTRY.find(a => a.id === agentId);
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  if (!agent.triggerTaskId) {
    return NextResponse.json({ error: "This agent has no Trigger.dev task yet — marked as Building" }, { status: 400 });
  }

  try {
    const handle = await tasks.trigger(agent.triggerTaskId, {
      ...payload,
      triggeredBy: `admin:${user.id}`,
    });

    // Log the manual trigger to audit_logs
    await supabase.from("audit_logs").insert({
      user_id:     user.id,
      action:      "agent_manual_trigger",
      entity_type: "agent",
      entity_id:   agent.triggerTaskId,
      details:     { agentName: agent.name, runId: handle.id, payload },
    });

    return NextResponse.json({
      success: true,
      runId:   handle.id,
      agent:   agent.name,
      message: `${agent.name} triggered successfully`,
    });
  } catch (err: any) {
    console.error(`[admin/agents] Trigger error for ${agent.triggerTaskId}:`, err);
    return NextResponse.json(
      { error: `Failed to trigger ${agent.name}: ${err.message}` },
      { status: 500 }
    );
  }
}
