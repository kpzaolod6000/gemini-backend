import { Router } from 'express';
import { ai, DEFAULT_MODEL } from '../lib/gemini';
import type { Chat } from '@google/genai';

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
        id = crypto.randomUUID();
        chat = ai.chats.create({ model: DEFAULT_MODEL });
        chats.set(id, chat);
    }

    const response = await chat.sendMessage({ message: prompt });
    res.json({ conversationId: id, message: response.text });
});

export default router;
