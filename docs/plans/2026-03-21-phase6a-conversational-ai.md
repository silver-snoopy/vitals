# Phase 6A: Conversational AI Health Assistant with Tool Use

**Date:** 2026-03-21
**Status:** Planned
**Depends on:** Phase 5 (complete)

## Context

Vitals' AI is currently a batch weekly report generator — no conversation, no real-time queries, no tool use. The competitor analysis identifies cross-domain intelligence as the biggest unsolved problem in health tracking. The key architectural insight: the existing query layer (`db/queries/*.ts`) already provides the exact functions an LLM needs — we're exposing them as tool-use functions, not building new data access.

**Scope:** Conversational AI with tool use + dedicated `/chat` page. iOS app deferred to a future phase (Expo + HealthKit direction noted).

**Outcome:** Users can ask natural language questions ("How has my protein intake compared to last week?", "What's my weight trend this month?") and the AI queries their personal database, computes answers, and responds with cited data — transparently showing what it queried.

---

## Step 1: Extend AIProvider Interface

**File:** `packages/shared/src/interfaces/ai.ts`

Add tool-use types and extend the provider interface:

```typescript
// New types
interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AIToolCompletionResult extends AICompletionResult {
  toolCalls: AIToolCall[];       // empty if LLM responded with text
  stopReason: 'end_turn' | 'tool_use';
}

interface AIStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'done';
  text?: string;
  toolCall?: Partial<AIToolCall>;
}

// Extend AIProvider
interface AIProvider {
  complete(...): Promise<AICompletionResult>;           // existing
  completeWithTools(
    messages: AIMessage[],
    tools: AITool[],
    config?: Partial<AIProviderConfig>
  ): Promise<AIToolCompletionResult>;                   // new
  stream(
    messages: AIMessage[],
    tools?: AITool[],
    config?: Partial<AIProviderConfig>
  ): AsyncIterable<AIStreamChunk>;                      // new
  name(): string;
}
```

Also add `role: 'tool'` to `AIMessage` and add `toolCallId?: string`, `toolName?: string` fields for tool result messages.

---

## Step 2: Implement Tool Use in Providers

### ClaudeProvider
**File:** `packages/backend/src/services/ai/claude-provider.ts`

- `completeWithTools`: Add `tools` param to `client.messages.create()`, map `AITool` → Anthropic tool format. Handle response content blocks: `text` → content, `tool_use` → toolCalls array. Return `stopReason` from `response.stop_reason`.
- `stream`: Use `client.messages.stream()`, yield `AIStreamChunk` for each SSE event.
- Tool result messages: Map `role: 'tool'` → Anthropic `tool_result` content block.

### GeminiProvider
**File:** `packages/backend/src/services/ai/gemini-provider.ts`

- `completeWithTools`: Add `tools: [{ functionDeclarations }]` to model config. Handle `functionCall` parts in response.
- `stream`: Use `generateContentStream()`, yield chunks.
- Tool result messages: Map to Gemini `functionResponse` parts.

---

## Step 3: Define Health Data Tools

**New file:** `packages/backend/src/services/ai/tools/health-tools.ts`

Define tool schemas (JSON Schema `inputSchema`) for each:

| Tool Name | Reuses Query Function | Input Params |
|-----------|----------------------|--------------|
| `query_nutrition` | `queryDailyNutritionSummary` (measurements.ts:60) | `startDate`, `endDate` |
| `query_workouts` | `queryWorkoutSessions` (workouts.ts) | `startDate`, `endDate` |
| `query_biometrics` | `queryMeasurementsByMetrics` (measurements.ts:32) | `metrics[]`, `startDate`, `endDate` |
| `query_exercise_progress` | `queryExerciseProgress` (workouts.ts) | `exerciseName`, `startDate`, `endDate` |
| `get_latest_report` | `getLatestReport` (reports.ts) | none |
| `list_available_metrics` | New simple query | none — returns distinct metric names from `measurements` |

**New file:** `packages/backend/src/services/ai/tools/tool-executor.ts`

- `executeTool(toolName, input, db, userId)` → `string` (JSON-serialized result)
- Maps tool names → query functions, parses input, calls query, returns JSON
- Handles errors gracefully (returns error message string, not throw)

---

## Step 4: Conversation Service (Agentic Loop)

**New file:** `packages/backend/src/services/ai/conversation-service.ts`

Core function:
```typescript
async function chat(
  provider: AIProvider,
  db: pg.Pool,
  userId: string,
  conversationId: string,
  userMessage: string,
  history: AIMessage[],
  onChunk?: (chunk: AIStreamChunk) => void
): Promise<{ response: string; toolCalls: ToolCallRecord[] }>
```

Loop logic:
1. Build messages: system prompt + history + new user message
2. Call `provider.completeWithTools(messages, healthTools)`
3. If `stopReason === 'tool_use'`: execute each tool call via `tool-executor.ts`, append tool results to messages, go to step 2
4. If `stopReason === 'end_turn'`: return text response
5. Max 10 iterations to prevent runaway loops
6. Track all tool calls made for transparency

**New file:** `packages/backend/src/services/ai/prompts/chat-persona.md`

Chat-specific system prompt extending the existing persona:
- You are a health data analyst with access to the user's personal health database
- Use tools to answer questions — don't guess or hallucinate data
- Always cite specific data points (dates, values) in responses
- Handle relative dates ("last week" = 7 days back from today)
- When data is insufficient, say so rather than speculating
- Suggest generating a full weekly report when appropriate

---

## Step 5: Database — Conversations

**New migration:** `packages/backend/src/db/migrations/007_conversations.sql`

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_name TEXT,
  tool_call_id TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
