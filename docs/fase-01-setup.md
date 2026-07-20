# Fase 1 — Setup del Backend (Node + Express)

> Notas de aprendizaje. Regla del proyecto: cada fase deja sus conceptos anotados en `docs/fase-NN-<tema>.md` (ver design D9).

## Decisión de arquitectura: proyectos independientes

Frontend y backend son **proyectos npm separados** — cada uno con su `package.json`, su lockfile y su `node_modules`. Se descartó npm workspaces (monorepo).

**Por qué backend separado de Next.js:** Socket.IO necesita un proceso persistente que mantenga conexiones WebSocket abiertas. Los entornos serverless (Vercel) matan el proceso entre requests, así que no pueden sostener WebSockets. Un server Express propio también permite lanzar worker threads sin tocar el event loop de Next.js.

**Por qué sin workspaces:** gestión de dependencias separada por proyecto — instalar, actualizar y deployar cada uno sin acoplarlo al otro.

## `"type": "module"` en package.json

Node por defecto trata los `.js` como **CommonJS** (`require`/`module.exports`). Con `"type": "module"` los trata como **ES Modules** (`import`/`export`). Sin esto, cualquier `import` revienta con `SyntaxError: Cannot use import statement outside a module`. Todo el proyecto usa ESM porque es el estándar actual y lo que asumen los SDKs modernos.

## `tsx` — ejecutar TypeScript sin compilar

`tsx` ejecuta archivos `.ts` directamente (transpila en memoria con esbuild). `tsx watch src/server.ts` además reinicia el proceso al guardar. Es el reemplazo moderno de la dupla `ts-node` + `nodemon`.

- `npm run dev` → `tsx watch src/server.ts`
- `npm run typecheck` → `tsc --noEmit` (tsx NO chequea tipos — solo transpila; el chequeo real lo hace tsc aparte)

## Dependencias y para qué sirve cada una

| Paquete | Rol |
|---|---|
| `@google/genai` (^2.12) | SDK unificado de Gemini: `generateContent`, `chats`, `live.connect`, y Vertex AI con el mismo API |
| `express` (^5) | HTTP server / REST endpoints |
| `mongoose` (^9) | ODM sobre MongoDB: schemas, validación, type safety |
| `mongodb` (^7) | Driver nativo (mongoose lo usa por debajo; disponible para acceso directo) |
| `socket.io` (^4.8) | Server de WebSockets con rooms, reconexión, fallbacks |
| `dotenv` | Carga `.env` a `process.env` |
| `cors` | Permite requests cross-origin desde el frontend (puerto 3000 → 4000) |

**`socket.io` vs `socket.io-client`:** dos mitades del mismo protocolo. El server (backend) acepta conexiones; el client (browser/frontend) las inicia. Por eso uno va en cada proyecto.

## Nota sobre versiones instaladas

- **Express 5** (no 4): los handlers `async` que lanzan error ya se capturan solos — no hace falta wrapper try/catch para pasar errores al middleware de error.
- **Mongoose 9**, **TypeScript 7**, **@types/node 26**: versiones actuales al 2026-07. El runtime es Node 20 — si algún tipo de `@types/node` no coincide con el runtime, es porque los types son de una versión mayor.

## SDK: por qué `@google/genai` y no otro

Google consolidó sus SDKs en `@google/genai`. El paquete viejo `@google-cloud/vertexai` está deprecated y no recibe features de Gemini 2.0+. Un solo SDK sirve para AI Studio (API key) y Vertex AI (`enterprise: true` + ADC) — misma superficie de API, distinta autenticación.

## Modelos del lab (design D3)

| Uso | Modelo |
|---|---|
| Texto estándar | `gemini-2.5-flash` |
| Razonamiento profundo | `gemini-2.5-pro` |
| Live API (texto y voz) | `gemini-3.1-flash-live-preview` |
| TTS | `gemini-3.1-flash-tts-preview` |

Flash para prototipar: rápido y con tier gratuito.

## Variables de entorno: `.env` vs `.env.example`

- `.env` — valores reales (secretos). **Nunca** a git; está en `.gitignore`.
- `.env.example` — plantilla sin secretos, con placeholders que documentan el formato. **Sí** se commitea: un dev nuevo la copia a `.env` y rellena.
- El patrón `.env` del `.gitignore` no matchea `.env.example` (nombre distinto), así que la plantilla pasa sin necesidad de excepción.
- **Espacios alrededor del `=` importan**: `PORT= 4000` funciona con `dotenv` (recorta whitespace) pero rompe con parsers que no recortan (docker compose, CI). Hábito: nunca espacios.

## `lib/gemini.ts` — cliente singleton

- **Singleton por caché de módulos ES**: el archivo se ejecuta una sola vez en el primer `import`; los demás imports reciben el mismo objeto. Un solo cliente `GoogleGenAI` para toda la app, sin crear uno por request.
- **Fail-fast**: validar `GEMINI_API_KEY` y lanzar error claro al arrancar es mejor que un 401 críptico en el primer request. El `if (!x) throw` además hace *narrowing*: TS pasa de `string | undefined` a `string`.
- **Named export (`export const ai`) sobre `export default`**: nombre canónico en todo el repo — mismo identificador al importar, autocompletado exacto, rename refactoriza global. `default` deja que cada archivo lo nombre distinto y el codebase diverge.
- `DEFAULT_MODEL = 'gemini-2.5-flash'` exportado aquí: un solo lugar para cambiar de modelo.

