// ═══════════════════════════════════════════════════════════
// ONE-TIME BACKFILL SCRIPT
// Adds all existing app users to the newsletter_subscribers table
//
// Run with:
//   npx tsx scripts/backfill-newsletter-subscribers.ts
// ═══════════════════════════════════════════════════════════

import * as fs from "fs";
import * as path from "path";

// Load .env.local manually — no dotenv-cli needed
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      console.log(`Loading env from ${file}`);
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
      break;
    }
  }
}

loadEnv();

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("\n❌ Missing environment variables.");
  console.error("   Make sure your .env.local file exists and contains:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL=...");
  console.error("   SUPABASE_SERVICE_ROLE_KEY=...\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfill() {
  console.log("Fetching all users from Supabase auth...");

  // Pull from auth.users — covers every signed-up user regardless of profile table name
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError || !authUsers) {
    console.error("Failed to fetch auth users:", authError);
    process.exit(1);
  }

  console.log(`Found ${authUsers.users.length} users in auth`);

  // Also fetch any existing subscribers so we don't create duplicates
  const { data: existingSubs } = await supabase
    .from("newsletter_subscribers")
    .select("email");

  const alreadySubscribed = new Set(
    (existingSubs || []).map((s: any) => s.email.toLowerCase())
  );

  console.log(`Already in newsletter_subscribers: ${alreadySubscribed.size}`);

  // Build the list of users to insert
  const toInsert = authUsers.users
    .filter((u) => u.email && !alreadySubscribed.has(u.email.toLowerCase()))
    .map((u) => ({
      email: u.email!,
      first_name:
        u.user_metadata?.full_name?.split(" ")[0] ||
        u.user_metadata?.name?.split(" ")[0] ||
        u.user_metadata?.first_name ||
        "",
      source: "app_user",
      is_active: true,
      created_at: u.created_at,
    }));

  if (toInsert.length === 0) {
    console.log("All users are already subscribed. Nothing to do.");
    return;
  }

  console.log(`Inserting ${toInsert.length} new subscribers...`);
  console.table(toInsert.map((u) => ({ email: u.email, first_name: u.first_name })));

  const { error: insertError } = await supabase
    .from("newsletter_subscribers")
    .insert(toInsert);

  if (insertError) {
    console.error("Insert failed:", insertError);
    process.exit(1);
  }

  console.log(`\n✅ Done! ${toInsert.length} users added to newsletter_subscribers.`);
  console.log(`   ${alreadySubscribed.size} were already subscribed — skipped.`);
}

backfill();
