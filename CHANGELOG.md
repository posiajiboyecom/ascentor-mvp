# Changelog

All notable changes to the Ascentor platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Hero section image carousel with auto-rotation and dot navigation
- Terms & Conditions page (`/terms`)
- Privacy Policy page (`/privacy`)
- Mobile header CTA button
- Social media icon links in footer with hover effects
- Documentation: README.md, wiki.md, security.md, contributing.md

### Changed
- Mobile off-canvas menu z-index increased to appear above navigation bar
- Footer layout restructured: social links moved under logo as icon buttons
- Footer bottom now shows copyright + legal links instead of quote + social texts

### Fixed
- Off-canvas menu appearing behind navigation bar on mobile

---

## [0.1.0] - 2026-09-09

### Added
- Initial project setup with Next.js 16 and TypeScript
- Supabase integration with PostgreSQL and RLS
- Authentication system (email/password + Google/LinkedIn OAuth)
- Landing page with CMS-backed hero section
- Marketing pages: Movement, Elevation Summit, Who It's For, About, Contact
- Blog system with admin CMS
- User dashboard with stats and quick actions
- Sage AI coaching integration (Anthropic Claude)
- The Circle community features
- Expert session management
- Partner portal with white-label capabilities
- Admin dashboard with role-based access
- Newsletter subscription system
- Event management system
- Payment integration (Paystack, Selar)
- Push notifications
- PWA support with Capacitor
- Mobile-responsive navigation and bottom tab bar
- Dark/light theme support
- SEO optimization with sitemap and robots.txt
- Security: RLS policies, audit logging, rate limiting

### Security
- Row-Level Security on all database tables
- Encrypted session management
- Server-side API validation
- Rate limiting on sensitive endpoints
- Audit logging for sensitive actions

---

## Versioning

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality in a backward-compatible manner
- **PATCH**: Backward-compatible bug fixes

## Release Process

1. Update this CHANGELOG.md with new version and changes
2. Update version numbers in package.json
3. Create a git tag: `git tag v0.x.x`
4. Push tag: `git push origin v0.x.x`
5. Deploy to production via Vercel
