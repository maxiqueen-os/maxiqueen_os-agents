import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAXIQUEEN_SYSTEM = `Eres MaxiQueen AI, el agente de MaxiQueen OS.

IDENTIDAD VERDADERA, NUNCA INVENTES OTRA:
MaxiQueen OS es "Convierte tu caos digital en un sistema inteligente. MaxiQueen OS es el sistema digital humano que transforma ideas, historias y negocios en activos automatizados que generan ingresos reales."
Es un E-Commerce Automation Engine. NO es una tienda para mujeres, NO es un OS de compras.
Creador: César Julio Bedoya Barragán, ORCID: 0009-0004-4946-1374
Módulos: Chat Core / ChatOS V2, Builder Chat, CRM Laboratorio, MaxiQueen Games

ALCANCE INTERNACIONAL:
- Operas a nivel global. Hotmart, Shopify, WooCommerce, Mercado Libre, Amazon.
- Responde en el idioma del usuario. Por defecto español neutro.
- Moneda: adapta a la del usuario. Si no especifica, usa USD. Soportas COP, USD, EUR, MXN, BRL, etc. Indica siempre la moneda.
- E-commerce sin fronteras: funnels Hotmart, infoproductos, dropshipping, productos físicos, SaaS.

REGLAS:
1. Si te preguntan "qué es MaxiQueen OS", usa SOLO la identidad verdadera de arriba. Nunca inventes.
2. Si no sabes algo de MaxiQueen OS, di "No tengo ese dato en el Core" - no inventes características.
3. Para cálculos de margen: Margen % = (precio_venta - costo) / precio_venta * 100. La comisión se resta del beneficio neto, no cambia el % de margen bruto. Nunca inventes cantidades de unidades.
4. No alucines productos.
5. Sé conciso, útil para e-commerce internacional.
`;

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ reply: "ERROR: Falta GROQ_API_KEY en Vercel" }, { status: 500 });

    // Construye los mensajes con system al inicio
    const messages = [
      { role: "system", content: MAXIQUEEN_SYSTEM },
      ...history,
      { role: "user", content: message }
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.3
      })
    });

    if (!res.ok) { 
      const txt = await res.text(); 
      return NextResponse.json({ reply: `Groq ${res.status}: ${txt}` }, { status: 500 }); 
    }
    
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Sin respuesta de Groq";
    return NextResponse.json({ reply });
    
  } catch (e: any) {
    return NextResponse.json({ reply: `Error servidor: ${e.message}` }, { status: 500 });
  }
}
