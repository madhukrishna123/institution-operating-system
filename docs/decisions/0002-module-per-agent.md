# ADR 0002: Keep One Agent Boundary Per Major Module

## Status

Accepted

## Context

The PRD names Academic, Finance, HR, Parent Communication, Compliance, and Analytics agents. The system also needs ERP modules that map naturally to those domains.

## Decision

Each major module will have its own UI area, backend folder, and AI agent file. These are module boundaries inside one app, not separate microservices. Agents will not change data directly. They will use permission-checked backend tools.

## Consequences

- Each agent can evolve without splitting the system into many services.
- Agent behavior stays aligned with business module permissions.
- Cross-module workflows can start as normal backend function calls.
- Events and queues can be added later when scale requires them.
