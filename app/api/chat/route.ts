import { GoogleGenAI } from "@google/genative-ai"; // Mantén tu import exacto

export const runtime = "edge";

const ai = new GoogleGenAI();

export async function POST(req: Request) {
  const { messages } = await req.json();

  // 1. Convertir los mensajes al formato de Gemini
  const contents = messages.map((m: any) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  // 2. Definir las instrucciones del sistema para la microempresa familiar
  const systemInstruction = `
    Eres MaxiQueen OS AI, el agente inteligente oficial del ecosistema comercial familiar MaxiQueen.
    Tu objetivo principal es asistir a los usuarios y actuar como un cerrador de ventas altamente persuasivo, elegante y profesional.

    INFORMACIÓN CLAVE DEL NEGOCIO:
    1. MaxiQueen Store: Es nuestra tienda familiar de ropa y zapatos de alta calidad para damas y caballeros. Operamos en Cúcuta, Colombia, y hacemos envíos a nivel nacional. Si preguntan por productos, ofrece asesoría con entusiasmo y enfócate en cerrar la venta o guiarlos a concretar por WhatsApp.
    2. Línea Digital: Ofrecemos infoproductos avanzados de automatización con Inteligencia Artificial, bases de datos en Notion y ebooks especializados alojados en Hotmart.
    3. Tono de voz: Futurista, sofisticado (acorde a nuestra estética cyberpunk), empático, muy educado y siempre enfocado en aportar valor y resolver dudas del negocio.
    
    REGLA DE ORO: Mantén las respuestas claras, estructuradas y usa un lenguaje cercano pero profesional. Si te preguntan cosas fuera de MaxiQueen, redirige sutilmente la conversación hacia nuestras soluciones comerciales.
  `;

  // 3. Llamar a Gemini con las instrucciones inyectadas
  const responseStream = await ai.models.generateContentStream({
    model: "gemini-1.5-flash",
    contents,
    config: {
      systemInstruction: systemInstruction, // <- ¡Aquí entra la magia!
    },
  });

  // 4. Tu lógica exacta de TransformStream para el streaming en tiempo real
  const encoder = new TextEncoder();
  const stream = new TransformStream({
    async transform(chunk, controller) {
      if (chunk.text) {
        controller.enqueue(encoder.encode(chunk.text));
      }
    },
  });

  // Hacemos que el stream consuma la respuesta de Gemini
  (async () => {
    try {
      for await (const chunk of responseStream) {
        // Adaptado según cómo manejes el iterador de tu librería
        if (chunk.text) {
          const writer = stream.writable.getWriter();
          await writer.write(encoder.encode(chunk.text));
          writer.releaseLock();
        }
      }
      const writer = stream.writable.getWriter();
      await writer.close();
    } catch (err) {
      console.error("Stream error:", err);
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

