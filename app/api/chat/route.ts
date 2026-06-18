import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: cors });
}

// =========================================================================
// 1. CAPA DE MENSAJERÍA Y CONFIGURACIÓN (CONCIENCIA)
// =========================================================================
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

// =========================================================================
// 2. CAPA DE HERRAMIENTAS (TOOL ENGINE AISLADO)
// =========================================================================
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

const toolDeclaration = [{
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

// =========================================================================
// 3. CONTROLADORES DE PROVEEDORES (ADAPTER PATTERN)
// =========================================================================
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
  
  // Extraemos las instrucciones del sistema para cumplir las reglas estrictas de Gemini
  const systemMessage = messages.find(m => m.role === "system");
  const chatMessages = messages.filter(m => m.role !== "system");

  const body: any = { 
    contents: toGeminiContents(chatMessages) 
  };

  if (systemMessage) {
    body.system_instruction = {
      parts: [{ text: systemMessage.content }]
    };
  }

  if (useTools) {
    body.tools = [{ function_declarations: toolDeclaration.map(t => t.function) }];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Gemini_Error:${res.status}`);
  return res.json();
}

async function tryGroq(messages: any[], hasImage: boolean, useTools: boolean) {
  const groqKey = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("Groq_Key_Missing");

  // Corrección de identificador del modelo de visión oficial de Groq
  const model = hasImage ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';
  const body: any = {
    model,
    messages,
    temperature: hasImage ? 0.4 : 0.6,
    max_tokens: 1024,
  };

  if (!hasImage && useTools) {
    body.tools = toolDeclaration;
    body.tool_choice = "auto";
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error(`Groq_Error:${res.status}`);
  return res.json();
}

// =========================================================================
// 4. ORQUESTADOR CENTRAL (ROUTER IA)
// =========================================================================
export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const { message, history = [], imageDataUrl = null, messages: frontMessages, fileData = null } = rawBody;

    if (fileData && !imageDataUrl) {
      return NextResponse.json({ 
        reply: "Para analizar archivos (PDF, Excel o Word) de forma 100% gratuita, asegúrate de activar el extractor del Frontend. El chat principal solo procesa texto directo e imágenes para mantener el ecosistema optimizado.",
        text: "Usa el extractor optimizado del frontend",
        response: "Usa el extractor optimizado del frontend" 
      }, { headers: cors });
    }

    let incomingMessage = message;
    let incomingHistory = history;

    if (!incomingMessage && frontMessages && Array.isArray(frontMessages) && frontMessages.length > 0) {
      const lastMsg = frontMessages[frontMessages.length - 1];
      incomingMessage = lastMsg.content || lastMsg.text || "";
      incomingHistory = frontMessages.slice(0, -1);
    }

    const finalMessage = incomingMessage || "";
    const hasImage = !!imageDataUrl;
    
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

    const geminiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean);

    const geminiModels = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash-latest',
      'gemini-pro'
    ];

    // --- FLUJO LINEAL ANTI-EXPLOSIÓN COMBINATORIA ---
    for (const apiKey of geminiKeys) {
      for (const model of geminiModels) {
        try {
          let data = await tryGemini(model, apiKey, messages, !hasImage);
          let choice = data.candidates?.[0]?.content;

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
          return NextResponse.json({ reply, text: reply, response: reply }, { headers: cors });

        } catch (e: any) {
          console.log(`[FAILOVER-GEMINI] Modelo ${model} falló con llave activa:`, e.message);
          if (e.message.includes("429")) break; 
          continue; 
        }
      }
    }

    // --- FALLBACK ABSOLUTO CON GROQ ---
    try {
      let data = await tryGroq(messages, hasImage, !hasImage);
      let choice = data.choices?.[0]?.message;

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
      return NextResponse.json({ reply, text: reply, response: reply }, { headers: cors });

    } catch (e: any) {
      console.log('[FALLBACK-CRÍTICO] Groq también falló:', e.message);
    }

    return NextResponse.json(
      { reply: "Todos los recursos gratuitos y llaves de respaldo se encuentran agotados actualmente." }, 
      { status: 500, headers: cors }
    );

  } catch (e: any) {
    console.error('ERROR CRÍTICO DEL SERVIDOR:', e);
    return NextResponse.json({ reply: `Error interno de MaxiQueen OS: ${e.message}` }, { status: 500, headers: cors });
  }
}
