# Next-Generation Configurable OS Implementation

## What Changed

The app now behaves as a role-aware, metadata-driven institution operating system instead of a static dashboard.

Implemented foundations:

- Seeded local login for super admin, institution admin, teacher, student, parent, finance, and HR.
- Backend-generated role navigation through `/api/me/workspace`.
- Metadata-backed modules and fields for configurable module rendering.
- Configurable list/form surfaces in the frontend.
- Admin configuration builder for module visibility.
- Admin field editing for labels, visibility, required state, and order.
- Configured create forms for Students, Attendance, and Fees.
- Attendance-to-action workflow:
  - Teacher marks attendance.
  - Absent/late attendance creates an Academic Agent recommendation.
  - Admin approves or rejects the recommendation.
  - Approved work moves to `draft_created` with a parent communication draft.
- Approved attendance work creates student and parent notices.
- Centralized frontend API client using `NEXT_PUBLIC_API_BASE_URL`.

## Seeded Login Accounts

All seeded accounts use password `password`.

- `super@nova.local`
- `admin@nova.local`
- `teacher@nova.local`
- `student@nova.local`
- `parent@nova.local`
- `finance@nova.local`
- `hr@nova.local`

## Key APIs

- `GET /api/auth/seed-users`
- `POST /api/auth/login`
- `GET /api/me/workspace`
- `GET /api/config/modules`
- `POST /api/config/modules`
- `POST /api/config/modules/{module_key}/fields`
- `GET /api/config/workflows`
- `POST /api/config/workflows`
- `GET /api/modules/{module_key}/records`
- `POST /api/modules/{module_key}/records`
- `POST /api/attendance/mark`
- `GET /api/agent-work`
- `POST /api/agent-work/{id}/approve`
- `POST /api/agent-work/{id}/reject`
- `GET /api/notices`

## Current Local Storage

The frontend stores the seeded session in browser local storage under:

```text
ai_os_session
```

Use Logout in the UI to clear it.

## Next Build Targets

- Add role navigation editing to the Admin Builder.
- Add richer field types such as enum management, currency, relationship lookup, and multiline text.
- Add notice acknowledgement and message delivery status.
- Replace seeded local auth with Keycloak once the product shape stabilizes.
- Move from SQLite to PostgreSQL for production-like local deployments.
