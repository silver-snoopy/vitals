-- Unify user_id values: REST route previously used 'default' while WebSocket used the UUID.
-- Migrate all 'default' conversations to the standard UUID so they remain accessible.
UPDATE conversations
SET user_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id = 'default';
