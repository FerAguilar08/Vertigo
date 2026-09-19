import { Redis } from '@upstash/redis';

const MAX_ENTRIES = 100;
const LB_KEY = 'vertigo:leaderboard';

// Works with either the Upstash integration (UPSTASH_REDIS_REST_*) or the
// legacy Vercel KV integration (KV_REST_API_*) — whichever the project has connected.
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = REST_URL && REST_TOKEN ? new Redis({ url: REST_URL, token: REST_TOKEN }) : null;

function parseEntry(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

export async function GET() {
  if (!redis) {
    return Response.json({ entries: [], configured: false });
  }
  const raw = await redis.hgetall(LB_KEY);
  const entries = Object.entries(raw || {})
    .map(([id, v]) => {
      const e = parseEntry(v);
      return e ? { id, ...e } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  return Response.json({ entries, configured: true });
}

export async function POST(request) {
  if (!redis) {
    return Response.json({ ok: false, configured: false });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !body.id) {
    return Response.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }

  const id = body.id.slice(0, 40);
  const name = String(body.name || 'Climber').slice(0, 14);
  const avatar = typeof body.avatar === 'string' ? body.avatar.slice(0, 8) : '🧗';
  const score = Math.max(0, Math.floor(Number(body.score) || 0));
  const floor = Math.max(0, Math.floor(Number(body.floor) || 0));

  const existing = parseEntry(await redis.hget(LB_KEY, id));
  if (existing && existing.score >= score) {
    return Response.json({ ok: true, updated: false });
  }

  const entry = { name, avatar, score, floor, ts: Date.now() };
  await redis.hset(LB_KEY, { [id]: JSON.stringify(entry) });
  return Response.json({ ok: true, updated: true });
}
