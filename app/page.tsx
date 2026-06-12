"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    // ARREGLO 1: guarda el historial en una variable para no usar el state viejo
    const newHistory = [...messages, userMessage];

    setMessages(newHistory);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }), // <- usa newHistory
      });

      if (!response.ok) throw new Error("Error en la API");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // ARREGLO 2: usa "assistant" en vez de "model" (estándar)
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          assistantContent += text;

          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: assistantContent };
            return updated;
          });
        }
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error al conectar con MaxiQueen AI." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ARREGLO 3: auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-[#09090b] text-white font-sans p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/30 via-zinc-950 to-black z-0" />

      <header className="z-10 w-full max-w-2xl text-center py-6 border-b border-purple-500/20 backdrop-blur-md">
        <h1 className="text-3xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
          MAXIQUEEN OS
        </h1>
        <p className="text-zinc-500 text-xs uppercase tracking-widest mt-1">
          E-Commerce Automation Engine
        </p>
      </header>

      <section className="z-10 flex-1 w-full max-w-2xl my-4 overflow-y-auto p-4 rounded-xl border border-zinc-800 bg-black/40 backdrop-blur-md flex flex-col gap-4 max-h-[60vh]">
        {messages.length === 0? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-center p-8 space-y-2">
            <p className="text-sm uppercase tracking-wider text-purple-400">Sistema Activo</p>
            <p className="text-xs max-w-xs">Pregúntame sobre la tienda de ropa, zapatos o las automatizaciones de MaxiQueen.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col max-w-[85%] p-3 rounded-xl border text-sm ${
                msg.role === "user"
                 ? "bg-purple-950/40 border-purple-500/30 self-end text-purple-100"
                  : "bg-zinc-900/60 border-zinc-800 self-start text-zinc-200"
              }`}
            >
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 font-bold">
                {msg.role === "user"? "Tú" : "MaxiQueen AI"}
              </span>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="text-xs text-cyan-400 animate-pulse uppercase tracking-widest self-start bg-cyan-950/20 border border-cyan-500/20 px-3 py-1 rounded-full">
            Procesando datos...
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <footer className="z-10 w-full max-w-2xl pb-6">
        <form onSubmit={handleSubmit} className="flex gap-2 w-full">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe un mensaje al agente..."
            className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading ||!input.trim()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] uppercase tracking-wider"
          >
            Enviar
          </button>
        </form>
      </footer>
    </main>
  );
}
