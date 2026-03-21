# Phase 6A Implementation Plan: Conversational AI Health Assistant

**Date:** 2026-03-21
**Branch:** `feature/phase6a-conversational-ai`
**Spec:** `docs/plans/2026-03-21-phase6a-conversational-ai.md`
**Status:** Approved for implementation

---

## Context

Extending Vitals with a conversational AI layer that uses tool use to query the user's health database in real time. Users ask natural language questions; the AI calls the existing query functions, cites specific data, and streams responses via WebSocket. Conversation history persisted in PostgreSQL, in-session state in Zustand.

**Key decisions from user gate:**
- WebSocket for streaming (not polling)
- Simple Zustand client state — fetch history from DB on page load, no complex sync
- Mobile conversation list via bottom drawer (existing pattern in app)

---

## 1. Ordered Task List

Execute in this sequence. Tasks 1, 4, 5, 6 have no inter-dependencies and can be done in any order or parallel.

| # | Task | Package | Depends On |
|---|------|---------|------------|
| 1 | Extend `AIProvider` interface + new types | shared | — |
| 2 | `ClaudeProvider.completeWithTools()` + `stream()` | backend | 1 |
| 3 | `GeminiProvider.completeWithTools()` + `stream()` | backend | 1 |
| 4 | Health tools definitions + tool executor | backend | — |
| 5 | Chat persona system prompt | backend | — |
| 6 | DB migration 007 + conversation queries | backend | — |
| 7 | `conversation-service.ts` agentic loop | backend | 1, 4, 5 |
| 8 | REST chat routes (`routes/chat.ts`) | backend | 6, 7 |
| 9 | WebSocket chat route (`routes/ws-chat.ts`) | backend | 6, 7 |
| 10 | Register routes in `app.ts` | backend | 8, 9 |
| 11 | `useChat.ts` hooks + WebSocket client | frontend | 8, 9 |
| 12 | Chat components + `ChatPage.tsx` | frontend | 11 |
| 13 | Nav + routing wired up | frontend | 12 |
| 14 | Unit tests (backend) | backend | 2–9 |
| 15 | E2E tests | frontend | 12, 13 |

---

## 2. Files to Create / Modify

### shared
| File | Action | Change |
|------|--------|--------|
| `packages/shared/src/interfaces/ai.ts` | Modify | Add `AITool`, `AIToolCall`, `AIToolCompletionResult`, `AIStreamChunk` types; add `role: 'tool'` + `toolCallId?`, `toolName?` to `AIMessage`; add `completeWithTools()` and `stream()` to `AIProvider` |

### backend — AI layer
| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/ai/claude-provider.ts` | Modify | Implement `completeWithTools()` using `client.messages.create({ tools })`, map `tool_use` content blocks to `AIToolCall[]`; implement `stream()` using `client.messages.stream()` |
| `packages/backend/src/services/ai/gemini-provider.ts` | Modify | Implement `completeWithTools()` using `tools: [{ functionDeclarations }]` config, map `functionCall` parts; implement `stream()` using `generateContentStream()` |
| `packages/backend/src/services/ai/tools/health-tools.ts` | Create | `HEALTH_TOOLS: AITool[]` — 6 tool definitions with JSON Schema `inputSchema` |
| `packages/backend/src/services/ai/tools/tool-executor.ts` | Create | `executeTool(name, input, db, userId): Promise<string>` — maps tool names to query functions, returns JSON string |
| `packages/backend/src/services/ai/prompts/chat-persona.md` | Create | Chat-specific system prompt (analyst persona, tool-use instructions, date handling, citation requirements) |
| `packages/backend/src/services/ai/conversation-service.ts` | Create | `chat()` function — agentic loop, max 10 iterations, tracks all tool calls |

### backend — DB
| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/db/migrations/007_conversations.sql` | Create | `conversations` + `messages` tables + indexes |
| `packages/backend/src/db/queries/conversations.ts` | Create | `createConversation`, `getConversation`, `listConversations`, `addMessage`, `getMessages`, `deleteConversation`, `updateConversationTitle` |

