export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const last = messages.at(-1)?.content?? "";

  const text = `MAXIQUEEN OS online. Recibí: "${last}". Estoy listo para automatizar tu e-commerce.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const c of text) {
        controller.enqueue(encoder.encode(c));
        await new Promise(r => setTimeout(r, 12));
      }
      controller.close();
    }
  });

  return new Response(stream);
}
