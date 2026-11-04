# LostAndFound — Cloudflare Pages + D1

This update keeps the existing D1 database and its four tables (`Users`, `Categories`, `Items`, `Claims`). It does not include schema migrations or destructive SQL.

## Files
- Static pages: `index.html`, `register.html`, `login.html`, `report.html`, `dashboard.html`
- Styling and browser code: `style.css`, `app.js`
- Cloudflare Pages Functions: `functions/api/*.js`

## Required Cloudflare setting
Create a Pages secret named `SESSION_SECRET` with a randomly generated value of at least 32 characters. Do not put it in source code or commit it to GitHub.

Cloudflare Dashboard → Workers & Pages → lostandfound → Settings → Variables and Secrets → Add → Secret.

Keep the existing `wrangler.jsonc` D1 binding exactly as it is (`DB` → `lostandfound-db`). Do not recreate the database.

## Existing user passwords
The current `Users.password` values may have been stored as plain text by an earlier version. This code verifies the PBKDF2 format only. Existing users with old-format passwords should use a password-reset flow before production use; do not delete or overwrite their records. New registrations store PBKDF2-SHA-256 hashes.

## API routes
- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/categories`
- `GET /api/items`
- `POST /api/items`
- `POST /api/claims`
- `PATCH /api/claims`
- `GET /api/dashboard`

## Before public launch
1. Set `SESSION_SECRET`.
2. Confirm the D1 binding in `wrangler.jsonc` is unchanged.
3. Test registration with a new email, login, posting, claim submission and claim approval.
4. Review privacy/contact details and add moderation/report-abuse controls before opening the service publicly.

No database table is created, altered, or deleted by this package.
