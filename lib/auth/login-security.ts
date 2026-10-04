// lib/auth/login-security.ts
// Server-side impossible-travel check. It runs inside the login route and the
// OAuth callback - the server decides, so it cannot be skipped by a modified
// client (the old flow depended on the browser calling /api/auth/security-check).
//
// Behaviour:
//   * fail OPEN on any lookup error (our outage must not lock people out)
//   * a blocked attempt is recorded; the CALLER signs out the current session
//     only (never every device), so a false positive on a VPN is recoverable
//   * IP comes from x-vercel-forwarded-for (platform-set) via getClientIp
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getClientIp } from '@/lib/rate-limit';
import { checkImpossibleTravel, type SessionLocation } from '@/lib/security-location';

export interface LoginAssessment {
  allowed: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  message?: string;
}

const BLOCK_MESSAGE =
  'For your security we blocked this sign-in because it looks like it came from an unusual location. ' +
  'Please try again in a few minutes, or contact support if this keeps happening.';

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|0\.0\.0\.0)/i;

async function geolocate(ip: string): Promise<{ country: string; city: string; lat: number; lon: number } | null> {
  if (!ip || PRIVATE_IP.test(ip)) return { country: 'Local', city: 'Localhost', lat: 0, lon: 0 };
  try {
    // HTTPS provider (the previous one was plain-HTTP). Free tier; fail open on any problem.
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,city,latitude,longitude`, {
      signal: AbortSignal.timeout(2500),
    });
    const data = await res.json();
    if (data?.success === false || typeof data?.latitude !== 'number') return null;
    return { country: data.country ?? '', city: data.city ?? '', lat: data.latitude, lon: data.longitude };
  } catch {
    return null;
  }
}

export async function assessLogin(userId: string, req: Request): Promise<LoginAssessment> {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const geo = await geolocate(ip);

    if (!geo) {
      await record(userId, ip, 'Unknown', 'Unknown', 0, 0, userAgent, 'low', false);
      return { allowed: true, riskLevel: 'low' };
    }

    const current: SessionLocation = {
      ip, country: geo.country, city: geo.city, lat: geo.lat, lon: geo.lon,
      timestamp: Date.now(), user_agent: userAgent,
    };

    const { data: last } = await supabaseAdmin
      .from('session_locations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    let result: { allowed: boolean; risk_level: LoginAssessment['riskLevel']; reason?: string; details?: string } =
      { allowed: true, risk_level: 'low' };

    if (last && last.length > 0) {
      const l = last[0];
      // A local/unknown previous point has no meaningful coordinates: skip the travel maths.
      if (l.country && l.country !== 'Local' && l.country !== 'Unknown' && geo.country !== 'Local') {
        result = checkImpossibleTravel(current, {
          ip: l.ip_address, country: l.country || '', city: l.city || '',
          lat: l.latitude || 0, lon: l.longitude || 0,
          timestamp: new Date(l.created_at).getTime(), user_agent: l.user_agent || '',
        });
      }
    }

    await record(userId, ip, geo.country, geo.city, geo.lat, geo.lon, userAgent, result.risk_level, !result.allowed);

    if (!result.allowed) {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'login_blocked',
          entity_type: 'security',
          entity_id: userId,
          details: { reason: result.reason, description: result.details, ip, location: `${geo.city}, ${geo.country}` },
        });
      } catch { /* non-critical */ }
      return { allowed: false, riskLevel: result.risk_level, message: BLOCK_MESSAGE };
    }
    return { allowed: true, riskLevel: result.risk_level };
  } catch (err) {
    console.error('[login-security] assessment failed (allowing):', err);
    return { allowed: true, riskLevel: 'low' };
  }
}

async function record(
  userId: string, ip: string, country: string, city: string, lat: number, lon: number,
  userAgent: string, riskLevel: string, blocked: boolean,
) {
  try {
    await supabaseAdmin.from('session_locations').insert({
      user_id: userId, ip_address: ip, country, city, latitude: lat, longitude: lon,
      user_agent: userAgent, risk_level: riskLevel, blocked,
    });
  } catch (err) {
    console.error('[login-security] could not record session location:', err);
  }
}
