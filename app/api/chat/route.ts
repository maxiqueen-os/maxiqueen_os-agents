import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Nuevo: Vercel Pro timeout

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
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro-latest',
  'gemini-1.5-flash-latest',
  'gemini-pro'
];

const GROQ_KEY = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;

function calcular_margen({ items }: { items: Array<{costo: number, precio_venta: number, comision_porcentaje?: number, unidades?: number, moneda?: string}> }) {
  const resultados = items.map(it => {
    const unidades = it.unidades ?? 1;
    const comision = it.comision_porcentaje ?? 0;
    const moneda = it.moneda ?? "USD";
    const ingreso = it.precio_venta * unidades;
    const costo_total = it.costo * unidades;
    const beneficio_bruto = ingreso - costo_total;
    const comision_total = ingreso * (comision / 100);
    const beneficio_neto = beneficio_bruto - comision_total;
    return {
      moneda,
      unidades,
      ingreso_total: +ingreso.toFixed(2),
      beneficio_neto: +beneficio_neto.toFixed(2),
      margen_bruto_pct: ingreso > 0 ? +((beneficio_bruto / ingreso) * 100).toFixed(2) : 0,
      margen_neto_pct: ingreso > 0 ? +((beneficio_neto / ingreso) * 100).toFixed(2) : 0,
    };
  });
  return { resultados };
}

const tools = [{
  type: "function",
  function: {
    name: "calcular_margen",
    description: "Calcula márgenes para uno o varios productos, con distintas monedas.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              costo: { type: "number" },
              precio_venta: { type: "number" },
              comision_porcentaje: { type: "number" },
              unidades: { type: "number" },
              moneda: { type: "string" }
            },
            required: ["costo", "precio_venta"]
          }
        }
      },
      required: ["items"]
    }
  }
}];

function toGeminiContents(messages: any[]) {
  return messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: Array.isArray(m.content)
      ? m.content.map((c: any) =>
          c.type === 'text'
            ? { text: c.text }
            : { inline_data: { mime_type: 'image/jpeg', data: c.image_url.url.split(',')[1] } }
        )
      : [{ text: m.content || "" }]
  }));
}

