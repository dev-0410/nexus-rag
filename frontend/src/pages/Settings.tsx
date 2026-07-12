import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppShell } from "@/components/AppShell"
import { api } from "@/lib/api"

type ChatProvider = "openai" | "anthropic" | "gemini"
type EmbeddingProvider = "openai" | "gemini"

type SettingsData = {
  chat_provider: ChatProvider
  chat_model: string | null
  chat_api_key_masked: string | null
  embedding_provider: EmbeddingProvider
  embedding_model: string | null
  embedding_api_key_masked: string | null
}

const CHAT_MODEL_PLACEHOLDER: Record<ChatProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  gemini: "gemini-flash-latest",
}

export function SettingsPage() {
  const [current, setCurrent] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [chatProvider, setChatProvider] = useState<ChatProvider>("openai")
  const [chatApiKey, setChatApiKey] = useState("")
  const [chatModel, setChatModel] = useState("")
  const [embeddingApiKey, setEmbeddingApiKey] = useState("")
  const [embeddingModel, setEmbeddingModel] = useState("")

  useEffect(() => {
    api
      .get<SettingsData | null>("/settings")
      .then((data) => {
        if (data) {
          setCurrent(data)
          setChatProvider(data.chat_provider)
          setChatModel(data.chat_model ?? "")
          setEmbeddingModel(data.embedding_model ?? "")
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false))
  }, [])

  // Anthropic has no embeddings API, so it needs a separate OpenAI key for embeddings.
  // OpenAI and Gemini each do chat + embeddings with a single key.
  const needsSeparateEmbeddingKey = chatProvider === "anthropic"
  const embeddingProvider: EmbeddingProvider = chatProvider === "anthropic" ? "openai" : chatProvider

  async function handleSave() {
    if (!chatApiKey && !current?.chat_api_key_masked) {
      toast.error("Enter your chat provider API key")
      return
    }
    if (needsSeparateEmbeddingKey && !embeddingApiKey && !current?.embedding_api_key_masked) {
      toast.error("Anthropic has no embeddings API — enter an OpenAI key for embeddings")
      return
    }

    setSaving(true)
    try {
      const payload = {
        chat_provider: chatProvider,
        chat_api_key: chatApiKey || undefined,
        chat_model: chatModel || undefined,
        embedding_provider: embeddingProvider,
        embedding_api_key: needsSeparateEmbeddingKey
          ? embeddingApiKey || undefined
          : embeddingApiKey || chatApiKey || undefined,
        embedding_model: embeddingModel || undefined,
      }
      const result = await api.put<SettingsData>("/settings", payload)
      setCurrent(result)
      setChatApiKey("")
      setEmbeddingApiKey("")
      toast.success("Settings saved and verified")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[calc(100svh-4rem)] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="max-w-2xl space-y-12 py-12">
        <div className="border-b border-border pb-8">
          <p className="eyebrow">Settings</p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">Configuration</h1>
          <p className="mt-2 text-muted-foreground">Bring your own API key to power chat and retrieval.</p>
        </div>

        <section className="space-y-5">
          <div>
            <p className="eyebrow-plain mb-1">01 — Chat provider</p>
            <h2 className="font-display text-xl font-medium">Generation</h2>
            <p className="mt-1 text-sm text-muted-foreground">Used to generate answers from retrieved context.</p>
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={chatProvider} onValueChange={(v) => setChatProvider(v as ChatProvider)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini (free tier)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chat-key">API key</Label>
            <Input
              id="chat-key"
              type="password"
              value={chatApiKey}
              onChange={(e) => setChatApiKey(e.target.value)}
              placeholder={current?.chat_api_key_masked ?? (chatProvider === "gemini" ? "AIza…" : "sk-…")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chat-model">Model (optional)</Label>
            <Input
              id="chat-model"
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
              placeholder={CHAT_MODEL_PLACEHOLDER[chatProvider]}
            />
          </div>
        </section>

        {needsSeparateEmbeddingKey && (
          <section className="space-y-5 border-t border-border pt-10">
            <div>
              <p className="eyebrow-plain mb-1">02 — Embedding provider</p>
              <h2 className="font-display text-xl font-medium">Retrieval</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Anthropic has no embeddings API — an OpenAI key is required to embed and search your documents.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="embed-key">OpenAI API key</Label>
              <Input
                id="embed-key"
                type="password"
                value={embeddingApiKey}
                onChange={(e) => setEmbeddingApiKey(e.target.value)}
                placeholder={current?.embedding_api_key_masked ?? "sk-…"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="embed-model">Embedding model (optional)</Label>
              <Input
                id="embed-model"
                value={embeddingModel}
                onChange={(e) => setEmbeddingModel(e.target.value)}
                placeholder="text-embedding-3-small"
              />
            </div>
          </section>
        )}

        <div className="flex justify-end border-t border-border pt-8">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save & verify"}
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
