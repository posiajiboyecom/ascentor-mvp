// ============================================================
// STRUCTURED DATA COMPONENT
// Renders JSON-LD schema in <head> for rich search results.
// Usage: <StructuredData /> in app/layout.tsx
// ============================================================

import { getOrganizationSchema, getSoftwareAppSchema } from '@/lib/seo';

export default function StructuredData() {
  const orgSchema = getOrganizationSchema();
  const appSchema = getSoftwareAppSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />
    </>
  );
}
