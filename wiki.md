# Ascentor Wiki

## Table of Contents

1. [Platform Architecture](#platform-architecture)
2. [Core Features](#core-features)
3. [User Journeys](#user-journeys)
4. [The Total Person Framework](#the-total-person-framework)
5. [Sage AI Coach](#sage-ai-coach)
6. [The Circle Community](#the-circle-community)
7. [The Elevation Summit](#the-elevation-summit)
8. [Partner Program](#partner-program)
9. [Admin & Moderation](#admin--moderation)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Deployment Architecture](#deployment-architecture)

---

## Platform Architecture

Ascentor is built on a modern, scalable stack optimized for real-time coaching, community features, and content delivery.

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 16    │────▶│   Supabase      │────▶│   PostgreSQL    │
│   (App Router)  │     │   (Auth + DB)   │     │   + RLS         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel Edge   │     │   Anthropic     │     │   Paystack/     │
│   (CDN + SSR)   │     │   Claude API    │     │   Selar         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Architectural Decisions

1. **Server/Client Split**: Server components fetch CMS data and handle auth; client components manage interactivity
2. **Row-Level Security**: All database access is scoped to the authenticated user via RLS policies
3. **Edge-First**: Static pages are pre-rendered; dynamic content is fetched client-side or via server components
4. **Progressive Web App**: Installable on mobile with offline support via service workers

---

## Core Features

### 1. Sage AI Coach

Sage is an AI mentor built on Anthropic's Claude API. It provides structured coaching sessions across four types:

| Session Type | Purpose |
|-------------|---------|
| Navigate a Challenge | Work through a specific problem or decision |
| Prep a Conversation | Role-play and prepare for important conversations |
| Weekly Reflection | Review progress and set intentions |
| Accountability Check | Commit to actions and report back |

**Technical Notes:**
- Each session type uses a distinct system prompt
- Conversations are stored in Supabase for history and continuity
- Inputs are sent to Anthropic's Claude Sonnet model
- Coaching data is NOT used to train AI models

### 2. The Circle Community

Accountability Circles are small, curated peer groups for professional growth.

**Features:**
- Curated matching based on career stage and goals
- Daily check-ins and prompts
- Upvote and discussion system
- Expert-led sessions within circles
- Push notifications for engagement

**Moderation:**
- Community Guidelines enforced via RLS
- Reporting system for harmful content
- Admin moderation tools

### 3. The Elevation Summit

The annual flagship event of the Ascentor movement.

**2026 Summit:**
- Date: 19 November, 2026
- Location: Lagos, Nigeria
- Theme: "The Rise We Choose. The Elevation Story."
- Tracks: Leadership, Legacy, Community, Vocation

**Platform Integration:**
- Registration via `/elevation-summit#register`
- Speaker applications via `/elevation-summit#speak`
- Partner/sponsorship via `/elevation-summit#partner`

### 4. Learning Library

Expert-led courses and content for continuous development.

**Content Types:**
- Video courses with progress tracking
- downloadable resources (salary scripts, promotion playbook)
- Expert session recordings
- Reading lists and frameworks

**Access Control:**
- Free tier: limited access
- Pro tier: full library access
- Premium tier: exclusive content + coaching

---

## User Journeys

### New User Journey

```
Landing Page → Sign Up → Onboarding → Dashboard
                                    ├── Sage AI Coach
                                    ├── The Circle
                                    ├── Learning Library
                                    └── Expert Sessions
```

### Partner Journey

```
Partner Application → Review → Onboarding
                                    ├── Brand Customization
                                    ├── Member Management
                                    ├── Revenue Dashboard
                                    └── Event Management
```

### Admin Journey

```
Admin Login → Dashboard
                    ├── User Management
                    ├── Content Management
                    ├── Coaching Oversight
                    ├── Community Moderation
                    └── Partner Management
```

---

## The Total Person Framework

Ascentor is built around six dimensions of human development:

```
┌─────────────────────────────────────────────────────────────┐
│                    THE TOTAL PERSON                          │
├────────────┬────────────┬────────────┬────────────┬────────────┬────────────┤
│    MIND    │ CHARACTER  │ VOCATION   │RELATIONSHIPS│ COMMUNITY  │  LEGACY   │
│            │            │            │              │            │           │
│ Think      │ Live       │ Work       │ Lead         │ Build      │ What       │
│independently│principled │purposefully│others        │beyond self │remains     │
│critically  │whole       │impact      │as partner,   │civic       │when you're │
│            │            │            │parent, friend│duty        │gone        │
└────────────┴────────────┴────────────┴────────────┴────────────┴────────────┘
```

Every feature, conversation, and resource is oriented toward developing all six dimensions.

---

## Sage AI Coach

### System Architecture

```
User Input → Supabase → Next.js API → Anthropic Claude
                                                    │
                                                    ▼
                                          Structured Response
                                                    │
                                                    ▼
                                          Supabase Storage
                                                    │
                                                    ▼
                                          User Session History
```

### Session Types

Each session type has a unique system prompt designed to produce structured, actionable outputs:

1. **Navigate a Challenge**
   - Problem framing
   - Option generation
   - Decision framework

2. **Prep a Conversation**
   - Scenario analysis
   - Key messages
   - Objection handling

3. **Weekly Reflection**
   - Wins and lessons
   - Alignment check
   - Next week priorities

4. **Accountability Check**
   - Commitment review
   - Progress assessment
   - Course correction

---

## The Circle Community

### Circle Structure

```
Circle (8-12 members)
├── Daily Check-in Prompt
├── Member Posts & Replies
├── Upvote System
├── Expert Sessions
└── Notifications
```

### Engagement Mechanics

- **Daily Prompts**: AI-generated questions to spark reflection
- **Check-ins**: Members share progress and challenges
- **Upvotes**: Community-driven content prioritization
- **Expert Sessions**: Scheduled live sessions with mentors

---

## The Elevation Summit

### Event Structure

| Component | Description |
|-----------|-------------|
| Main Stage | Keynotes from global leaders |
| Breakout Sessions | Track-specific deep dives |
| Circle Experience | Community connection activities |
| Legacy Lab | Hands-on impact projects |
| Elevation Ceremony | Recognition and commitment |

### Platform Features

- Registration and ticketing
- Speaker submission system
- Partner/sponsor portal
- Event schedule builder
- Post-event content library

---

## Partner Program

### Partner Tiers

| Tier | Features |
|------|----------|
| Community Partner | Basic brand presence, member referral |
| Summit Partner | Event branding, speaking opportunities |
| Platform Partner | Custom subdomain, branded experience |

### Partner Dashboard Features

- White-label brand customization
- Member management and analytics
- Revenue tracking and payouts
- Event creation and management
- Marketing asset library

---

## Admin & Moderation

### Admin Roles

| Role | Permissions |
|------|-------------|
| Super Admin | Full platform access |
| Content Admin | CMS, blog, events |
| Community Admin | Moderation, circles |
| Partner Admin | Partner management |
| Finance Admin | Payments, subscriptions |

### Moderation Tools

- Content reporting system
- User suspension/banning
- Circle moderation
- Automated content filtering
- Audit logging

---

## API Reference

### Key API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/welcome` | POST | Send welcome emails |
| `/api/waitlist` | POST | Join waitlist |
| `/api/events/list` | GET | Fetch public events |
| `/api/experts/register` | POST | Expert application |
| `/api/careers` | GET | Career opportunities |
| `/api/newsletter` | POST | Newsletter signup |
| `/api/usage/check` | GET | Usage limit checking |
| `/api/pay/webhook` | POST | Paystack webhook handler |

---

## Database Schema

### Core Tables

```sql
-- User profiles
profiles (id, email, full_name, role, onboarding_completed, ...)

-- Blog content
blog_posts (id, title, slug, content, is_published, ...)

-- Events
events (id, title, slug, event_date, location, ...)

-- Coaching sessions
coaching_sessions (id, user_id, session_type, input, response, ...)

-- Community content
community_posts (id, user_id, circle_id, content, ...)

-- Newsletter
newsletter_subscribers (email, is_active, source, ...)
```

### Row-Level Security

All tables have RLS policies ensuring users can only access their own data or publicly accessible content.

---

## Deployment Architecture

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | localhost:3000 | Local development |
| Staging | staging.ascentorbi.com | Pre-production testing |
| Production | ascentorbi.com | Live platform |

### CI/CD Pipeline

```
Push to main → Vercel Preview → E2E Tests → Production Deploy
Push to feature → Vercel Preview → Automated Tests → PR Check
```

### Monitoring

- Vercel Analytics for performance
- Sentry for error tracking
- Supabase Logs for database queries
- Custom audit logs for sensitive actions
