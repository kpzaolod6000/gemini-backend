# Fase 4 — Streaming: `POST /api/chat/stream` con SSE

> Notas de aprendizaje (regla D9). Cubre tareas 4.1–4.4 (backend).

## Qué es SSE (Server-Sent Events)

HTTP normal que **no se cierra**: el server escribe eventos de texto por la misma conexión abierta. Formato del protocolo:

```
event: text-delta
data: {"text":"hola"}
                        ← línea vacía: el \n\n separa eventos (sin él nada se entrega)
```

**SSE vs WebSocket**: SSE es unidireccional (server → cliente) sobre HTTP plano; WebSocket es bidireccional con protocolo propio. Para "el server te va soltando texto" (nuestro caso: el cliente habla UNA vez con el POST y luego solo escucha), SSE basta y sobra — sin handshake extra, sin librería. WebSocket llega en fase 5, cuando ambos lados hablan.

## Los 3 pasos en Express

```ts
// 1. headers ANTES de escribir nada
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');

// 2. el stream de Gemini es un async iterable
const stream = await chat.sendMessageStream({ message: prompt });
for await (const chunk of stream) {
    if (chunk.text) {
        res.write(`event: text-delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
    }
    if (chunk.usageMetadata) usage = chunk.usageMetadata;  // solo el último chunk lo trae
}

// 3. cerrar
res.end();
```

- `res.write` escribe **sin cerrar** (vs `res.json`/`res.send` que escriben y cuelgan).
- `for await` itera promesas conforme resuelven.
- `chunk.text` puede venir `undefined` → guard.
- Nota: se usó `chat.sendMessageStream` (vía `ai.chats.create`); `ai.models.generateContentStream` es la llamada directa equivalente sin el objeto chat de por medio.

## El contrato de eventos (por qué se nombran)

| Evento | Cuándo | Payload |
|---|---|---|
| `text-delta` | cada pedazo de texto | `{ text }` |
| `stream-end` | el loop terminó bien | `{ usage }` (tokens) |
| `stream-error` | excepción a mitad de stream | `{ error }` |

El cliente despacha por nombre. Sin `stream-end` explícito, "terminó bien" y "se cortó la conexión" serían indistinguibles.

## La trampa de los errores en streaming (4.4)

Una vez enviados los headers (y más aún, chunks), **son inmutables** — `res.status(500)` a mitad de stream lanza `ERR_HTTP_HEADERS_SENT`. Regla: **si el stream empezó, los errores también viajan como eventos**:

```ts
try {
    for await (...) { ... }
    res.write(`event: stream-end...`);   // dentro del try — solo si hubo final feliz
} catch (err) {
    res.write(`event: stream-error\ndata: ${JSON.stringify({ error: ... })}\n\n`);
} finally {
    res.end();                            // la conexión se cierra SIEMPRE
}
```

Detalle fino: el `await sendMessageStream(...)` está ANTES de los headers SSE — si la llamada inicial falla (key mala, cuota), Express 5 aún puede responder un 500 JSON normal. El try/catch protege solo el *durante*.

**Cómo probar un camino de error que no puedes provocar**: `throw new Error('boom')` temporal dentro del loop → verificar `event: stream-error` en curl → quitar el throw y verificar camino feliz restaurado.

## Debug SSE: curl crudo, siempre

`curl -N` (sin buffering) muestra byte a byte lo que el cliente recibe; Postman/browser interpretan y esconden. Cuando "no se muestra un evento": primero curl crudo — ¿el server lo emite o el cliente no lo pinta? (Caso real de esta fase: no lo emitía — el proceso en el puerto corría código viejo.)

## Cuota free tier (incidente real)

**20 requests/día POR MODELO.** `gemini-flash-latest` se agotó con los tests → `DEFAULT_MODEL` cambiado a `gemini-flash-lite-latest` (bucket de cuota separado). Beneficio de la constante centralizada: un cambio migró todos los endpoints. El 429 trae `RetryInfo` engañoso ("retry in 8s") cuando la cuota es diaria.
