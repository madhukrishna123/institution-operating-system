# Enterprise Social OS Implementation

## Feature-Agent Boundaries

The new home experience is split into feature-owned agents inside the same app:

- Shell Agent: global layout, dock, command bar, identity, and workspace pulse.
- Feed Agent: activity feed, composer, reactions, replies, and social signal cards.
- Workspace Agent: team/project workspace cards and active context switching.
- Copilot Agent: AI recommendation queue and draft/action capsules.
- Messaging Agent: live channel previews and unread states.
- Profile Agent: creator-style user identity, skills, badges, and stats.

## Backend APIs

The Social OS slice is powered by `/api/social/*` endpoints:

- `GET /api/social/home`
- `GET /api/social/feed`
- `POST /api/social/feed`
- `GET /api/social/workspaces`
- `GET /api/social/messages`
- `GET /api/social/profile`

Feed posts persist locally in SQLite through the `social_posts` table. Workspace, copilot, message, and profile surfaces are seeded backend payloads for the first local version.

## Current Scope

The root web route now opens the Enterprise Social OS shell. Legacy institution modules remain available in the codebase and can be reconnected as social workspace apps later.
