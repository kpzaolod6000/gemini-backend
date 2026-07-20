# Fase 3 — Multi-turno: `POST /api/chat/multi` + persistencia

> Notas de aprendizaje (regla D9). Cubre tareas 3.1–3.5 (backend).

## El concepto central: el LLM no tiene memoria

Cada `generateContent` es amnesia total — "¿y de qué color son?" no significa nada sin el turno anterior. **Multi-turno = mandar el historial completo en cada request.** No hay magia: más turnos = más tokens de entrada = más costo por request.

## `ai.chats.create()` — el SDK lleva el historial

```ts
const chat = ai.chats.create({ model: DEFAULT_MODEL });
const r = await chat.sendMessage({ message: prompt });
```

`chat` acumula turnos internamente y los reenvía todos en cada `sendMessage`. Azúcar sobre `generateContent`.

## El problema del server HTTP: recuperar el chat entre requests

El objeto `chat` vive en memoria del proceso. Solución de esta fase:

```ts
const chats = new Map<string, Chat>();   // nivel módulo — sobrevive entre requests
```

- Sin `conversationId` en el body → conversación nueva; con él → `chats.get(id)`, y si no está → 404.
- **Limitación conocida (comprobada con la recarga del browser + reinicio de server):** el Map muere con el proceso. Los *datos* sobreviven en Mongo; el objeto `chat` no. Conversaciones viejas dan 404 tras reiniciar. Fix futuro: re-hidratar con `ai.chats.create({ history })` leyendo los mensajes de Mongo.

## Decisión de diseño: el `_id` de Mongo ES el `conversationId`

Se evaluó UUID propio vs `_id` de MongoDB. Ganó `_id` (opción a):

- Un solo identificador — sin mapear dos identidades.
- `Message.conversationId` es `ObjectId` en el schema: un string con formato ObjectId **Mongoose lo castea solo**; un UUID habría tronado.
- Costo: el documento `Conversation` debe crearse *antes* de responder (necesitas su `_id`).

## Persistencia de turnos

```ts
await Message.create([
    { conversationId: id, role: 'user', content: prompt, model: DEFAULT_MODEL },
    { conversationId: id, role: 'model', content: text, model: DEFAULT_MODEL,
      metadata: response.usageMetadata },
]);
```

- `create([...])` con array = ambos en una llamada.
- `response.usageMetadata` → tokens consumidos. Visto en datos reales: `promptTokenCount: 18, candidatesTokenCount: 25, totalTokenCount: 601` — la diferencia son **thinking tokens** (razonamiento interno del modelo, se cobra).
- `response.text ?? ''` — el getter es `string | undefined` (respuesta bloqueada por safety, p. ej.); la interface exige `string`.

## Lección TS: interfaces NO son asignables a `Record<string, unknown>`

`metadata: Record<string, unknown>` rechazó `usageMetadata` (interface del SDK). Las *interfaces* no tienen index signature implícita; los *type alias* sí. El error de Mongoose fue ilegible ("no overload matches") pero la causa era esa. Fix: `metadata?: unknown` — todo es asignable a `unknown`, y el schema ya era `Mixed`. Leerlo después exige narrowing — trade-off aceptado.

## GETs de consulta (3.3/3.4) — `src/routes/conversations.ts`

- `GET /api/conversations` → `find().sort({ updatedAt: -1 })`.
- `GET /api/conversations/:id` → `Message.find({ conversationId }).sort({ timestamp: 1 })` — el orden de inserción NO es garantía; el `.sort()` no es opcional.
- Semántica de `find()`: id inexistente (formato válido) → `[]` con 200, **nunca error**. Para listas, correcto.
- Id con formato inválido (`/abc`) → Mongoose lanza `CastError` (500 feo). Fix: `isValidObjectId(req.params.id)` → 400. Cuarta aparición del patrón *validar en el borde*.

## Depuración: checklist "agregué y nada"

1. ¿El proceso corre? `ss -ltn | grep 4000`
2. ¿Compila? `npm run typecheck`
3. Recién entonces, mira el código.

El 80% de los "no funciona" muere en 1 o 2.
