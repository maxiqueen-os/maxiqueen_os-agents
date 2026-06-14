import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL_TEXT = "llama-3.3-70b-versatile";
const MODEL_VISION = "meta-llama/llama-4-scout-17b-16e-instruct";

const MAXIQUEEN_SYSTEM = `Eres MaxiQueen AI, agente de MaxiQueen OS.

Identidad: MaxiQueen OS - "Convierte tu caos digital en un sistema inteligente. Transforma ideas, historias y negocios en activos automatizados que generan ingresos reales."
E-Commerce Automation Engine global. Creador: César Julio Bedoya Barragán.

Tu catálogo:
- ChatOS V2, Chat Builder, CRM Laboratorio, Pasarela Hotmart

Reglas:
1. Responde en el idioma del usuario. Moneda por defecto USD.
2. Si te envían una imagen: describe qué ves, útil para e-commerce. Si es un producto, da: qué es, colores, posible precio de venta, copy para Instagram. Si es un comprobante, extrae los datos.
3. Para cálculos de margen usa la tool calcular_margen, solo en modo texto.
4. Cuando te pidan automatizar WhatsApp/e-commerce, ofrece TU catálogo: ChatOS / Chat Builder / CRM Laboratorio. No ofrezcas herramientas externas.

Eres un chat libre. Propón, crea, itera.
`;

function calcular_margen({ items }: { items: Array<{costo: number, precio_venta: number, comision_porcentaje?: number, unidades?: number, moneda?: string}> }) {
  const resultados = items.map(it => {
    const unidades = it.unidades?? 1;
    const comision = it.comision_porcentaje?? 0;
    const moneda = it.moneda?? "USD";
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
      margen_bruto_pct: +((beneficio_bruto / ingreso) * 100).toFixed(2),
      margen_neto_pct: +((beneficio_neto / ingreso) * 100).toFixed(2),
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

export async function POST(req: Request) {
  try {
    const { message, history = [], imageDataUrl = null } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ reply: "ERROR: Falta GROQ_API_KEY" }, { status: 500 });

    const hasImage =!!imageDataUrl;
    const model = hasImage? MODEL_VISION : MODEL_TEXT;

    // construye el mensaje de usuario, con imagen si hay
    const userContent: any = hasImage
     ? [
          { type: "text", text: message || "Analiza esta imagen para e-commerce" },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      : message;

    let messages: any[] = [
      { role: "system", content: MAXIQUEEN_SYSTEM },
     ...history.filter((m: any) => typeof m.content === "string"),
      { role: "user", content: userContent }
    ];

    const body: any = {
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1024,
    };
    // tools solo en modo texto
    if (!hasImage) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    let res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body)
    });

    if (!res.ok) return NextResponse.json({ reply: `Groq ${res.status}: ${await res.text()}` }, { status: 500 });
    let data = await res.json();
    let choice = data.choices?.[0]?.message;

    // tool calling, solo en modo texto
    if (!hasImage && choice?.tool_calls?.length) {
      messages.push(choice);
      for (const tc of choice.tool_calls) {
        if (tc.function.name === "calcular_margen") {
          const args = JSON.parse(tc.function.arguments || '{"items":[]}');
          const result = calcular_margen(args);
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL_TEXT, messages, temperature: 0.6 })
      });
      data = await res.json();
      choice = data.choices?.[0]?.message;
    }

    return NextResponse.json({ reply: choice?.content || "Sin respuesta" });
  } catch (e: any) {
    return NextResponse.json({ reply: `Error servidor: ${e.message}` }, { status: 500 });
  }
}
