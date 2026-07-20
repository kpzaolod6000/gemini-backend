import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('connect', () => {
    console.log('conectado:', socket.id);
    // socket.emit('chat:message', { prompt: 'di hola en una frase' });
    socket.emit('chat:stream', { prompt: 'explica qué es un socket en 4 frases' });
});

socket.on('chat:stream-chunk', (data) => {
    process.stdout.write(data.text);   // sin salto de línea — verás el texto crecer
});

socket.on('chat:stream-end', (data) => {
    console.log('\n\n[fin]', JSON.stringify(data.usage));
    socket.disconnect();
});

socket.on('chat:response', (data) => {
    console.log('respuesta:', data.text);
    socket.disconnect();
});

socket.on('chat:error', (data) => {
    console.error('error:', data.error);
    socket.disconnect();
})