## Orden de imports: `dotenv/config` SIEMPRE primero

Los imports ES se evalúan **en orden de declaración**. Si un módulo que lee `process.env` en su cuerpo (como `gemini.ts`) se importa *antes* de `import 'dotenv/config'`, ve el env vacío y su fail-fast truena aunque `.env` esté perfecto. Regla: `import 'dotenv/config'` es la primera línea de `server.ts`, siempre.

## `lib/mongodb.ts` — `dbConnect()`

- Mongoose mantiene **su propio pool de conexiones**: se llama `mongoose.connect(uri)` una vez y todos los modelos la comparten. No se conecta por request.
- `mongoose.connection.readyState`: 0 disconnected, 1 connected, 2 connecting. `dbConnect()` retorna temprano si ya está conectado.
- Limitación conocida (aceptada por ahora): dos llamadas simultáneas con readyState 0 disparan dos `connect()`. Mongoose lo tolera con la misma URI; el patrón industrial cachea la *promesa* de conexión en una variable de módulo.

## Esquemas Mongoose (`src/models/`)

Patrón por archivo: **interface → `new Schema<IX>({...})` → `export const X = model<IX>('X', schema)`**. La interface le da tipos a los documentos en queries; el generic `Schema<IX>` hace que TS avise si schema e interface divergen.

Decisiones:

- **Validación en dos capas**: union type (`'user' | 'model'`) atrapa errores en *compile time*; `enum: [...]` en el campo los atrapa en *runtime* (datos que llegan por HTTP no pasan por TS).
- **`conversationId` como `ObjectId` + `ref: 'Conversation'`**: habilita `populate()` (join de Mongo) y valida formato. String suelto no da ninguna de las dos.
- **`index: true`** en campos de búsqueda frecuente (`conversationId` en Message, `userId` en Conversation): las queries de la fase 3 (`GET /api/conversations/:id`) filtran por ahí.
- **`timestamps: true`** (segunda opción del constructor): Mongoose mantiene `createdAt`/`updatedAt` solo. `Message` además lleva `timestamp` manual con `default: Date.now` porque el design lo pide explícito — ojo: se pasa la *función* `Date.now`, no `Date.now()` (se evalúa al crear cada doc, no al definir el schema).
- **`Schema.Types.Mixed`** para `metadata`/`config`: acepta cualquier objeto, cero validación interna. Correcto para datos de forma variable; en TS se refleja como `Record<string, unknown>` opcional.
- **`OverwriteModelError`**: `model('X', ...)` registra el modelo en un registry global; registrar dos veces truena. Con `tsx watch` no pasa (reinicia el proceso completo → registry limpio), pero en Next.js el HMR conserva módulos → ahí se usa el guard `mongoose.models.X || model('X', ...)`. Backend no lo necesita.

## Arranque del server: `await dbConnect()` ANTES de `app.listen()`

- **Orden correcto**: conectar DB → luego escuchar. Si escuchas primero, aceptas requests con la DB aún no lista (fallan raro); si Mongo no está, mejor morir al arrancar con error claro que fingir salud.
- **`.then()` encadena, no pausa**: `dbConnect().then(...)` registra un callback y el código sigue de largo a `app.listen` — el server escucha antes de conectar. Solo `await` pausa el flujo del módulo. ESM + Node 20 permiten *top-level await*, sin función wrapper.
- **Sin `.catch` en el arranque, a propósito**: si la conexión falla, el rechazo sube y el proceso muere con stack trace. Un `.catch` que solo loguea deja un server zombi: escuchando, con DB muerta. `.then/.catch` es para cuando *quieres* seguir sin esperar — el arranque no es ese caso.
- `mongoose.connect` espera ~30s (`serverSelectionTimeoutMS`) antes de rendirse si no encuentra servidor — silencio largo al arrancar suele ser eso.
- MongoDB local corre en Docker (contenedor con puerto 27017 publicado); la URI `mongodb://localhost:27017/genai_gemini` apunta ahí.

## Lección TypeScript: narrowing, hoisting y por qué evitar `as`/`!`

Contexto: `mongoose.connect(MONGODB_URI)` marcaba `string | undefined` pese al check `if (!MONGODB_URI) throw` arriba.

- El narrowing de un check a nivel módulo aplica a las líneas siguientes **del mismo scope**, pero **no entra a funciones**: las declaraciones `function` se hoistean y en teoría podrían ejecutarse antes del check, así que TS se pone conservador dentro del closure.
- `as string` y `!` "arreglan" el error **apagando al compilador**: le aseguras algo que no verificó. Prueba de que es trampa: borras el `if` y sigue compilando, dejando pasar `undefined` en runtime.
- Patrón correcto — convencer a TS con el check:

```ts
const raw = process.env.MONGODB_URI;
if (!raw) throw new Error('Falta MONGODB_URI');
const MONGODB_URI: string = raw; // sin as — el narrowing lo prueba
```

Si alguien borra el `if`, esto **deja de compilar**. El tipo depende del check: el compilador te cuida. Regla: `as`/`!` solo cuando sabes algo que TS *no puede* saber; aquí sí puede.
