import { createClient } from '@supabase/supabase-js';

// WARNING: This bypasses Row Level Security
// Only use in server-side API routes, NEVER in client code
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);