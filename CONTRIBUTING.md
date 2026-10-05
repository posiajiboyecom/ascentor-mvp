# Contributing to Ascentor

Thank you for your interest in contributing to Ascentor. This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept responsibility and apologize for mistakes

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots or logs if applicable
   - Environment details (OS, browser, version)

### Suggesting Features

1. Check existing issues and discussions
2. Create a new issue with:
   - Clear problem statement
   - Proposed solution
   - Alternative solutions considered
   - Impact assessment

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the quality gates (see README section 12): `npm run typecheck`, `npm run lint:copy`, `npm run check:contracts`, `npm run test:auth:unit`
5. Ensure linting passes (`npm run lint`)
6. Commit with a clear message (`git commit -m 'Add amazing feature'`)
7. Push to your fork (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/ascentor-mvp.git
cd ascentor-mvp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev
```

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Prefer interfaces over types for object shapes
- Use strict mode (`strict: true` in tsconfig)

### React/Next.js

- Use functional components with hooks
- Follow the existing component patterns
- Use `'use client'` directive for client components
- Keep server components server-side when possible

### Styling

- Use Tailwind CSS for utility classes
- Use CSS Modules for component-scoped styles
- Follow the existing color and spacing tokens
- Ensure mobile responsiveness

### File Naming

- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Pages: `page.tsx` (App Router convention)

## Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(hero): add image carousel with dot navigation
fix(header): increase mobile off-canvas z-index
docs(readme): add project architecture section
```

## Review Process

1. All PRs require at least one review
2. CI checks must pass (lint, typecheck, build)
3. Changes must align with project goals
4. Documentation must be updated for feature changes

## Questions?

- Open a [Discussion](https://github.com/ascentor/ascentor-mvp/discussions)
- Reach out via email: **hello@ascentorbi.com**

## Project conventions

- No em dashes and no emoji in source or documentation. Use commas, colons or hyphens, and lucide icons.
- Every API route that reads a body uses `parseJson` with a strict schema from `lib/validation/schemas`, registered in
  `lib/validation/registry.ts`. Run `npm run docs:api` after changing a schema.
- Never redirect to a user-supplied path without `safeNext()`; never take identity from a request body.
- Light theme only; the navigation sidebar is dark by design. Use `--app-*` tokens, not hard-coded colours.
- Branch from `feat/platform-v1`. `main` is production and is not merged until the launch decision.
