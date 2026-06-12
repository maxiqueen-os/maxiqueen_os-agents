export const runtime = 'edge';
export async function POST(req: Request) {
  const { messages } = await req.json();
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{role:'system',content:'Eres MaxiQueen AI. Responde en español, corto.'},...messages]
    })
  });
  const d = await r.json();
  return new Response(d.choices?.[0]?.message?.content || 'Error');
}
