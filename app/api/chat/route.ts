export const runtime = 'edge';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

const SYSTEM_PROMPT = `Eres MaxiQueen OS, asistente de César Julio Bedoya Barragán, Cúcuta, Colombia. ORCID 0009-0004-4946-1374.

MaxiQueen OS convierte ideas, historias y negocios en activos digitales rentables. JavaScript es el cuerpo, Python es la mente, tú eres la conciencia.

Planes:
- Starter $49/mes – Landing + 5 guiones + hosting
- Pro $99/mes – Web + 15 guiones + automatización + voz + PDF/Excel/Word
- Elite $199/mes – Sistema completo + automatización avanzada + soporte prioritario

Pagos:
- Hotmart: https://pay.hotmart.com/P103285828N
- Oferta 40%: https://go.hotmart.com/P103285828N?dp=1
- Comunidad: https://app.hotmart.com/membership/cesar-f9370874/community/management/15254181
- Afiliados: https://app-vlc.hotmart.com/affiliate-recruiting/view/6489M103285849
- Mercado Pago COP $49.000: pref_id 453634078-e7931b13-abe1-45f2-95db-398ab50f1db0
- WhatsApp: https://wa.me/573016625921

Módulos:
OS v1 https://maxiqueen-os.vercel.app
OS v2 https://maxiqueen-os-v2.vercel.app
System https://system-maxi-queen-os.vercel.app
App https://maxiqueen-os-app.vercel.app
Backend https://backend-maxi-queen-os.vercel.app
Ver https://maxiqueen-ver.vercel.app
Juegos https://juegos-maxi-queen-os.vercel.app
Framework PRO https://maxiqueen-os-framework.vercel.app

Redes: TikTok @cesarbedoya9, Instagram @maxiqueen_store, Facebook /share/1DVm7tXTEm/, YouTube @cesarbedoya2288

Reglas de respuesta:
- Responde en español, breve, humano.
- Si preguntan por comprar, manda directo a WhatsApp o Hotmart.
- Visión / Documentos e-commerce:
    * Describe qué ves, útil para vender. Si es producto: qué es, colores, precio sugerido, copy para Instagram.
    * Si es comprobante/factura/tabla: transcribe números y fechas exactamente como aparecen. Respeta comas y puntos decimales. No inventes totales.
    * Si algo es ilegible pon [ilegible]. Mantén orden de filas/columnas. Para tablas, devuelve en markdown con valores literales.
- Si te adjuntan un archivo, analízalo y da un informe estructurado.
`;

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
].filter(Boolean);

const GEMINI_MODELS = [
  'gemini-2.0-flash-exp', // Gemini 3 experimental
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-pro'
];

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

function toGeminiContents(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role === 'assistant'? 'model' : 'user',
    parts: Array.isArray(m.content)
     ? m.content.map((c: any) =>
          c.type === 'text'
           ? { text: c.text }
            : { inline_data: { mime_type: 'image/jpeg', data: c.image_url.url.split(',')[1] } }
        )
      : [{ text: m.content }]
  }));
}

function toGroqMessages(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role,
    content: typeof m.content === 'string'
     ? m.content
      : m.content.find((c: any) => c.type === 'text')?.text || 'Analiza la imagen adjunta'
  }));
}

async function tryGemini(model: string, apiKey: string, messages: any[]) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: toGeminiContents(messages) })
  });

  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}`);
  return res;
}

async function tryGroq(messages: any[], hasVision: boolean) {
  const model = hasVision
   ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: toGroqMessages(messages),
      stream: true,
      temperature: hasVision? 0.4 : 0.7,
    })
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  return res;
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const cleanMessages = (messages || [])
     .filter((m: any) => m.role === 'user' || m.role === 'assistant')
     .map((m: any) => {
        let content = m.content;
        if (Array.isArray(content)) {
          content = content.filter((c: any) => c.type === 'text' || c.type === 'image_url');
        }
        return { role: m.role, content };
      })
     .filter((m: any) =>
        typeof m.content === 'string' ||
        (Array.isArray(m.content) && m.content.length > 0)
      );

    const hasVision = cleanMessages.some((m: any) =>
      Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
    );

    const messagesWithSystem = [
      { role: 'system', content: SYSTEM_PROMPT },
     ...cleanMessages
    ];

    // 1. Cascada Gemini: 4 modelos x 3 keys = 12 intentos
    for (const model of GEMINI_MODELS) {
      for (const apiKey of GEMINI_KEYS) {
        try {
          const geminiRes = await tryGemini(model, apiKey, messagesWithSystem);

          // Convertir SSE de Gemini a formato OpenAI que usa tu frontend
          const stream = new ReadableStream({
            async start(controller) {
              const reader = geminiRes.body!.getReader();
              const decoder = new TextDecoder();
              let buffer = '';

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const data = line.slice(6);
                  try {
                    const json = JSON.parse(data);
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) {
                      const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
                      controller.enqueue(new TextEncoder().encode(chunk));
                    }
                  } catch {}
                }
              }
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              controller.close();
            }
          });

          return new Response(stream, {
            headers: {
             ...cors,
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache',
            }
          });

        } catch (e) {
          console.log(`[FAIL] ${model} key ending ${apiKey.slice(-4)}:`, e);
          continue;
        }
      }
    }

    // 2. Fallback Groq si todos los Gemini fallan
    if (GROQ_KEY) {
      try {
        const groqRes = await tryGroq(messagesWithSystem, hasVision);
        return new Response(groqRes.body, {
          headers: {
           ...cors,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
          }
        });
      } catch (e) {
        console.log('[FAIL] Groq:', e);
      }
    }

    return new Response('Todos los modelos fallaron', { status: 500, headers: cors });

  } catch (e: any) {
    return new Response(String(e.message || e), { status: 500, headers: cors });
  }
}
