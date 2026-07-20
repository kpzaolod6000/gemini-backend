import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { dbConnect } from './lib/mongodb';
import chatRoutes from './routes/chat';
import conversationRoutes from './routes/conversations';
import { createServer } from 'node:http';
import { Server } from 'socket.io'
import { registerChatHandlers } from './socket/chat';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:3000' },
});

io.on('connection', (socket) => {
    console.log('cliente conectado:', socket.id);
    registerChatHandlers(io, socket);
});

const PORT = process.env.PORT || 4000;

await dbConnect();
console.log('MongoDB connected');

// Middleware + rutas
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