```

**New file:** `packages/backend/src/db/queries/conversations.ts`

Functions: `createConversation`, `getConversation`, `listConversations`, `addMessage`, `getMessages`, `deleteConversation`, `updateConversationTitle`

---

## Step 6: Backend Chat Routes

**New file:** `packages/backend/src/routes/chat.ts`

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | `{ conversationId?, message }` → `{ conversationId, response, toolCalls[] }` |
| `/api/chat/conversations` | GET | List conversations (id, title, updatedAt) |
| `/api/chat/conversations/:id` | GET | Full conversation with messages |
| `/api/chat/conversations/:id` | DELETE | Delete conversation |

**New file:** `packages/backend/src/routes/ws-chat.ts`

WebSocket route `/ws/chat` for streaming responses. Follow the pattern from `routes/ws-reports.ts`:
- Auth via `?token=` query param (same as ws-reports)
- Client sends: `{ conversationId?, message }`
- Server streams: `{ type: 'text' | 'tool_call' | 'done', ... }`

Register both in `app.ts`.

---

## Step 7: Frontend Chat Page

**New files:**
- `packages/frontend/src/components/chat/ChatPage.tsx` — main page
- `packages/frontend/src/components/chat/MessageList.tsx` — scrollable message history
- `packages/frontend/src/components/chat/MessageBubble.tsx` — user/assistant message display
- `packages/frontend/src/components/chat/ToolCallPanel.tsx` — collapsible panel showing what data the AI queried (tool name, params, result preview)
- `packages/frontend/src/components/chat/ChatInput.tsx` — text input + send button
- `packages/frontend/src/components/chat/ConversationSidebar.tsx` — list of past conversations (desktop), drawer (mobile)
- `packages/frontend/src/api/hooks/useChat.ts` — TanStack Query hooks + WebSocket streaming

**Route:** Add `/chat` to `App.tsx` inside the `AppShell` layout.

**Nav:** Add Chat icon to BottomNav (mobile) and Sidebar (desktop). 5th nav item.

**Key UX decisions:**
- Streaming text display (typewriter effect via WebSocket chunks)
- Tool calls shown inline as collapsible "Queried nutrition data for Mar 1-15" badges
- Markdown rendering for assistant responses (reuse from reports page)
- Auto-scroll to bottom on new messages
- Mobile: full-screen chat, conversation list via hamburger/drawer

---

## Step 8: Tests

**Unit tests:**
- Tool executor: each tool returns expected format, handles missing data
- Conversation service: mock provider, verify loop terminates, tool calls executed
- Provider `completeWithTools`: mock SDK, verify tool schema mapping
- Chat routes: Fastify `app.inject()` pattern (same as existing route tests)
- Conversation queries: mock pg pool

**E2E tests (Playwright):**
- Navigate to `/chat`
- Send a message, verify response appears
- Verify tool call transparency panel renders
- Create/switch/delete conversations

---

## Implementation Order

| # | Task | Files | Depends On |
|---|------|-------|------------|
| 1 | Extend AIProvider interface + types | `shared/src/interfaces/ai.ts` | — |
| 2 | Claude provider tool use + streaming | `claude-provider.ts` | 1 |
| 3 | Gemini provider tool use + streaming | `gemini-provider.ts` | 1 |
| 4 | Health tools definitions + executor | New: `tools/health-tools.ts`, `tools/tool-executor.ts` | — |
| 5 | Chat persona prompt | New: `prompts/chat-persona.md` | — |
| 6 | Conversation DB migration + queries | New: `007_conversations.sql`, `queries/conversations.ts` | — |
| 7 | Conversation service (agentic loop) | New: `conversation-service.ts` | 1, 4, 5 |
| 8 | Chat REST + WebSocket routes | New: `routes/chat.ts`, `routes/ws-chat.ts` | 6, 7 |
| 9 | Frontend chat page + components | New: `components/chat/*`, `api/hooks/useChat.ts` | 8 |
| 10 | Unit tests | Test files alongside source | 2-8 |
| 11 | E2E tests | `e2e/chat.spec.ts` | 9 |
| 12 | Update docs | `product-capabilities.md`, `architecture.md` | 9 |

Steps 1-6 can be parallelized (1+4+5+6 have no deps on each other).

---

## Future Phases (Not in Scope)

### Phase 6B: Daily Micro-Insights
Once tool-use infrastructure exists, daily insights are nearly free: n8n workflow triggers lightweight prompt using same tool-use loop, stores in `daily_insights` table, shown on dashboard.

### Phase 6C: Correlation Engine
The `calculate_correlation` tool seeds this: `db/queries/correlations.ts` using SQL `corr()` aggregate, scheduled weekly computation, correlation heatmap widget on dashboard.

### Phase 6D: iOS App (Expo/React Native)
**Tech:** Expo — React knowledge reuse, HealthKit via `expo-apple-health`
**Monorepo:** New `packages/mobile/` importing `@vitals/shared`
**MVP scope:** Dashboard + Chat + HealthKit background sync (replaces manual XML upload)

---

## Verification

1. **Build:** `npm run build` passes across all packages
2. **Lint:** `npm run lint && npm run format:check` clean
3. **Unit tests:** `npm test` — all existing + new tests pass
4. **Integration test:** `npm run test:integration -w @vitals/backend` — full chat flow with real DB
5. **E2E:** `npm run test:e2e` — chat page interaction
6. **Manual smoke test:**
   - Open `/chat`, ask "What was my average protein intake last week?"
   - Verify AI calls `query_nutrition` tool with correct dates
   - Verify tool call shown in transparency panel
   - Verify response cites specific data values
   - Test conversation persistence (refresh page, conversation preserved)
   - Test streaming (response appears incrementally)
