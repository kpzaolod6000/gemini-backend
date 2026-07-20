import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', { timeout: 5000 });

socket.on('connect', () => {
    console.log('conectado:', socket.id);
    socket.emit('chat:join', { conversationId: 'test-room' });
    socket.emit('chat:stream', { prompt: 'di ok breve', conversationId: 'test-room' });
});

socket.on('chat:typing', (data) => {
    console.log(data.typing ? '[Gemini está escribiendo...]' : '[typing off]');
});

socket.on('chat:stream-chunk', (data) => {
    process.stdout.write(data.text);
});

socket.on('chat:stream-end', (data) => {
    console.log('\n\n[fin]', JSON.stringify(data.usage));
    socket.disconnect();
});

socket.on('connect_error', (err) => {
    console.error('connect_error:', err.message);
    process.exit(1);
});

socket.on('chat:response', (data) => {
    console.log('respuesta:', data.text);
    socket.disconnect();
});

socket.on('chat:error', (data) => {
    console.error('chat:error:', data.error);
    socket.disconnect();
});
