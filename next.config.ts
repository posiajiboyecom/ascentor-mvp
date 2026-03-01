import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep web-push on the server only — it uses Node.js built-ins
  // that don't exist in the browser and will crash client-side.
  serverExternalPackages: ['web-push'],
};

export default nextConfig;
