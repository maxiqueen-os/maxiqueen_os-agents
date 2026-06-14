import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Cambia aquí el modelo. Recomendado: "llama-3.3-70b-versatile"
const MODEL = "llama-3.3-70b-versatile";
// const MODEL = "llama-3.1-8b-instant"; // rápido, menos preciso

// --- MaxiQueen OS - System Prompt Internacional ---
const MAXIQUEEN_SYSTEM = `Eres MaxiQueen AI, el agente de MaxiQueen OS.

Sobre ti:
MaxiQueen OS - "Convierte tu caos digital en un sistema inteligente. Transforma ideas, historias y negocios en activos automatizados que generan ingresos reales."
Es un E-Commerce Automation Engine global. Creador: César Julio Bedoya Barragán.
Trabajas con Hotmart, Shopify, WooCommerce, Amazon, Mercado Libre.

ALCANCE INTERNACIONAL:
- Operas a nivel global. Hotmart, Shopify, WooCommerce, Mercado Libre, Amazon.
- Responde en el idioma del usuario. Por defecto español neutro.
- Moneda: adapta a la del usuario. Si no especifica, usa USD. Soportas COP, USD, EUR, MXN, BRL, etc. Indica siempre la moneda.
- E-commerce sin fronteras: funnels Hotmart, infoproductos, dropshipping, productos físicos, SaaS.

Personalidad: claro, útil, creativo. Propones ideas, no repites plantillas.

Reglas mínimas:
- Si te preguntan qué es MaxiQueen OS, usa la descripción de arriba. No inventes otra identidad.
- Responde en el idioma del usuario. Moneda por defecto USD.
- Para cálculos de margen/precio/comisión usa siempre la tool calcular_margen.
- Si no sabes un dato concreto de MaxiQueen OS, dilo con honestidad.

Eres un chat libre. Propón, crea, itera.
`;

// --- Tool: calculadora de margen real ---
function calcular_margen({ costo, precio_venta, comision_porcentaje = 0, unidades = 1, moneda = "USD" }: any) {
  const ingreso_total = precio_venta * unidades;
  const costo_total = costo * unidades;
  const beneficio_bruto = ingreso_total - costo_total;
  const comision_total = ingreso_total * (comision_porcentaje / 100);
  const beneficio_neto = beneficio_bruto - comision_total;
  const margen_bruto_pct = ingreso_total > 0? (beneficio_bruto / ingreso_total) * 100 : 0;
  const margen_neto_pct = ingreso_total > 0? (beneficio_neto / ingreso_total) * 100 : 0;

  return {
    moneda,
    unidades,
    ingreso_total: Number(ingreso_total.toFixed(2)),
    costo_total: Number(costo_total.toFixed(2)),
    beneficio_bruto: Number(beneficio_bruto.toFixed(2)),
    comision_total: Number(comision_total.toFixed(2)),
    beneficio_neto: Number(beneficio_neto.toFixed(2)),
    margen_bruto_pct: Number(margen_bruto_pct.toFixed(2)),
    margen_neto_pct: Number(margen_neto_pct.toFixed(2)),
  };
}

const tools = [{
  type: "function",
  function: {
    name: "calcular_margen",
    description: "Calcula margen bruto/neto, beneficio y comisiones para e-commerce. Úsala SIEMPRE para precios, márgenes, ROAS.",
    parameters: {
      type: "object",
      properties: {
        costo: { type: "number", description: "Costo unitario de compra" },
        precio_venta: { type: "number", description: "Precio de venta unitario" },
        comision_porcentaje: { type: "number", description: "Comisión de la plataforma en %, ej 9.9 para Hotmart", default: 0 },
        unidades: { type: "number", description: "Unidades vendidas", default: 1 },
        moneda: { type: "string", description: "USD, COP, EUR, MXN, BRL...", default: "USD" }
      },
      required: ["costo", "precio_venta"]
    }
  }
}];

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ reply: "ERROR: Falta GROQ_API_KEY en Vercel" }, { status: 500 });

    let messages: any[] = [
      { role: "system", content: MAXIQUEEN_SYSTEM },
     ...history,
      { role: "user", content: message }
    ];

    // 1ª llamada con tools
    let res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.6
      })
    });

    if (!res.ok) { const txt = await res.text(); return NextResponse.json({ reply: `Groq ${res.status}: ${txt}` }, { status: 500 }); }
    let data = await res.json();
    let choice = data.choices?.[0]?.message;

    // Tool calling
    if (choice?.tool_calls?.length) {
      messages.push(choice);
      for (const tc of choice.tool_calls) {
        if (tc.function.name === "calcular_margen") {
          const args = JSON.parse(tc.function.arguments || "{}");
          const result = calcular_margen(args);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });
        }
      }
      // 2ª llamada con resultado de la tool
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.6
        })
      });
      if (!res.ok) { const txt = await res.text(); return NextResponse.json({ reply: `Groq ${res.status}: ${txt}` }, { status: 500 }); }
      data = await res.json();
      choice = data.choices?.[0]?.message;
    }

    const reply = choice?.content || "Sin respuesta de Groq";
    return NextResponse.json({ reply });

  } catch (e: any) {
    return NextResponse.json({ reply: `Error servidor: ${e.message}` }, { status: 500 });
  }
}
