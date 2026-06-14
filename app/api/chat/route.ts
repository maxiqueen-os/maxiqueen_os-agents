import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ reply: "ERROR: Falta GROQ_API_KEY en Vercel" }, { status: 500 });
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Eres MaxiQueen AI, asistente de e-commerce para MaxiQueen OS. Responde en español, breve y útil." },
          ...history.filter((h:any) => h.role === "user" || h.role === "assistant").map((h:any) => ({ role: h.role, content: h.content })),
          { role: "user", content: message }
        ],
        temperature: 0.7
      })
    });
    if (!res.ok) { const txt = await res.text(); return NextResponse.json({ reply: `Groq ${res.status}: ${txt}` }, { status: 500 }); }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Sin respuesta de Groq";
    return NextResponse.json({ reply });
  } catch (e:any) {
    return NextResponse.json({ reply: `Error servidor: ${e.message}` }, { status: 500 });
  }
}
