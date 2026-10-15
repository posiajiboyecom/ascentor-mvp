// scripts/test-daily.ts
// Checks the Daily account from your own machine, using DAILY_API_KEY in .env.local.
//
//   npx tsx scripts/test-daily.ts
//
// It creates a private test room, makes a meeting token for it, then deletes the room. Nothing is left behind and nobody
// is billed (no one joins). It never prints the key.
import { config } from 'dotenv';

config({ path: '.env.local' });

const API = 'https://api.daily.co/v1';

async function daily(path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DAILY_API_KEY}`, ...(init.headers ?? {}) } });
}

async function main() {
  if (!process.env.DAILY_API_KEY) { console.error('DAILY_API_KEY is not set in .env.local.'); process.exit(1); }

  const name = `ascentor-test-${Date.now()}`;
  const mk = await daily('/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, privacy: 'private', properties: { max_participants: 12, enable_screenshare: false, start_video_off: true, enable_chat: false, enable_prejoin_ui: false, exp: Math.floor(Date.now() / 1000) + 600 } }),
  });
  const room = await mk.json().catch(() => ({}));
  if (!mk.ok) { console.error(`FAILED to create a room (${mk.status}):`, room?.info ?? room?.error ?? room); process.exit(1); }
  console.log(`OK  created private room ${room.name}`);

  const tk = await daily('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({ properties: { room_name: name, user_name: 'Test', is_owner: false, exp: Math.floor(Date.now() / 1000) + 300, permissions: { canSend: ['audio'] } } }),
  });
  const token = await tk.json().catch(() => ({}));
  console.log(tk.ok && token.token ? 'OK  created a meeting token that can send audio only' : `FAILED to create a token (${tk.status}): ${JSON.stringify(token).slice(0, 200)}`);

  const del = await daily(`/rooms/${name}`, { method: 'DELETE' });
  console.log(del.ok ? 'OK  deleted the test room' : `WARN could not delete the test room (${del.status}). It expires on its own in 10 minutes.`);

  console.log('Done. Calls are ready to use once the same key is set in Vercel.');
}

main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : e); process.exit(1); });
