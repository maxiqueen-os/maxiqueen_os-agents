"use client";
import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

function cleanHistory(history: Msg[]) {
  return history
   .filter(m => m.role === "user" || m.role === "assistant")
   .map(({ role, content }) => ({ role, content }))
   .filter((m, i, arr) => i === 0 || m.content.trim()!== arr[i-1].content.trim())
   .slice(-12);
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Soy MaxiQueen OS, inteligencia local. ¿En qué te ayudo hoy? Puedes adjuntar imágenes, PDF, Word o Excel." }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voz
  const [voiceOn, setVoiceOn] = useState(true);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const lastSpokenRef = useRef<string>("");

  const speak = (text: string) => {
    if (typeof window === "undefined" ||!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const es = voices.find(v => v.lang.startsWith("es-CO")) || voices.find(v => v.lang.startsWith("es"));
    if (es) u.voice = es;
    u.rate = rate;
    u.volume = volume;
    u.lang = "es-ES";
    lastSpokenRef.current = text;
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    if (typeof window!== "undefined") window.speechSynthesis.getVoices();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      alert("Máx 10MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() &&!file) || isLoading) return;

    let userText = input.trim();
    if (file) userText += (userText? "\n\n" : "") + `[Archivo adjunto: ${file.name} ${(file.size/1024/1024).toFixed(2)} MB]`;

    const userMsg: Msg = { role: "user", content: userText };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(true);

    try {
      const historyForApi = cleanHistory(messages);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, history: historyForApi }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const { reply } = await res.json();

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      if (voiceOn) speak(reply);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlay = () => {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (last) speak(last.content);
  };
  const handleRepeat = () => { if (lastSpokenRef.current) speak(lastSpokenRef.current); };
  const handleStop = () => { if (typeof window!== "undefined") window.speechSynthesis.cancel(); };

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#09090b] text-white font-sans p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/30 via-zinc-950 to-black -z-0" />

      <header className="z-10 w-full max-w-2xl text-center py-6 border-b border-purple-500/20">
        <h1 className="text-3xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-cyan-400">
          MAXIQUEEN OS
        </h1>
        <p className="text-purple-300 text-xs uppercase tracking-widest mt-1 font-bold">ARQUITECTURA DIGITAL INCORRUPTIBLE</p>
        <p className="text-zinc-500 text-[11px] uppercase tracking-widest mt-1">INTELIGENCIA LOCAL • ÉLITE ESTRATÉGICA</p>
      </header>

      <section className="z-10 flex-1 w-full max-w-2xl my-4 overflow-y-auto p-4 rounded-xl border border-zinc-800 bg-black/40 backdrop-blur-md flex flex-col gap-4 max-h-[55vh]">
        {messages.map((msg, idx) => (
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
        ))}
        {isLoading && (
          <div className="text-xs text-cyan-400 animate-pulse uppercase tracking-widest self-start">Procesando datos...</div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <footer className="z-10 w-full max-w-2xl pb-4 space-y-2">
        {file && (
          <div className="text-xs text-zinc-400 bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 flex justify-between items-center">
            <span>📎 {file.name} – {(file.size/1024/1024).toFixed(2)} MB</span>
            <button onClick={() => { setFile(null); if(fileInputRef.current) fileInputRef.current.value = ""; }} className="text-zinc-500 hover:text-white">✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 w-full items-center">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-sm hover:border-purple-500"
            title="Adjuntar archivo">
            📎
          </button>
          <input ref={fileInputRef} type="file" className="hidden"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileChange} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe o adjunta un archivo..."
            className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || (!input.trim() &&!file)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-sm uppercase tracking-wider">
            Enviar
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2">
          <button onClick={() => setVoiceOn(v =>!v)} className={voiceOn? "text-cyan-400" : ""}>
            🔊 Voz {voiceOn? "ON" : "OFF"}
          </button>
          <button onClick={handlePlay} className="hover:text-white">▶ Reproducir</button>
          <button onClick={handleRepeat} className="hover:text-white">🔁 Repetir</button>
          <button onClick={handleStop} className="hover:text-white">⏹ Detener</button>
          <label className="flex items-center gap-1">Vol
            <input type="range" min="0" max="1" step="0.1" value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="w-16 accent-purple-500" />
          </label>
          <label className="flex items-center gap-1">Vel
            <input type="range" min="0.7" max="1.5" step="0.1" value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="w-16 accent-purple-500" />
          </label>
        </div>

        <p className="text-[10px] text-zinc-500 text-center">Imágenes, PDF, Word, Excel • máx 10MB</p>
        <p className="text-[10px] text-zinc-600 text-center">MaxiQueen OS © 2026 — Inteligencia Local — Cesar Bedoya Barragán</p>
      </footer>
    </main>
  );
}
