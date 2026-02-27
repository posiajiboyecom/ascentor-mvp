// ============================================================
// FEATURE #6: Location-Based Security
// Detects impossible travel (signing in from distant locations
// within a short time window). Uses IP geolocation.
// ============================================================

// --- Types ---
export interface SessionLocation {
  ip: string;
  country: string;
  city: string;
  lat: number;
  lon: number;
  timestamp: number; // Unix ms
  user_agent: string;
}

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

// --- Constants ---
const MAX_TRAVEL_SPEED_KMH = 1200; // Fastest commercial flight ~1100 km/h + buffer
const SUSPICIOUS_SPEED_KMH = 800;  // Flagged but not blocked
const MIN_TIME_BETWEEN_LOGINS_MS = 60_000; // 1 minute minimum

/**
 * Calculate distance between two lat/lon points using Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a new login location is suspicious compared to the last known session.
 */
export function checkImpossibleTravel(
  newLocation: SessionLocation,
  lastLocation: SessionLocation
): SecurityCheckResult {
  // Same IP — same location, always OK
  if (newLocation.ip === lastLocation.ip) {
    return { allowed: true, risk_level: 'low' };
  }

  const distanceKm = haversineDistance(
    lastLocation.lat, lastLocation.lon,
    newLocation.lat, newLocation.lon
  );

  const timeDiffMs = newLocation.timestamp - lastLocation.timestamp;
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

  // Too fast to check (back-to-back requests)
  if (timeDiffMs < MIN_TIME_BETWEEN_LOGINS_MS) {
    // If different country, suspicious
    if (newLocation.country !== lastLocation.country) {
      return {
        allowed: false,
        risk_level: 'critical',
        reason: 'concurrent_different_country',
        details: `Login from ${newLocation.city}, ${newLocation.country} while active session in ${lastLocation.city}, ${lastLocation.country} — less than 1 minute apart.`,
      };
    }
    return { allowed: true, risk_level: 'low' };
  }

  // Calculate implied travel speed
  const impliedSpeedKmh = timeDiffHours > 0 ? distanceKm / timeDiffHours : Infinity;

  // Same country, reasonable distance — OK
  if (newLocation.country === lastLocation.country && distanceKm < 500) {
    return { allowed: true, risk_level: 'low' };
  }

  // Impossible travel speed
  if (impliedSpeedKmh > MAX_TRAVEL_SPEED_KMH) {
    return {
      allowed: false,
      risk_level: 'critical',
      reason: 'impossible_travel',
      details: `${Math.round(distanceKm)} km in ${formatDuration(timeDiffMs)} (implied speed: ${Math.round(impliedSpeedKmh)} km/h). From ${lastLocation.city}, ${lastLocation.country} → ${newLocation.city}, ${newLocation.country}.`,
    };
  }

  // Suspicious but possible (fast international travel)
  if (impliedSpeedKmh > SUSPICIOUS_SPEED_KMH) {
    return {
      allowed: true,
      risk_level: 'medium',
      reason: 'fast_travel',
      details: `${Math.round(distanceKm)} km in ${formatDuration(timeDiffMs)}. Monitoring.`,
    };
  }

  return { allowed: true, risk_level: 'low' };
}

/**
 * Format milliseconds into human-readable duration.
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// --- SQL: session_locations table ---
export const SESSION_LOCATIONS_SQL = `
-- Table to track login locations for impossible travel detection
CREATE TABLE IF NOT EXISTS session_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ip_address text NOT NULL,
  country text,
  city text,
  latitude double precision,
  longitude double precision,
  user_agent text,
  risk_level text DEFAULT 'low',
  blocked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_session_locations_user_id 
  ON session_locations(user_id, created_at DESC);

-- RLS
ALTER TABLE session_locations ENABLE ROW LEVEL SECURITY;

-- Users can read their own session locations
CREATE POLICY "Users can view own session locations" ON session_locations
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert (from API route)
CREATE POLICY "Service role can insert session locations" ON session_locations
  FOR INSERT WITH CHECK (true);

-- Admins can read all
CREATE POLICY "Admins can view all session locations" ON session_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
`;
