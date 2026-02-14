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
| 2025-01-14 | Mori | CLI + types | ✅ Merged | Initial scaffold |
| 2025-01-14 | Margo | State machine | 🔄 PR | Deterministic task lifecycle |
| 2025-01-14 | Margo | Pipeline orchestrator | 🔄 PR | Main loop structure |
| 2025-01-14 | Margo | Stage interfaces | 🔄 PR | Parse, decompose, clarify, execute |
| 2025-01-14 | Mori | LLM Client | ⏳ Todo | Needs: 3 providers, cost tracker, filesystem adapter |

---

## Phase Progress

### Phase 1: Foundation
- [x] Core types and interfaces (Mori + Margo)
- [x] Base adapter interface (in types)
- [x] Configuration system (Mori)
- [x] Basic CLI (Mori)
- [x] State machine (Margo - in review)
- [x] Pipeline orchestrator (Margo - in review)
- [x] Stage interfaces (Margo - in review)

### Phase 2: LLM Integration (Mori)
- [ ] LLM Client with 3 providers (Moonshot, MiniMax, Zhipu)
- [ ] Cost tracker (SQLite)
- [ ] Fallback mechanism

### Phase 3: Adapters (Mori)
- [ ] Filesystem adapter (goals as .md files)
- [ ] PXLabz adapter (future)
- [ ] Webhook adapter (future)

### Phase 4: Pipeline Stages (Margo - pending Mori's LLMClient)
- [ ] Parse stage implementation
- [ ] Decompose stage implementation  
- [ ] Clarify stage implementation
- [ ] Execute stage implementation

### Phase 5: Integration
- [ ] Wire pipeline to LLMClient
- [ ] Wire adapter to pipeline
- [ ] End-to-end test

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
