// ============================================================
// FEATURE #6: API Route — /api/auth/security-check
// Called after successful authentication to validate location.
// Headers: x-forwarded-for (IP from Vercel)
//
// BUG FIX (Bug 3): The original route accepted userId from the POST body
// with no session verification. Combined with the broad '/api/auth' entry
// in proxy.ts PUBLIC_API_ROUTES (now fixed), any unauthenticated caller
// could POST { userId: "<victim-uuid>" } and trigger a global sign-out
// for any user on the platform.
//
// Fix: userId is now taken exclusively from the authenticated session via
// supabase.auth.getUser(). The body is no longer trusted for identity.
// The route also now correctly returns 401 if called without a valid session,
// consistent with all other protected API routes.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { checkImpossibleTravel, type SessionLocation } from '@/lib/security-location';

// Service-role client for writes (audit_logs, session_locations, admin signOut)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Free IP geolocation API (no key required, 45 req/min)
async function getGeoFromIP(ip: string): Promise<{
  country: string; city: string; lat: number; lon: number;
} | null> {
  try {
    // Skip for localhost/private IPs
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
      return { country: 'Local', city: 'Localhost', lat: 0, lon: 0 };
    }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,lat,lon,status`);
    const data = await res.json();
    if (data.status === 'success') {
      return { country: data.country, city: data.city, lat: data.lat, lon: data.lon };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. AUTHENTICATE SESSION FIRST ──────────────────────────────
    // BUG FIX (Bug 3): Never trust userId from the request body.
    // The original code read `const { userId } = await req.json()` and used
    // it directly to call supabase.auth.admin.signOut(userId, 'global'),
    // creating a global-logout weapon for unauthenticated callers.
    // Session is the sole source of truth for identity.
    const authClient = await createServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id; // session-derived — never from body

    // Get IP from Vercel headers
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '0.0.0.0';

    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Get geolocation for current IP
    const geo = await getGeoFromIP(ip);
    if (!geo) {
      // Can't determine location — allow but log
      await recordSession(userId, ip, 'Unknown', 'Unknown', 0, 0, userAgent, 'low', false);
      return NextResponse.json({ allowed: true, risk_level: 'low' });
    }

    const newLocation: SessionLocation = {
      ip,
      country: geo.country,
      city: geo.city,
      lat: geo.lat,
      lon: geo.lon,
      timestamp: Date.now(),
      user_agent: userAgent,
    };

    // Fetch last known session location for this user
    const { data: lastSessions } = await supabase
      .from('session_locations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    let result: { allowed: boolean; risk_level: 'low' | 'medium' | 'high' | 'critical'; reason?: string; details?: string } = { allowed: true, risk_level: 'low' };

    if (lastSessions && lastSessions.length > 0) {
      const last = lastSessions[0];
      const lastLocation: SessionLocation = {
        ip: last.ip_address,
        country: last.country || '',
        city: last.city || '',
        lat: last.latitude || 0,
        lon: last.longitude || 0,
        timestamp: new Date(last.created_at).getTime(),
        user_agent: last.user_agent || '',
      };

      result = checkImpossibleTravel(newLocation, lastLocation);
    }

    // Record this session
    await recordSession(
      userId, ip, geo.country, geo.city, geo.lat, geo.lon,
      userAgent, result.risk_level, !result.allowed
    );

    // If blocked, also log to audit_logs
    if (!result.allowed) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'login_blocked',
          entity_type: 'security',
          entity_id: userId,
          details: {
            reason: result.reason,
            description: result.details,
            ip,
            location: `${geo.city}, ${geo.country}`,
          },
        });
      } catch {} // Non-critical

      // Sign out all sessions for this user (security measure)
      try { await supabase.auth.admin.signOut(userId, 'global'); } catch {}
    }

    return NextResponse.json({
      allowed: result.allowed,
      risk_level: result.risk_level,
      reason: result.reason,
      message: result.allowed
        ? undefined
        : 'Login blocked: suspicious location detected. All sessions have been signed out for your security. Please try again or contact support.',
    });
  } catch (err: any) {
    console.error('Security check error:', err);
    // On error, allow login (don't block users due to our own failures)
    return NextResponse.json({ allowed: true, risk_level: 'low' });
  }
}

async function recordSession(
  userId: string, ip: string, country: string, city: string,
  lat: number, lon: number, userAgent: string, riskLevel: string, blocked: boolean
) {
  try {
    await supabase.from('session_locations').insert({
      user_id: userId,
      ip_address: ip,
      country,
      city,
      latitude: lat,
      longitude: lon,
      user_agent: userAgent,
      risk_level: riskLevel,
      blocked,
    });
  } catch (err) {
    console.error('Failed to record session location:', err);
  }
}
