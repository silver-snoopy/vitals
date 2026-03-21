import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiFetch } from '../client';

export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> | null;
  toolName: string | null;
  createdAt: string;
}

export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  result: string;
}

export interface WsChatEvent {
  type: 'conversation_id' | 'text' | 'tool_call' | 'done' | 'error';
  conversationId?: string;
  text?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
}

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: () =>
      apiFetch<{ conversations: ConversationSummary[] }>('/api/chat/conversations').then(
        (r) => r.conversations,
      ),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['chat', 'conversation', id],
    queryFn: () =>
      apiFetch<{ conversation: ConversationSummary; messages: MessageRecord[] }>(
        `/api/chat/conversations/${id}`,
      ),
    enabled: !!id,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/chat/conversations/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });
}

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export function useChatWebSocket(
  active: boolean,
  onEvent: (event: WsChatEvent) => void,
): { send: (message: string, conversationId?: string) => void } {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  // Queue for messages sent while WebSocket is still connecting
  const pendingQueue = useRef<Array<{ message: string; conversationId?: string }>>([]);

  useEffect(() => {
    if (!active) return;

    let ws: WebSocket | null = null;
    let retries = 0;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;
      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
      const wsUrl = apiUrl.replace(/^http/, 'ws');
      const token = import.meta.env.VITE_X_API_KEY ?? '';

      ws = new WebSocket(`${wsUrl}/ws/chat?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retries = 0;
        // Flush queued messages
        const queued = pendingQueue.current.splice(0);
        for (const item of queued) {
          ws?.send(JSON.stringify({ message: item.message, conversationId: item.conversationId }));
        }
      };

      ws.onmessage = (event) => {
        let data: WsChatEvent;
        try {
          data = JSON.parse(event.data as string) as WsChatEvent;
        } catch {
          // Ignore genuinely malformed frames
          return;
        }
        try {
          onEventRef.current(data);
        } catch (err) {
          console.error('[useChatWebSocket] event handler error:', err);
        }
      };

      ws.onclose = (event) => {
        if (closed) return;
        if (event.code === 1000) return;
        if (retries < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** retries;
          retries++;
          retryTimer = setTimeout(connect, delay);
        } else {
          // Notify the UI that the connection is permanently lost
          onEventRef.current({ type: 'error', error: 'Connection lost. Please refresh the page.' });
        }
      };

      ws.onerror = () => {
        // Errors surface via onclose
      };
    }

    connect();

    return () => {
      closed = true;
      wsRef.current = null;
      pendingQueue.current = [];
      if (retryTimer) clearTimeout(retryTimer);
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  }, [active]);

  return {
    send: (message: string, conversationId?: string) => {
      const ws = wsRef.current;
      if (!ws) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ message, conversationId }));
      } else {
        // Queue for delivery once the connection opens (covers CONNECTING and CLOSED states)
        pendingQueue.current.push({ message, conversationId });
      }
    },
  };
}