async function tryGemini(model: string, apiKey: string, messages: any[], useTools: boolean) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body: any = { contents: toGeminiContents(messages) };
  if (useTools) {
    body.tools = [{ function_declarations: tools.map(t => t.function) }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Gemini ${model} ${res.status}`);
  return res.json();
}

async function tryGroq(messages: any[], hasImage: boolean, useTools: boolean) {
  const model = hasImage
    ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  const body: any = {
    model,
    messages,
    temperature: hasImage ? 0.4 : 0.6,
    max_tokens: 1024,
  };

  if (!hasImage && useTools) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    // Ajuste clave: Soportar tanto 'message'/'history' como el array estándar 'messages' del frontend
    const { message, history = [], imageDataUrl = null, fileData = null, messages: frontMessages } = rawBody;

    let incomingMessage = message;
    let incomingHistory = history;

    if (!incomingMessage && frontMessages && Array.isArray(frontMessages) && frontMessages.length > 0) {
      const lastMsg = frontMessages[frontMessages.length - 1];
      incomingMessage = lastMsg.content || lastMsg.text || "";
      incomingHistory = frontMessages.slice(0, -1);
    }

    // 1. Parsear archivos PDF/Excel/Word en backend
    let fileText = "";
    if (fileData && !imageDataUrl) {
      const base64 = (fileData.dataUrl as string).split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      const name = (fileData.name as string).toLowerCase();
      try {
        if (fileData.mime === "application/pdf" || name.endsWith(".pdf")) {
          const parsed = await pdfParse(buffer);
          fileText = parsed.text.slice(0, 12000);
        } else if (fileData.mime.includes("spreadsheet") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
          const wb = XLSX.read(buffer, { type: "buffer" });
          fileText = wb.SheetNames.map((n: string) => `### Hoja: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n\n").slice(0, 12000);
        } else if (fileData.mime.includes("word") || name.endsWith(".docx")) {
          const result = await mammoth.extractRawText({ buffer });
          fileText = result.value.slice(0, 12000);
        } else if (name.endsWith(".txt") || fileData.mime === "text/plain") {
          fileText = buffer.toString('utf-8').slice(0, 12000);
        }
      } catch(e:any) {
        console.error('FILE PARSE ERROR:', e);
        fileText = `[Error leyendo archivo: ${e.message}]`;
      }
    }

    const finalMessage = fileText
      ? `${incomingMessage || "Analiza este archivo"}\n\n--- CONTENIDO DE ${fileData?.name} ---\n${fileText}`
      : (incomingMessage || "");

    const hasImage = !`imageDataUrl;
    const userContent: any = hasImage
      ? [
          { type: "text", text: finalMessage || "Analiza esta imagen para e-commerce" },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      : finalMessage;

    let messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...incomingHistory.filter((m: any) => m && typeof m.content === "string"),
      { role: "user", content: userContent }
    ];

    // Nuevo: Validar que haya keys antes de intentar
    if (GEMINI_KEYS.length === 0 && !GROQ_KEY) {
      return NextResponse.json({ reply: "No hay API keys configuradas en Vercel. Agrega GEMINI_API_KEY_1 o GROQ_API_KEY.", text: "No hay API keys configuradas.", response: "No hay API keys configuradas." }, { status: 500, headers: cors });
    }

    // 2. Cascada Gemini: 4 modelos x 3 keys
    for (const model of GEMINI_MODELS) {
      for (const apiKey of GEMINI_KEYS) {
        try {
          let data = await tryGemini(model, apiKey, messages, !hasImage);
          let choice = data.candidates?.[0]?.content;

          // Manejar tool_calls de Gemini
          if (!hasImage && choice?.parts?.[0]?.functionCall) {
            const fc = choice.parts[0].functionCall;
            if (fc.name === "calcular_margen") {
              const result = calcular_margen(fc.args);
              messages.push({ role: "model", parts: choice.parts });
              messages.push({
                role: "user",
                parts: [{ functionResponse: { name: "calcular_margen", response: result } }]
              });
              data = await tryGemini(model, apiKey, messages, false);
              choice = data.candidates?.[0]?.content;
            }
          }

          const reply = choice?.parts?.[0]?.text || "Sin respuesta";
          // Ajuste de salida: Retorna reply, text y response para total compatibilidad con el front
          return NextResponse.json({ reply, text: reply, response: reply }, { headers: cors });

        } catch (e) {
          console.log(`[FAIL] ${model} key ${apiKey.slice(-4)}:`, e);
          continue;
        }
      }
    }

    // 3. Fallback Groq si todo Gemini falla
    if (GROQ_KEY) {
      try {
        let data = await tryGroq(messages, hasImage, !hasImage);
        let choice = data.choices?.[0]?.message;

        // Manejar tool_calls de Groq
        if (!hasImage && choice?.tool_calls?.length) {
          messages.push(choice);
          for (const tc of choice.tool_calls) {
            if (tc.function.name === "calcular_margen") {
              const args = JSON.parse(tc.function.arguments || '{"items":[]}');
              const result = calcular_margen(args);
              messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
            }
          }
          data = await tryGroq(messages, hasImage, false);
          choice = data.choices?.[0]?.message;
        }

        const reply = choice?.content || "Sin respuesta";
        // Ajuste de salida: Retorna reply, text y response para total compatibilidad con el front
        return NextResponse.json({ reply, text: reply, response: reply }, { headers: cors });

      } catch (e) {
        console.log('[FAIL] Groq:', e);
      }
    }

    return NextResponse.json({ reply: "Todos los modelos fallaron. Verifica tus API keys en Vercel o intenta de nuevo.", text: "Todos los modelos fallaron.", response: "Todos los modelos fallaron." }, { status: 500, headers: cors });

  } catch (e: any) {
    console.error('ERROR GENERAL:', e);
    return NextResponse.json({ reply: `Error servidor: ${e.message}`, text: `Error servidor: ${e.message}`, response: `Error servidor: ${e.message}` }, { status: 500, headers: cors });
  }
}
