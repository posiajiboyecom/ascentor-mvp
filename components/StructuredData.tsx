// ============================================================
// STRUCTURED DATA COMPONENT
// Renders sitewide JSON-LD (Organization + founder + WebSite graph, SoftwareApplication)
// for rich search results. Rendered once in app/layout.tsx.
// Page-specific schema (Event, Article) lives in the page files.
// ============================================================

import {
  getOrganizationSchema,
  getSoftwareAppSchema,
} from '@/lib/seo';

export default function StructuredData() {
  const schemas = [getOrganizationSchema(), getSoftwareAppSchema()];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
