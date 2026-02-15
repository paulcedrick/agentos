# AgentOS

Agent Operating System - Infrastructure for autonomous AI agents.

## What is AgentOS?

AgentOS makes AI agents **proactive** instead of reactive. Give agents goals, and they self-organize to achieve them.

### Key Features

- **Goal-Driven**: Agents work toward high-level goals, not individual tasks
- **Self-Organizing**: Agents claim work based on capabilities
- **Multi-Model**: Use different LLMs for different stages (cost optimization)
- **Pluggable Adapters**: Works with any task source (PXLabz, Linear, Email, Files)
- **Cost Tracking**: Monitor and budget LLM usage

## Quick Start

```bash
# Clone and setup
git clone https://github.com/paulcedrick/agentos.git
cd agentos
bun install

# Configure
cp config/agentos.example.json config/agentos.json
# Edit config/agentos.json with your API keys

# Run
bun run start
```

## Configuration

See `config/agentos.example.json` for full configuration options.

## Architecture

```
Goal → Parse → Clarify → Decompose → Execute (dependency-aware) → Report
       ↑         ↑          ↑                ↑
    MiniMax   Kimi K2    Kimi K2         byType/default
```

## Quality Gates

```bash
bun run test
bun run typecheck
bun run build
```

## Development

### Parallel Work Setup

This repo supports parallel development by Margo and Mori:

```bash
# Margo's workspace
git clone https://github.com/paulcedrick/agentos.git margo-workspace

# Mori's workspace
git clone https://github.com/paulcedrick/agentos.git mori-workspace
```

### Workflow

1. Create feature branch from `main`
2. Work in your workspace
3. Push branch to origin
4. Create PR for review
5. Other person reviews
6. Merge when approved

## License

TBD

## Team

- Kyu - Product direction
- Margo - Architecture, orchestration
- Mori - Implementation, execution
