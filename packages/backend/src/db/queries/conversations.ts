import type pg from 'pg';

export interface ConversationRow {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> | null;
  toolName: string | null;
  toolCallId: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

function rowToConversation(r: Record<string, unknown>): ConversationRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    title: r.title != null ? String(r.title) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

function rowToMessage(r: Record<string, unknown>): MessageRow {
  return {
    id: String(r.id),
    conversationId: String(r.conversation_id),
    role: r.role as 'user' | 'assistant' | 'tool',
    content: String(r.content),
    toolCalls: r.tool_calls as MessageRow['toolCalls'],
    toolName: r.tool_name != null ? String(r.tool_name) : null,
    toolCallId: r.tool_call_id != null ? String(r.tool_call_id) : null,
    tokensUsed: r.tokens_used != null ? Number(r.tokens_used) : null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function createConversation(
  pool: pg.Pool,
  userId: string,
  title?: string,
): Promise<ConversationRow> {
  const { rows } = await pool.query(
    `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *`,
    [userId, title ?? null],
  );
  return rowToConversation(rows[0] as Record<string, unknown>);
}

export async function getConversation(pool: pg.Pool, id: string): Promise<ConversationRow | null> {
  const { rows } = await pool.query(`SELECT * FROM conversations WHERE id = $1`, [id]);
  if (rows.length === 0) return null;
  return rowToConversation(rows[0] as Record<string, unknown>);
}

export async function listConversations(pool: pg.Pool, userId: string): Promise<ConversationRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId],
  );
  return rows.map((r) => rowToConversation(r as Record<string, unknown>));
}

export async function updateConversationTitle(
  pool: pg.Pool,
  id: string,
  title: string,
): Promise<void> {
  await pool.query(`UPDATE conversations SET title = $1, updated_at = NOW() WHERE id = $2`, [
    title,
    id,
  ]);
}

export async function deleteConversation(pool: pg.Pool, id: string): Promise<void> {
  await pool.query(`DELETE FROM conversations WHERE id = $1`, [id]);
}

export async function addMessage(
  pool: pg.Pool,
  msg: Omit<MessageRow, 'id' | 'createdAt'>,
): Promise<MessageRow> {
  const { rows } = await pool.query(
    `INSERT INTO messages
       (conversation_id, role, content, tool_calls, tool_name, tool_call_id, tokens_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      msg.conversationId,
      msg.role,
      msg.content,
      msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      msg.toolName ?? null,
      msg.toolCallId ?? null,
      msg.tokensUsed ?? null,
    ],
  );
  // Bump conversation updated_at
  await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [
    msg.conversationId,
  ]);
  return rowToMessage(rows[0] as Record<string, unknown>);
}

export async function getMessages(pool: pg.Pool, conversationId: string): Promise<MessageRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at`,
    [conversationId],
  );
  return rows.map((r) => rowToMessage(r as Record<string, unknown>));
}
