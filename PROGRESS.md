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

### [Current Sprint - COMPLETED]

| Date | Agent | Task | Status | Notes |
|------|-------|------|--------|-------|
| 2025-01-14 | Mori | CLI + types | ✅ Merged | Initial scaffold |
| 2025-01-14 | Margo | State machine | ✅ Merged | Deterministic task lifecycle |
| 2025-01-14 | Margo | Pipeline orchestrator | ✅ Merged | Main loop structure |
| 2025-01-14 | Margo | Stage interfaces | ✅ Merged | Parse, decompose, clarify, execute |
| 2025-01-14 | Mori | LLM Client | ✅ Merged | Multi-provider with mock responses |
| 2025-01-14 | Mori | Cost Tracker | ✅ Merged | SQLite with budget alerts |
| 2025-01-14 | Mori | FileSystem Adapter | ✅ Merged | Frontmatter parsing, lock-based claiming |

### [Next Sprint]

| Date | Agent | Task | Status | Notes |
|------|-------|------|--------|-------|
| TBD | Mori | Provider SDK wiring | ⏳ Todo | Real API calls instead of mocks |
| TBD | Margo | Parse stage implementation | ⏳ Todo | Wire to LLMClient |
| TBD | Margo | Decompose stage implementation | ⏳ Todo | Wire to LLMClient |
| TBD | Margo | Clarify stage implementation | ⏳ Todo | Wire to LLMClient |
| TBD | Margo | Execute stage implementation | ⏳ Todo | Wire to LLMClient |
| TBD | Both | Integration test | ⏳ Todo | End-to-end with file-based goals |

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

### Phase 4: Pipeline Stage Implementations ⏳ NEXT
- [ ] Parse stage - wire to LLMClient
- [ ] Decompose stage - wire to LLMClient
- [ ] Clarify stage - wire to LLMClient
- [ ] Execute stage - wire to LLMClient

### Phase 5: Integration & Real APIs ⏳ NEXT
- [ ] Wire real LLM providers (Moonshot, MiniMax, Zhipu)
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
