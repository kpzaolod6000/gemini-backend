import { Router } from 'express';
import { ai, DEFAULT_MODEL } from '../lib/gemini';
import type { Chat } from '@google/genai';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

const router = Router();
const chats = new Map<string, Chat>()

router.post('/single', async (req, res) => {
    const { prompt, temperature, maxOutputTokens, model } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'prompt requerido (string no vacío)' });
        return;
    }

    const response = await ai.models.generateContent({
        model: model ?? DEFAULT_MODEL,
        contents: prompt,
        config: {
            systemInstruction: 'Eres un asistente útil y conciso.',
            temperature: temperature,
            maxOutputTokens: maxOutputTokens,
        },
    });

    res.json({ message: response.text });
});

router.post('/multi', async (req, res) => {
    const { prompt, conversationId } = req.body;

    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'prompt requerido (string no vacío)' });
        return;
    }

    let id = conversationId;
    let chat;

    if (id) {
        chat = chats.get(id);
        if (!chat) {
            res.status(404).json({ error: 'conversación no encontrada' })
            return
        }
    } else {
        const conversation = await Conversation.create({
            userId: 'demo',
            title: prompt.slice(0, 50),
            model: DEFAULT_MODEL,
        });
        id = conversation._id.toString();
        chat = ai.chats.create({ model: DEFAULT_MODEL });
        chats.set(id, chat)
    }

    const response = await chat.sendMessage({ message: prompt });
    const text = response.text ?? '';
    await Message.create([
        { conversationId: id, role: 'user', content: prompt, model: DEFAULT_MODEL },
        {
            conversationId: id,
            role: 'model',
            content: text,
            model: DEFAULT_MODEL,
            metadata: response.usageMetadata,
        },
    ]);
    res.json({ conversationId: id, message: response.text });
});

router.post('/stream', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'prompt requerido (string no vacío)' });
        return;
    }

    const chat = ai.chats.create({ model: DEFAULT_MODEL });
    const stream = await chat.sendMessageStream({ message: prompt });

    // Header SSE(Server-Sent Events) lo que permite esto es que el cliente pueda recibir datos en tiempo real
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let usage;
    try {
        for await (const chunk of stream) {
            if (chunk.text) {
                res.write(`event: text-delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
            }
            if (chunk.usageMetadata) {
                usage = chunk.usageMetadata;
            }
        }

        res.write(`event: stream-end\ndata: ${JSON.stringify({ usage })}\n\n`);
    } catch (err) {
        // Headers ya enviados: el error viaja como evento SSE, no como status HTTP
        res.write(`event: stream-error\ndata: ${JSON.stringify({
            error: err instanceof Error ? err.message : 'error en el stream',
        })}\n\n`);
    } finally {
        res.end();
    }
})

export default router;
