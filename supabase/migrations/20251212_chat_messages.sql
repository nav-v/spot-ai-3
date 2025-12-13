-- Chat messages table for persisting conversations across devices
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    chat_id UUID NOT NULL, -- Groups messages into conversations
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    recommendations JSONB DEFAULT NULL, -- Store any recommendations in the message
    reasoning_trace TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching messages by user and chat
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_chat 
ON public.chat_messages (user_id, chat_id, created_at ASC);

-- Current active chat per user
CREATE TABLE IF NOT EXISTS public.user_chats (
    user_id TEXT PRIMARY KEY,
    current_chat_id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_chat_messages" ON public.chat_messages FOR ALL USING (true);
CREATE POLICY "allow_all_user_chats" ON public.user_chats FOR ALL USING (true);

COMMENT ON TABLE public.chat_messages IS 'Stores chat messages for persistence across devices';
COMMENT ON TABLE public.user_chats IS 'Tracks the current active chat for each user';

