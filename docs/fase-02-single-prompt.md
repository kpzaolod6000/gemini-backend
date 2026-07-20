# Fase 2 — Single Prompt: `POST /api/chat/single`

> Notas de aprendizaje (regla D9). Cubre tareas 2.1–2.3 (backend). El frontend de esta fase se documenta en `frontend/docs/`.

## Express Router: paths relativos, montaje con prefijo

- `Router()` = mini-app montable. El router define **paths relativos** (`router.post('/single', ...)`); el punto de montaje vive en `server.ts`: `app.use('/api/chat', chatRoutes)` → URL final `/api/chat/single`.
- Anti-patrón detectado en el camino: poner el prefijo dentro del router (`` router.post(`${pathBase}/single`) ``). Dos males: el path quedó sin `/` inicial (Express nunca lo matchea) y el prefijo deja de estar en un solo lugar. Regla: **el router no sabe dónde vive** — así se re-monta sin tocar sus rutas.

## Middleware del server

Orden en `server.ts`:

```ts
app.use(cors({ origin: 'http://localhost:3000' }));  // browser bloquea cross-origin sin esto
app.use(express.json());                              // sin esto req.body = undefined
app.use('/api/chat', chatRoutes);
```

- **CORS**: requests de `localhost:3000` → `localhost:4000` son cross-origin; el browser exige que el server los autorice por header. Origen explícito, no `*` (hábito de producción).
- **`express.json()`** parsea body JSON. Va antes de las rutas que lo usan.

## Validar en el borde (400 temprano)

`prompt` faltante → `400` con mensaje claro, antes de llamar a Gemini. Si dejas pasar `undefined`: error críptico del SDK sobre `contents`, latencia y tokens gastados en descubrirlo. El borde del sistema es el lugar barato para fallar.

## La llamada a Gemini

```ts
const response = await ai.models.generateContent({
    model: model ?? DEFAULT_MODEL,
    contents: prompt,
    config: {
        systemInstruction: 'Eres un asistente útil y conciso.',
        temperature,
        maxOutputTokens,
    },
});
res.json({ message: response.text });
```

- `contents` acepta string simple — el SDK lo envuelve en la estructura `[{ role, parts }]` completa.
- `systemInstruction` va en `config`: personalidad/reglas fuera del turno del usuario.
- `response.text` es un getter que concatena las partes de texto del primer candidato (y excluye partes de *thinking*). Puede ser `undefined`.
- Handler `async` + Express 5: si `generateContent` lanza, el error va solo al middleware de errores — sin try/catch obligatorio.

## Incidente real: modelo retirado para cuentas nuevas

`gemini-2.5-flash` respondió `404: no longer available to new users` — la API key es de cuenta nueva y Google retiró ese modelo para ellas (aunque `/v1beta/models` todavía lo lista). Fix: `DEFAULT_MODEL = 'gemini-flash-latest'` — **alias estable** que Google mantiene apuntando al flash vigente; inmune a retiros de versiones puntuales. Moraleja: para un lab, alias `-latest`; para producción, versión pineada + plan de migración.

Cómo ver los modelos que TU key puede usar:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
```

## Parámetros opcionales (2.3)

| Param | Qué hace | Notas |
|---|---|---|
| `temperature` | Aleatoriedad en selección de tokens. Rango Gemini **0–2** | `0` ≈ determinista (extracción, código); `2` aplana la distribución (creatividad, más riesgo de divagar) |
| `maxOutputTokens` | Techo de tokens de la **respuesta** | Corte duro (frases a medias). En modelos con thinking, el razonamiento cuenta contra el límite — muy bajo puede dar respuesta vacía |
| `model` | Override por request | Mismo endpoint sirve flash y pro sin duplicar código |

- **`undefined` pass-through**: campo `undefined` en `config` = como no mandarlo; Gemini usa su default. Por eso no hacen falta `if`s por parámetro.
- **`??` vs `||`**: `model ?? DEFAULT_MODEL`. Con `||`, valores falsy legítimos caen al default — `temperature: 0 || 1` daría `1`. `??` solo actúa sobre `null`/`undefined`.
- **Lección empírica**: temp 2 con prompt ultra-acotado ("dame un nombre para un gato") repitió la misma respuesta — temperature deforma la distribución, pero un token muy dominante sigue ganando. La variación se nota en prompts abiertos.
- Otra empírica: "¿qué es un ODM?" sin contexto → "Original Design Manufacturer", no Mongoose. Sin contexto el modelo elige la acepción más común — eso arreglan `systemInstruction` y el historial (fase 3).

## Verificar código contra la fuente

Ante duda sobre la API del SDK, el árbitro es el paquete instalado — es la verdad de TU versión, no la del tutorial:

- `node_modules/@google/genai/dist/genai.d.ts` — tipos + ejemplos oficiales en JSDoc (`generateContent` ~línea 5160, `GenerateContentConfig.systemInstruction` línea 4967)
- `node_modules/@google/genai/README.md` — quickstart
- Web: https://ai.google.dev/gemini-api/docs/text-generation y https://googleapis.github.io/js-genai/
