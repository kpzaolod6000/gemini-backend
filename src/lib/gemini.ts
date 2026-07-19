import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no definida en .env');
}

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const DEFAULT_MODEL = 'gemini-2.5-flash';