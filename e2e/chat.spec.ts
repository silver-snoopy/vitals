import { test, expect } from '@playwright/test';
import { ChatPage } from './pages/chat.page';
import {
  mockChatApi,
  mockChatWebSocket,
  mockChatWebSocketError,
  conversationFixture,
  messagesFixture,
} from './fixtures/chat.fixture';

test.describe('Chat page', () => {
  test('shows empty state when no conversations exist', async ({ page }) => {
    await page.route('**/api/chat/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });
    await page.routeWebSocket(/\/ws\/chat/, async (ws) => {
      // Accept but don't send anything
      ws.onMessage(() => {});
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    await expect(chatPage.getEmptyState()).toBeVisible();
    await expect(chatPage.messageInput).toBeVisible();
  });

  test('displays existing conversations in sidebar', async ({ page }) => {
    await mockChatApi(page);
    await page.routeWebSocket(/\/ws\/chat/, async (ws) => {
      ws.onMessage(() => {});
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    const items = chatPage.getConversationItems();
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(conversationFixture.title!);
  });

  test('loads conversation messages when selecting a conversation', async ({ page }) => {
    await mockChatApi(page);
    await page.routeWebSocket(/\/ws\/chat/, async (ws) => {
      ws.onMessage(() => {});
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    // Click the existing conversation
    await chatPage.getConversationItems().first().click();

    // User message should appear
    await expect(chatPage.getUserBubble(messagesFixture[0].content)).toBeVisible();

    // Assistant message should appear
    const assistantBubbles = chatPage.getAssistantBubbles();
    await expect(assistantBubbles).toHaveCount(1);
    await expect(assistantBubbles.first()).toContainText('162g per day');
  });

  test('sends a message and streams the response', async ({ page }) => {
    await mockChatApi(page);
    await mockChatWebSocket(page);

    // Override conversation list to start empty so new conversation flow triggers
    await page.route('**/api/chat/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    await chatPage.sendMessage('What was my protein intake last week?');

    // User message should appear immediately
    await expect(chatPage.getUserBubble('What was my protein intake last week?')).toBeVisible();

    // Streaming or final response should appear
    await expect(page.getByText('162g per day')).toBeVisible({ timeout: 5000 });
  });

  test('shows tool call badge during AI response', async ({ page }) => {
    await mockChatApi(page);
    await mockChatWebSocket(page);
    await page.route('**/api/chat/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    await chatPage.sendMessage('Show me my nutrition data');

    // Tool call badge should appear
    await expect(chatPage.getToolCallBadge('query_nutrition')).toBeVisible({ timeout: 5000 });
  });

  test('displays error message when server returns an error', async ({ page }) => {
    await mockChatApi(page);
    await mockChatWebSocketError(page);
    await page.route('**/api/chat/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    await chatPage.sendMessage('Test message');

    // Error should be shown in the chat
    await expect(page.getByText('AI provider unavailable')).toBeVisible({ timeout: 5000 });
  });

  test('input is disabled while streaming', async ({ page }) => {
    let resolveStream!: () => void;
    const streamPaused = new Promise<void>((r) => (resolveStream = r));

    await page.route('**/api/chat/conversations', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    });

    await page.routeWebSocket(/\/ws\/chat/, async (ws) => {
      ws.onMessage(async () => {
        ws.send(JSON.stringify({ type: 'conversation_id', conversationId: 'conv-x' }));
        ws.send(JSON.stringify({ type: 'text', text: 'Loading...' }));
        resolveStream();
        // Don't send 'done' — keeps streaming state active
      });
    });

    const chatPage = new ChatPage(page);
    await chatPage.goto();

    await chatPage.sendMessage('Test');
    await streamPaused;

    await expect(chatPage.messageInput).toBeDisabled();
  });

  test('starts a new conversation when New button is clicked on mobile', async ({ page }) => {
    await mockChatApi(page);
    await page.routeWebSocket(/\/ws\/chat/, async (ws) => {
      ws.onMessage(() => {});
    });

    await page.setViewportSize({ width: 375, height: 812 });
    const chatPage = new ChatPage(page);
    await chatPage.goto();

    // First load a conversation
    await chatPage.getConversationItems().first().click();
    await expect(chatPage.getUserBubble(messagesFixture[0].content)).toBeVisible();

    // Mobile new button
    await chatPage.newChatButton.click();

    await expect(chatPage.getEmptyState()).toBeVisible();
  });
});
