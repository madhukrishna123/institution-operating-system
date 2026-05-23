# ADR 0004: Use Keycloak For Identity

## Status

Accepted

## Context

The platform requires RBAC, MFA, tenant isolation, auditability, and future enterprise SSO support.

## Decision

Use Keycloak as the identity provider for authentication, MFA, role assignment, and token issuance. Application-level authorization will still be enforced in the backend using tenant, role, and permission context.

## Consequences

- Authentication is handled by a mature open-source identity system.
- Enterprise SSO can be added without replacing the auth foundation.
- Backend services must not trust frontend-only role checks.
- Tenant context must be validated server-side on every request.
