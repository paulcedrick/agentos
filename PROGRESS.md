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
- FileSystem Adapter ✅
- Discord Adapter ✅
- PXLabz Adapter (future)
- Email Adapter (future)
- Webhook Adapter (future)
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
| 2025-01-14 | Mori | LLM Client + Cost Tracker | ✅ Merged | Real APIs, SQLite tracking |
| 2025-01-14 | Mori | FileSystem Adapter | ✅ Merged | Frontmatter, lock-based |
| 2025-01-14 | Margo | Stage implementations | ✅ Merged | Parse, Decompose, Clarify, Execute |
| 2025-01-14 | Margo | Multi-team support | ✅ Merged | Agent config, team routing |
| 2025-01-14 | Margo | Discord adapter | ✅ Merged | Posts tasks, mentions users |

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

### Phase 6: Multi-Team Support ✅ COMPLETE
- [x] Agent configuration (capabilities, teams, Discord IDs)
- [x] Team configuration (agents, goal directories)
- [x] Team-based file system routing
- [x] Agent capability matching in pipeline
- [x] AGENTOS_TEAM env var for team filtering

### Phase 8: Discord Integration ✅ COMPLETE
- [x] Discord adapter using discord.js
- [x] Post tasks to channel with @mentions
- [x] Create thread per task
- [x] Adapter switching via AGENTOS_ADAPTER env var
- [x] Config validation for bot token and channel ID

### Phase 9: Ready for Production Testing ⏳ NEXT
- [ ] Set API keys (MOONSHOT_API_KEY, MINIMAX_API_KEY, ZHIPU_API_KEY)
- [ ] Set Discord bot token
- [ ] Create test goal files for ice-cold team
- [ ] Create test goal files for fiery-warm team
- [ ] Run end-to-end with real LLM + Discord
- [ ] Bug fixes and polish

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
