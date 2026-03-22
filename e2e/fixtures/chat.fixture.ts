import type { Page, WebSocketRoute } from '@playwright/test';

export const conversationFixture = {
  id: 'conv-1',
  title: 'What was my protein intake?',
  createdAt: '2026-03-22T10:00:00Z',
  updatedAt: '2026-03-22T10:01:00Z',
};

export const messagesFixture = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user' as const,
    content: 'What was my protein intake last week?',
    toolCalls: null,
    toolName: null,
    createdAt: '2026-03-22T10:00:00Z',
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    role: 'assistant' as const,
    content: 'Your average protein intake last week was **162g per day**, which is excellent at 2.4 g/kg of body weight.',
    toolCalls: [{ id: '', name: 'query_nutrition', input: { startDate: '2026-03-15', endDate: '2026-03-22' } }],
    toolName: null,
    createdAt: '2026-03-22T10:01:00Z',
  },
];

/**
 * Mock all chat REST endpoints with fixture data.
 */
export async function mockChatApi(page: Page) {
  await page.route('**/api/chat/conversations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [conversationFixture] }),
    });
  });

  await page.route('**/api/chat/conversations/conv-1', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204 });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversation: conversationFixture, messages: messagesFixture }),
      });
    }
  });
}

/**
 * Mock the WebSocket and simulate a complete chat exchange:
 * 1. conversation_id event (new conversation)
 * 2. tool_call event (transparency badge)
 * 3. text chunks streaming
 * 4. done event
 */
export async function mockChatWebSocket(page: Page) {
  await page.routeWebSocket(/\/ws\/chat/, async (ws: WebSocketRoute) => {
    ws.onMessage(async () => {
      // Simulate server response sequence
      await new Promise((r) => setTimeout(r, 50));
      ws.send(JSON.stringify({ type: 'conversation_id', conversationId: 'conv-new-1' }));

      await new Promise((r) => setTimeout(r, 50));
      ws.send(JSON.stringify({
        type: 'tool_call',
        toolName: 'query_nutrition',
        input: { startDate: '2026-03-15', endDate: '2026-03-22' },
        result: JSON.stringify([{ date: '2026-03-15', protein: 165 }]),
      }));

      await new Promise((r) => setTimeout(r, 50));
      ws.send(JSON.stringify({ type: 'text', text: 'Your average protein intake ' }));
      ws.send(JSON.stringify({ type: 'text', text: 'last week was **162g per day**.' }));

      await new Promise((r) => setTimeout(r, 50));
      ws.send(JSON.stringify({ type: 'done' }));
    });
  });
}

/**
 * Mock the WebSocket to return an error.
 */
export async function mockChatWebSocketError(page: Page) {
  await page.routeWebSocket(/\/ws\/chat/, async (ws: WebSocketRoute) => {
    ws.onMessage(async () => {
      await new Promise((r) => setTimeout(r, 50));
      ws.send(JSON.stringify({ type: 'error', error: 'AI provider unavailable' }));
    });
  });
}
