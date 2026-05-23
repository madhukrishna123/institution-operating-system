# ADR 0001: Use A Simple Open-Source Monorepo

## Status

Accepted

## Context

The product needs separate frontend, backend, AI agent runtime, infrastructure, and documentation. The PRD also requires an open-source-first architecture. The MVP should avoid too many packages and services before the product shape is proven.

## Decision

Use a simple monorepo with separate top-level folders for the web app, backend API, agent runtime, infrastructure, and documentation.

## Consequences

- Frontend and backend code stay physically separate.
- Local development can be started with one Docker Compose environment.
- Shared code is added only when there is real duplication.
- Module ownership must stay explicit.
