// app/api/chat/route.ts
export async function POST(req) {
  const { message, history = [] } = await req.json()

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Eres MaxiQueen AI, asistente de e-commerce para MaxiQueen OS. Responde en español, breve y útil.' },
       ...history.map(h => ({
          role: h.role === 'model'? 'assistant' : 'user',
          content: h.parts?.[0]?.text || h.content || ''
        })),
        { role: 'user', content: message }
      ]
    })
  })

  const data = await groqRes.json()
  const reply = data.choices?.[0]?.message?.content || 'Sin respuesta'
  return Response.json({ reply })
}
