import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { dbConnect } from './lib/mongodb';
import chatRoutes from './routes/chat';
import conversationRoutes from './routes/conversations';

const app = express();
const PORT = process.env.PORT || 4000;

await dbConnect();
console.log('MongoDB connected');

// Middleware + rutas
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use('/api/chat', chatRoutes);
app.use('/api/conversations', conversationRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
