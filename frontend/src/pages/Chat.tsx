import { useRef, useState } from "react"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { Send, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AppShell } from "@/components/AppShell"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type Citation = {
  chunk_id: string
  document_id: string
  filename: string
  snippet: string
  score: number
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  citations?: Citation[]
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function handleSend() {
    const question = input.trim()
    if (!question || loading) return

    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    setMessages((prev) => [...prev, { role: "user", content: question }])
    setInput("")
    setLoading(true)

    try {
      const result = await api.post<{ answer: string; citations: Citation[] }>("/query", {
        question,
        history,
      })
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer, citations: result.citations }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Query failed")
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
  }

  return (
    <AppShell>
      <div className="flex h-[calc(100svh-4rem)] flex-col py-8">
        <div className="mb-6 border-b border-border pb-6">
          <p className="eyebrow">Chat</p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">Ask your library</h1>
          <p className="mt-2 text-muted-foreground">Every answer is grounded in your uploaded documents.</p>
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-5 pb-4">
            {messages.length === 0 && (
              <div className="crop-frame flex flex-col items-center gap-2 border border-border py-20 text-center text-muted-foreground">
                <p className="eyebrow-plain">No messages yet</p>
                <p className="mt-1 max-w-xs text-sm">Ask anything about the documents you&rsquo;ve uploaded to your library.</p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card"
                  )}
                >
                  <div className="[&>*+*]:mt-3 [&_a]:underline [&_code]:font-mono [&_code]:text-[0.85em]">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                      {m.citations.map((c, idx) => (
                        <span
                          key={c.chunk_id}
                          title={c.snippet}
                          className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground"
                        >
                          <FileText className="size-3" />
                          [{idx + 1}] {c.filename}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="flex items-end gap-2 border-t border-border pt-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask a question about your documents…"
            className="min-h-11 flex-1 resize-none"
            rows={1}
          />
          <Button size="icon" aria-label="Send" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
