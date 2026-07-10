import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";
import sanitizeHtml from "sanitize-html";

// H-05: Allowlist of tags and attributes safe for email newsletters.
// Blocks <script>, event handlers, javascript: hrefs, and arbitrary attributes.
const EMAIL_SANITISE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1','h2','h3','h4','p','br','b','strong','i','em','u','s',
    'ul','ol','li','blockquote','a','img','div','span','hr',
    'table','thead','tbody','tr','th','td',
  ],
  allowedAttributes: {
    'a':   ['href', 'target', 'rel', 'style'],
    'img': ['src', 'alt', 'width', 'height', 'style'],
    '*':   ['style', 'class'],
  },
  allowedSchemes: ['https', 'mailto'],   // blocks javascript: and data: URIs
  allowedSchemesByTag: {
    'img': ['https'],                    // no data: URIs in images
  },
  disallowedTagsMode: 'discard',
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { subject, content } = await req.json();
    if (!subject || !content) {
      return NextResponse.json({ error: "Subject and content required" }, { status: 400 });
    }

    // H-05: Sanitise newsletter HTML server-side before sending to subscribers.
    // Prevents a compromised admin account (or malicious clipboard paste) from
    // sending XSS payloads / phishing scripts to the entire subscriber list.
    const safeContent = sanitizeHtml(content, EMAIL_SANITISE_OPTIONS);

    const handle = await tasks.trigger("send-newsletter", {
      subject,
      content: safeContent,
      sentBy: user.email || user.id,
    });
    return NextResponse.json({ success: true, runId: handle.id });
  } catch (error: any) {
    console.error("Newsletter trigger failed:", error);
    return NextResponse.json({ error: 'Newsletter send failed' }, { status: 500 });
  }
}