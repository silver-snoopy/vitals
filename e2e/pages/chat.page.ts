import type { Locator, Page } from '@playwright/test';

/**
 * Page Object Model for the Chat page.
 */
export class ChatPage {
  readonly page: Page;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly conversationList: Locator;
  readonly newChatButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.messageInput = page.getByRole('textbox', { name: /message/i });
    this.sendButton = page.getByRole('button', { name: /send/i });
    this.conversationList = page.locator('[data-testid="conversation-list"]');
    this.newChatButton = page.getByRole('button', { name: /new/i }).first();
  }

  async goto() {
    await this.page.goto('/chat');
  }

  async sendMessage(text: string) {
    await this.messageInput.fill(text);
    await this.messageInput.press('Enter');
  }

  /** Get the user bubble for a specific message text */
  getUserBubble(text: string | RegExp) {
    return this.page.getByText(text);
  }

  /** Get assistant message bubbles */
  getAssistantBubbles() {
    return this.page.locator('[data-testid="assistant-bubble"]');
  }

  /** Get the streaming bubble */
  getStreamingBubble() {
    return this.page.locator('[data-testid="streaming-bubble"]');
  }

  /** Get conversation items in the sidebar */
  getConversationItems() {
    return this.page.locator('[data-testid="conversation-item"]');
  }

  /** Get tool call badge for a specific tool */
  getToolCallBadge(toolName: string) {
    return this.page.getByText(toolName);
  }

  /** Empty state prompt text */
  getEmptyState() {
    return this.page.getByText('Ask about your health data');
  }
}
