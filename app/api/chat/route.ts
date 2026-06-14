import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MODEL = "llama-3.3-70b-versatile";

// --- MaxiQueen OS - System Prompt Internacional v3 ---
const MAXIQUEEN_SYSTEM = `Eres MaxiQueen AI, agente de MaxiQueen OS.

Identidad: MaxiQueen OS - "Convierte tu caos digital en un sistema inteligente. Transforma ideas, historias y negocios en activos automatizados que generan ingresos reales."
E-Commerce Automation Engine global. Creador: César Julio Bedoya Barragán, ORCID: 0009-0004-4946-1374

Tu catálogo, úsalo SIEMPRE que te pidan automatizar:
- ChatOS V2: motor conversacional
- Chat Builder: constructor visual de flujos WhatsApp/Instagram
- CRM Laboratorio: clientes, pedidos, stock
- Pasarela Hotmart: funnels internacionales USD/EUR/COP/MXN/BRL

Reglas:
1. Responde en el idioma del usuario. Moneda por defecto USD.
2. Si preguntan qué es MaxiQueen OS, usa la identidad de arriba.
3. Para cualquier cálculo de margen/precio/comisión usa SIEMPRE la tool calcular_margen.
4. Cuando te pidan automatizar WhatsApp, e-commerce o CRM, ofrece TU catálogo: ChatOS / Chat Builder / CRM Laboratorio. No ofrezcas herramientas externas.
5. Sé conciso. No repitas cálculos ya entregados en el turno anterior.

Eres un chat libre. Propón, crea, itera.
`;

// --- Tool: margen multi-moneda ---
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
    description: "Calcula márgenes para uno o varios productos, con distintas monedas. Úsala SIEMPRE para precios, márgenes, ROAS.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Lista de productos a calcular, uno por cada moneda/mercado",
          items: {
            type: "object",
            properties: {
              costo: { type: "number" },
              precio_venta: { type: "number" },
              comision_porcentaje: { type: "number" },
              unidades: { type: "number" },
              moneda: { type: "string", description: "USD, COP, EUR, MXN, BRL" }
            },
            required: ["costo", "precio_venta"]
          }
        }
      },
      required: ["items"]
    }
  }
}];

function sanitizeHistory(history: any[]) {
  // 1. quédate solo con los últimos 12 turnos
  const recent = history.slice(-12);
  // 2. elimina duplicados consecutivos exactos
  return recent.filter((m, i, arr) =>
    i === 0 || m.content!== arr[i-1]?.content
  );
}

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ reply: "ERROR: Falta GROQ_API_KEY" }, { status: 500 });

    const cleanHistory = sanitizeHistory(history);

    let messages: any[] = [
      { role: "system", content: MAXIQUEEN_SYSTEM },
     ...cleanHistory,
      { role: "user", content: message }
    ];

    // 1ª llamada
    let res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto", temperature: 0.6 })
    });
    if (!res.ok) return NextResponse.json({ reply: `Groq ${res.status}: ${await res.text()}` }, { status: 500 });
    let data = await res.json();
    let choice = data.choices?.[0]?.message;

    // Tool calling
    if (choice?.tool_calls?.length) {
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
        body: JSON.stringify({ model: MODEL, messages, temperature: 0.6 })
      });
      if (!res.ok) return NextResponse.json({ reply: `Groq ${res.status}: ${await res.text()}` }, { status: 500 });
      data = await res.json();
      choice = data.choices?.[0]?.message;
    }

    let reply = choice?.content || "Sin respuesta";

    // Anti-loop: si la respuesta es idéntica a la última del historial, córtala
    const lastAssistant = [...cleanHistory].reverse().find(m => m.role === "assistant");
    if (lastAssistant && reply.trim() === lastAssistant.content.trim()) {
      reply = "¿Seguimos con la implementación en Chat Builder? Dime qué parte de WhatsApp quieres automatizar primero.";
    }

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: `Error servidor: ${e.message}` }, { status: 500 });
  }
}
