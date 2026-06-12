import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: groq('llama-3.1-8b-instant'),
    system: 'Eres MaxiQueen AI, asistente de e-commerce de ropa y zapatos en Cúcuta, Colombia. Responde en español, corto y útil.',
    messages,
  });

  return result.toTextStreamResponse();
}