### backend — routes
| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/routes/chat.ts` | Create | `POST /api/chat`, `GET /api/chat/conversations`, `GET /api/chat/conversations/:id`, `DELETE /api/chat/conversations/:id` |
| `packages/backend/src/routes/ws-chat.ts` | Create | `GET /ws/chat` WebSocket — auth via `?token=`, streams `AIStreamChunk` JSON |
| `packages/backend/src/app.ts` | Modify | Register `chatRoutes` and `wsChatRoutes` |

### frontend
| File | Action | Change |
|------|--------|--------|
| `packages/frontend/src/api/hooks/useChat.ts` | Create | `useConversations()`, `useConversation(id)`, `useSendMessage()`, `useChatWebSocket()`, `useDeleteConversation()` |
| `packages/frontend/src/store/useChatStore.ts` | Create | Zustand store: `messages[]`, `streamingText`, `isStreaming`, `activeConversationId` |
| `packages/frontend/src/components/chat/ChatPage.tsx` | Create | Main page — two-panel layout (desktop: sidebar + chat area; mobile: full-screen chat + drawer) |
| `packages/frontend/src/components/chat/MessageList.tsx` | Create | Scrollable message list, auto-scroll to bottom |
| `packages/frontend/src/components/chat/MessageBubble.tsx` | Create | User bubble (right-aligned) + assistant bubble (left, with markdown) |
| `packages/frontend/src/components/chat/ToolCallPanel.tsx` | Create | Collapsible badge: "Queried nutrition data Mar 1–15" — shows tool name + params + result preview |
| `packages/frontend/src/components/chat/ChatInput.tsx` | Create | Textarea + send button, Enter to send (Shift+Enter for newline), disabled while streaming |
| `packages/frontend/src/components/chat/ConversationList.tsx` | Create | List of past conversations with title, date, delete button |
| `packages/frontend/src/components/layout/nav-items.ts` | Modify | Add `{ to: '/chat', label: 'Chat', icon: MessageCircle, end: false }` |
| `packages/frontend/src/App.tsx` | Modify | Add `<Route path="chat" element={<ChatPage />} />` under AppShell |

### tests
| File | Action | Change |
|------|--------|--------|
| `packages/backend/src/services/ai/tools/__tests__/tool-executor.test.ts` | Create | Each tool returns correct format, handles missing/empty data |
| `packages/backend/src/services/ai/__tests__/conversation-service.test.ts` | Create | Mock provider, verify loop terminates, tool calls executed, max iteration guard |
| `packages/backend/src/routes/__tests__/chat.test.ts` | Create | Fastify `app.inject()` for all 4 REST routes |
| `packages/backend/src/db/queries/__tests__/conversations.test.ts` | Create | Mock pg pool, verify CRUD operations |
| `e2e/chat.spec.ts` | Create | Navigate to /chat, send message, verify response + tool panel, conversation CRUD |

---

## 3. Dependencies

No new npm packages required — all needed SDKs are already installed:
- `@anthropic-ai/sdk` — already in backend
- `@google/generative-ai` — already in backend
- `react-markdown` + `remark-gfm` — already in frontend
- `lucide-react` — already in frontend (for `MessageCircle` icon)

---

## 4. Test Strategy

**Unit tests (Vitest):**
- `tool-executor`: mock `pg.Pool`, assert each tool name maps to correct query, assert error strings returned (not thrown) on bad input
- `conversation-service`: mock `AIProvider.completeWithTools()` to return `tool_use` then `end_turn`, assert tool executor called, assert response returned, assert iteration limit respected
- `chat routes`: `app.inject()` pattern — mock conversation queries, assert status codes and response shapes
- `conversation queries`: mock `pool.query()` returns, assert correct SQL params passed

**E2E (Playwright):**
- `e2e/chat.spec.ts` — mock `/api/chat` and `/ws/chat` with fixture data (no real backend)
- Verify: `/chat` renders, message input visible, send message → response appears, tool call badge visible, conversation list renders, delete conversation works

---

## 5. Risk Areas

| Risk | Mitigation |
|------|-----------|
| Gemini tool use API differences | Test `completeWithTools` with Gemini separately — `functionDeclarations` format differs from Anthropic tools schema |
| WebSocket streaming message ordering | Use sequence numbers or rely on WS ordered delivery (TCP guarantees order) |
| Agentic loop runaway | Hard cap at 10 iterations — return partial response with warning if hit |
| Gemini `'assistant'` → `'model'` role in tool result messages | Apply same role mapping in `completeWithTools` as in `complete` |
| `tool_call_id` correlation | Claude requires matching `tool_use_id` in tool results — track IDs through loop carefully |
| Mobile drawer conflict | Use existing drawer pattern — verify it doesn't conflict with BottomNav z-index |
| Migration on production DB | Run `007_conversations.sql` manually via Railway proxy before deploying |

---

## 6. Build Order

```
shared (npm run build -w @vitals/shared)
  ↓
backend (npm run build -w @vitals/backend)
  ↓
frontend (npm run build -w @vitals/frontend)
```

Always build shared first after any interface changes.
