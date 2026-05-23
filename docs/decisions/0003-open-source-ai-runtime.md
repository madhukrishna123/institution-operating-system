# ADR 0003: Use Open-Source AI Runtime Components

## Status

Accepted

## Context

The PRD requires open-source technology, local AI deployment capability, and support for agentic workflows.

## Decision

Use LangGraph for agent workflow orchestration, Ollama for local model serving, and open-source model families such as Llama, Qwen, and DeepSeek. Add vLLM later only when production traffic requires it.

## Consequences

- Institutions can deploy locally without relying on closed model APIs.
- Model selection can vary by language, cost, hardware, and latency.
- The MVP must include prompt files, retrieval scoping, and AI audit logs.
- Advanced model routing is deferred.
