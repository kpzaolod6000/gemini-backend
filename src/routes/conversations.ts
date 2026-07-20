import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';

const router = Router();

router.get('/', async (_req, res) => {
    const conversations = await Conversation.find().sort({ updatedAt: -1 });
    res.json(conversations);
});

router.get('/:id', async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'id inválido' });
        return;
    }

    const messages = await Message.find({ conversationId: req.params.id })
        .sort({ timestamp: 1 });
    res.json(messages);
});

export default router;
