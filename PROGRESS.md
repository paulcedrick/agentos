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

### [Current Sprint - IN PROGRESS]

| Date | Agent | Task | Status | Notes |
|------|-------|------|--------|-------|
| 2025-01-14 | Mori | CLI + types | ✅ Merged | Initial scaffold |
| 2025-01-14 | Margo | State machine | ✅ Merged | Deterministic task lifecycle |
| 2025-01-14 | Margo | Pipeline orchestrator | ✅ Merged | Main loop structure |
| 2025-01-14 | Mori | LLM Client + Cost Tracker | ✅ Merged | Real APIs, SQLite tracking |
| 2025-01-14 | Mori | FileSystem Adapter | ✅ Merged | Frontmatter, lock-based |
| 2025-01-14 | Margo | Stage implementations | 🔄 PR #5 | Parse, Decompose, Clarify, Execute |

### [Next Sprint]

| Date | Agent | Task | Status | Notes |
|------|-------|------|--------|-------|
| TBD | Mori | Review PR #5 | ⏳ Todo | Review stage implementations |
| TBD | Both | Integration test | ⏳ Todo | End-to-end with real goals |
| TBD | Both | Bug fixes | ⏳ Todo | Fix issues found in testing |

---

## Phase Progress

### Phase 1: Foundation ✅ COMPLETE
- [x] Core types and interfaces (Mori + Margo)
- [x] Configuration system (Mori)
- [x] Basic CLI (Mori)
- [x] State machine (Margo)
- [x] Pipeline orchestrator (Margo)
- [x] Stage interfaces (Margo)

### Phase 2: LLM Integration ✅ COMPLETE (v2 - real APIs)
- [x] LLM Client structure (Mori) - **real API wiring done**
- [x] Cost tracker (Mori)
- [x] OpenAI-compatible provider support (Moonshot, MiniMax, Zhipu)

### Phase 3: Adapters ✅ COMPLETE (v1 - filesystem)
- [x] Filesystem adapter (Mori)
- [ ] PXLabz adapter (future)
- [ ] Webhook adapter (future)

### Phase 4: Pipeline Stage Implementations ✅ COMPLETE
- [x] Parse stage - LLM-powered goal extraction with Zod
- [x] Decompose stage - LLM-powered task breakdown
- [x] Clarify stage - Blocking/non-blocking question detection
- [x] Execute stage - LLM task execution with model selection
- [x] Pipeline integration - All stages wired together

### Phase 5: Integration Testing ⏳ IN PROGRESS
- [ ] Mori reviews PR #5
- [ ] End-to-end test with file-based goals
- [ ] Budget alert webhooks
- [ ] Documentation

---

## Notes
- Each PR requires review from the other agent before merge
- Document decisions in ADRs
- Test coverage required before merge

## Interface Contract

### LLMClient (Mori provides)
```typescript
interface LLMClient {
  generate(
    stage: 'parse' | 'decompose' | 'clarify' | 'execute',
    prompt: string,
    options?: { schema?: object; modelAlias?: string }
  ): Promise<{ 
    text: string; 
    usage: { prompt: number; completion: number } 
  }>;
}
```

### Adapter (Mori provides - FileSystem)
```typescript
interface Adapter {
  fetchInputs(): Promise<string[]>;
  claim(inputId: string, agentId: string): Promise<boolean>;
  report(inputId: string, status: string, message: string): Promise<void>;
  notify(message: string): Promise<void>;
}
```

Mori: Please implement these interfaces so I can wire the pipeline.
