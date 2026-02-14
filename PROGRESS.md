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
| Margo | architecture, research, task_decomposition, strategy | ~/project/agentos/margo-workspace |
| Mori | code, testing, debugging, infrastructure | ~/project/agentos/mori-workspace |

## Workflow (Parallel Checkouts)

### Setup
```bash
# Margo's workspace
cd ~/project/agentos/margo-workspace

# Mori's workspace  
cd ~/project/agentos/mori-workspace
```

### Branch Strategy
1. Create feature branch from main in your workspace
2. Work independently in your checkout
3. Push branch to origin
4. Create PR from your branch
5. Other person reviews using GitHub
6. Merge when approved

### Example
```bash
# Margo working on pipeline
cd ~/project/agentos/margo-workspace
git checkout -b margo/pipeline-orchestrator
# ... work ...
git push origin margo/pipeline-orchestrator
# Create PR on GitHub

# Mori reviews in her workspace
cd ~/project/agentos/mori-workspace
git fetch origin
git checkout margo/pipeline-orchestrator
# Review, comment on PR
```

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
