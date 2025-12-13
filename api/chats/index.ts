import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let supabase: any;
function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
        const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
        supabase = createClient(url, key);
    }
    return supabase;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const db = getSupabase();

    // GET - Load current chat messages
    if (req.method === 'GET') {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' });
        }

        try {
            // Get current chat ID for user
            const { data: userChat } = await db
                .from('user_chats')
                .select('current_chat_id')
                .eq('user_id', userId)
                .single();

            if (!userChat) {
                // No chat yet, return empty
                return res.status(200).json({ messages: [], chatId: null });
            }

            // Get messages for this chat
            const { data: messages, error } = await db
                .from('chat_messages')
                .select('*')
                .eq('user_id', userId)
                .eq('chat_id', userChat.current_chat_id)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('[Chats] Error loading messages:', error);
                return res.status(500).json({ error: 'Failed to load messages' });
            }

            // Transform to frontend format
            const formattedMessages = messages?.map(m => ({
                role: m.role,
                content: m.content,
                recommendations: m.recommendations || undefined,
                reasoningTrace: m.reasoning_trace || undefined
            })) || [];

            return res.status(200).json({
                messages: formattedMessages,
                chatId: userChat.current_chat_id
            });

        } catch (error: any) {
            console.error('[Chats] Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // POST - Save a message
    if (req.method === 'POST') {
        const { userId, message, chatId } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        try {
            let currentChatId = chatId;

            // If no chatId, get or create one
            if (!currentChatId) {
                const { data: userChat } = await db
                    .from('user_chats')
                    .select('current_chat_id')
                    .eq('user_id', userId)
                    .single();

                if (userChat) {
                    currentChatId = userChat.current_chat_id;
                } else {
                    // Create new chat
                    currentChatId = crypto.randomUUID();
                    await db.from('user_chats').upsert({
                        user_id: userId,
                        current_chat_id: currentChatId,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            // Save message
            const { error } = await db.from('chat_messages').insert({
                user_id: userId,
                chat_id: currentChatId,
                role: message.role,
                content: message.content,
                recommendations: message.recommendations || null,
                reasoning_trace: message.reasoningTrace || null
            });

            if (error) {
                console.error('[Chats] Error saving message:', error);
                return res.status(500).json({ error: 'Failed to save message' });
            }

            return res.status(200).json({ success: true, chatId: currentChatId });

        } catch (error: any) {
            console.error('[Chats] Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // DELETE - Start new chat
    if (req.method === 'DELETE') {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        try {
            // Create new chat ID
            const newChatId = crypto.randomUUID();

            // Update user's current chat
            await db.from('user_chats').upsert({
                user_id: userId,
                current_chat_id: newChatId,
                updated_at: new Date().toISOString()
            });

            console.log(`[Chats] New chat started for ${userId}: ${newChatId}`);

            return res.status(200).json({ success: true, chatId: newChatId });

        } catch (error: any) {
            console.error('[Chats] Error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

