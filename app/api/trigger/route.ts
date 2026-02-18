import { createAppRoute } from "@trigger.dev/nextjs";
import "@/trigger/welcome-email";
import "@/trigger/send-newsletter";
import "@/trigger/coaching-summary";
import "@/trigger/goal-reminder";

export const { POST, dynamic } = createAppRoute({
  path: "/api/trigger",
});

export const runtime = "nodejs";
