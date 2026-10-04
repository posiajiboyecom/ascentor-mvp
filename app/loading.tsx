// Intentionally empty - the site preloader lives in app/layout.tsx.
// A loading.tsx copy would render as a Suspense fallback that never
// hydrates, leaving a frozen 0% bar behind the real preloader.
export default function Loading() {
  return null;
}
