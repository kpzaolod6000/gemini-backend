import type { Server, Socket } from 'socket.io';
import { ai, DEFAULT_MODEL } from '../lib/gemini';

export function registerChatHandlers(io: Server, socket: Socket) {
    socket.on('chat:join', (payload) => {
        const { conversationId } = payload ?? {};
        if (typeof conversationId !== 'string' || !conversationId) return;
        socket.join(conversationId);
    });

    socket.on('chat:message', async (payload) => {
        const { prompt } = payload ?? {};

        if (typeof prompt !== 'string' || !prompt.trim()) {
            socket.emit('chat:error', { error: 'prompt requerido' });
            return;
        }

        try {
            const response = await ai.models.generateContent({
                model: DEFAULT_MODEL,
                contents: prompt,
            });

            if (!response.text) {
                socket.emit('chat:error', { error: 'no se obtuvo respuesta' });
                return;
            }
            socket.emit('chat:response', { text: response.text });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Error desconocido';
            socket.emit('chat:error', { error });
        }
    });

    socket.on('chat:stream', async (payload) => {
        const { prompt, conversationId } = payload ?? {};

        if (typeof prompt !== 'string' || !prompt.trim()) {
            socket.emit('chat:error', { error: 'prompt requerido' });
            return;
        }

        // Con room: todos los miembros (incluido el emisor si hizo join) reciben.
        // Sin room: solo el emisor.
        const target = typeof conversationId === 'string' && conversationId
            ? io.to(conversationId)
            : socket;

        target.emit('chat:typing', { typing: true });

        try {
            const chat = ai.chats.create({ model: DEFAULT_MODEL });
            const stream = await chat.sendMessageStream({ message: prompt });

            let usage;
            for await (const chunk of stream) {
                if (chunk.text) {
                    target.emit('chat:stream-chunk', { text: chunk.text });
                }
                if (chunk.usageMetadata) {
                    usage = chunk.usageMetadata;
                }
            }
            target.emit('chat:stream-end', { usage });
        } catch (err) {
            const error = err instanceof Error ? err.message : 'Error desconocido';
            socket.emit('chat:error', { error });
        } finally {
            target.emit('chat:typing', { typing: false });
        }
    });

    socket.on('chat:user-typing', (payload) => {
        socket.broadcast.emit('chat:user-typing', payload);
    });
}