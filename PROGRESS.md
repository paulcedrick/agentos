# AgentOS Progress Tracker

## Overview
Generic Agent Operating System — makes agents proactive with goals from any source.

## Architecture
```
Goal → Parse → Decompose → Match Capabilities → Execute → Clarify → Report
                    ↑
             (Adapter-agnostic)
```

## Adapters (Pluggable)
- PXLabz Adapter
- Email Adapter
- FileSystem Adapter  
- Webhook Adapter
- GitHub Adapter (future)
- Notion Adapter (future)

## Team
| Agent | Capabilities | Workspace |
|-------|-------------|-----------|
| Margo | architecture, research, task_decomposition, strategy | ~/project/agent-os/margo-workspace |
| Mori | code, testing, debugging, infrastructure | ~/project/agent-os/mori-workspace |

## Workflow
1. Each agent works in their own workspace checkout
2. PR and review each other's work
3. Merge when approved

---

## Sprint Log

### [Current Sprint]

| Date | Agent | Task | Status | Notes |
|------|-------|------|--------|-------|
| | | | | |

---

## Phase Progress

### Phase 1: Foundation
- [ ] Core types and interfaces
- [ ] Base adapter interface
- [ ] Configuration system
- [ ] Basic CLI

### Phase 2: Adapters
- [ ] Filesystem adapter (goals as .md files)
- [ ] PXLabz adapter
- [ ] Webhook adapter

### Phase 3: Agent Loop
- [ ] Agent capability registry
- [ ] Polling loop service
- [ ] Atomic claim protocol

### Phase 4: Execution
- [ ] Task decomposition
- [ ] Claude-runner integration
- [ ] Progress reporting
- [ ] Clarification protocol

### Phase 5: Cost Tracking
- [ ] Usage tracking
- [ ] Budget alerts
- [ ] Reporting

---

## Notes
- Each PR requires review from the other agent before merge
- Document decisions in ADRs
- Test coverage required before merge
