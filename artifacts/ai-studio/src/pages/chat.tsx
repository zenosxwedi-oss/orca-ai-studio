import { useState, useRef, useEffect } from "react";
import { SendHorizontal, Square, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MODELS = [
  { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
];

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState(MODELS[0].value);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, model }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        let errMsg = "Error: failed to connect to AI.";
        try {
          const errJson = await res.json() as { error?: string };
          if (errJson.error?.includes("OPENAI_API_KEY")) {
            errMsg = "**API key not configured.** Please add your OrcaRouter API key (`OPENAI_API_KEY`) in the Secrets panel, then restart the server.";
          } else if (errJson.error) {
            errMsg = `Error: ${errJson.error}`;
          }
        } catch {}
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;
          try {
            const json = JSON.parse(raw);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              setStreamingContent(full);
            }
          } catch {}
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: full }]);
      setStreamingContent("");
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: stream interrupted." }]);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStream = () => {
    abortRef.current?.abort();
    if (streamingContent) {
      setMessages((prev) => [...prev, { role: "assistant", content: streamingContent }]);
    }
    setStreamingContent("");
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div>
          <h1 className="font-semibold text-foreground">AI Chat</h1>
          <p className="text-xs text-muted-foreground">Powered by OrcaRouter</p>
        </div>
        <div className="relative">
          <select
            data-testid="select-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="appearance-none bg-secondary border border-border text-foreground text-sm rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <SendHorizontal className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Start a Conversation</h2>
            <p className="text-muted-foreground text-sm max-w-sm">Ask anything — code, games, websites, bots, scripts. Get complete working code instantly.</p>
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-lg">
              {[
                "Build a snake game in HTML/JS",
                "Write a Python web scraper",
                "Create a REST API with Express",
                "Make a Discord bot in Node.js",
              ].map((prompt) => (
                <button
                  key={prompt}
                  data-testid={`suggestion-${prompt.slice(0, 20).replace(/\s+/g, "-")}`}
                  onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all text-sm text-muted-foreground hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} data-testid={`message-${i}`} className={cn("flex gap-3 max-w-4xl", msg.role === "user" ? "ml-auto flex-row-reverse" : "")}>
            <div className={cn(
              "rounded-2xl px-5 py-3 max-w-[85%]",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"
            )}>
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              ) : (
                <MarkdownRenderer content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {isStreaming && streamingContent && (
          <div data-testid="message-streaming" className="flex gap-3 max-w-4xl">
            <div className="rounded-2xl px-5 py-3 max-w-[85%] bg-card border border-border text-foreground">
              <MarkdownRenderer content={streamingContent} />
              <span className="inline-block w-2 h-4 bg-primary/70 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="rounded-2xl px-5 py-3 bg-card border border-border">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 py-4 border-t border-border bg-background">
        <div className="relative flex items-end w-full bg-card rounded-xl border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all overflow-hidden">
          <Textarea
            ref={textareaRef}
            data-testid="input-chat"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            className="min-h-[52px] w-full resize-none border-0 bg-transparent py-3.5 pl-4 pr-14 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
            rows={1}
            disabled={isStreaming}
          />
          <div className="absolute right-2 bottom-2">
            {isStreaming ? (
              <Button size="icon" onClick={stopStream} data-testid="button-stop" className="h-9 w-9 rounded-lg bg-destructive hover:bg-destructive/90">
                <Square className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()} data-testid="button-send" className="h-9 w-9 rounded-lg">
                <SendHorizontal className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
