// Prisma CLI configuration (used only by `prisma ...` commands, never by the app).
//
// DATABASE_URL must be the Supabase DIRECT connection string:
//   Supabase dashboard -> Project Settings -> Database -> Connection string
//   -> "Direct connection" (host db.<ref>.supabase.co, port 5432).
// Put it in .env.local (gitignored). Do NOT use the transaction pooler (port 6543)
// for introspection or db execute.
import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: '.env.local' });
config(); // fall back to .env

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
