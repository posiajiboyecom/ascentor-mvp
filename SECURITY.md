# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Ascentor, please report it responsibly.

### How to Report

**Do NOT** open a public GitHub issue for security vulnerabilities.

Instead, please report security issues via email to:

**security@ascentorbi.com**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

### Response Timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Fix timeline**: Depends on severity

| Severity | Response | Fix Timeline |
|----------|----------|--------------|
| Critical | 24 hours | 7 days |
| High | 48 hours | 14 days |
| Medium | 7 days | 30 days |
| Low | 14 days | Next release |

---

## Security Measures

### Application Security

- **Row-Level Security (RLS)**: All database tables enforce RLS policies
- **Authentication**: Supabase Auth with OAuth 2.0 (Google, LinkedIn)
- **Session Management**: Encrypted HTTP-only cookies
- **Input Validation**: Server-side validation on all API endpoints
- **Rate Limiting**: Rate limits on authentication and API endpoints
- **Audit Logging**: Sensitive actions are logged with user ID and timestamp

### Data Protection

- **Encryption in Transit**: TLS 1.2+ on all connections
- **Encryption at Rest**: AES-256 encryption for stored data
- **Password Hashing**: bcrypt via Supabase Auth (never stored in plaintext)
- **API Keys**: Server-side only, never exposed to clients
- **PII Handling**: Minimal collection, purpose-limited usage

### Infrastructure Security

- **Hosting**: Vercel with automatic HTTPS
- **Database**: Supabase with automated backups
- **Edge Functions**: Serverless execution with minimal permissions
- **Dependencies**: Regular dependency audits and updates
- **Environment Variables**: Secrets managed via Vercel environment variables

### AI/ML Security

- **Prompt Injection Protection**: Input sanitization for AI coaching
- **Data Isolation**: User coaching data is isolated per user
- **No Model Training**: User conversations are not used to train AI models
- **Third-party Processing**: Anthropic API data handling per their privacy policy

---

## Security Best Practices for Contributors

1. **Never commit secrets** to the repository
2. **Validate all inputs** on the server side
3. **Use parameterized queries** to prevent SQL injection
4. **Sanitize user input** before rendering in HTML
5. **Follow the principle of least privilege** for database access
6. **Report security issues** via email, not public issues

---

## Security Audit History

| Date | Auditor | Scope | Result |
|------|---------|-------|--------|
| 2026-03-15 | Internal | Initial security review | Passed |
| 2026-06-20 | Internal | RLS policy audit | Passed |

---

## Contact

For security concerns: **security@ascentorbi.com**

For general support: **hello@ascentorbi.com**
