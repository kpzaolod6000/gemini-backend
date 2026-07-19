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
