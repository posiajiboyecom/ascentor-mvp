// ── Module declarations for packages without @types ──────────
// @ffprobe-installer/ffprobe ships no .d.ts file.
// @ffmpeg-installer/ffmpeg ships types but we declare both here
// for safety so TypeScript never complains about either.

declare module '@ffprobe-installer/ffprobe' {
  const path: string;
  const version: string;
  export { path, version };
  export default { path, version };
}

declare module '@ffmpeg-installer/ffmpeg' {
  const path: string;
  const version: string;
  export { path, version };
  export default { path, version };
}
