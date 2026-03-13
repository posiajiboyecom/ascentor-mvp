// app/p/[subdomain]/admin/brand/page.tsx
// Re-exports the canonical partner admin page.
// No logic changes — the page components are route-agnostic
// (they fetch via /api/partner/* which is domain-independent).
export { default } from '@/app/partner/brand/page';
