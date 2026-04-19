// ═══════════════════════════════════════════════════════════
// Remotion project config — applies to both local Studio and
// server-side renders. Server-side overrides in the Trigger
// task take precedence over these defaults.
// ═══════════════════════════════════════════════════════════
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');

// CRF — lower is better quality, larger file. 22 is visually transparent.
Config.setCrf(22);

// Chromium flags for Linux containers (like Trigger.dev):
// - no-sandbox is required when running as root in a container
// - disable-gpu avoids swiftshader warnings when no GPU is present
Config.setChromiumOpenGlRenderer('swangle');
