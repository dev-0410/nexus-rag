import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { FileText, Image as ImageIcon, Presentation, UploadCloud, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppShell } from "@/components/AppShell"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type Document = {
  id: string
  filename: string
  file_type: "pdf" | "md" | "pptx" | "image"
  status: "processing" | "ready" | "failed"
  page_count: number | null
  error_message: string | null
  created_at: string
}

const ICONS: Record<Document["file_type"], typeof FileText> = {
  pdf: FileText,
  md: FileText,
  pptx: Presentation,
  image: ImageIcon,
}

const STATUS_LABEL: Record<Document["status"], string> = {
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
}

const STATUS_DOT: Record<Document["status"], string> = {
  processing: "bg-muted-foreground/50",
  ready: "bg-primary",
  failed: "bg-destructive",
}

export function Library() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const docs = await api.get<Document[]>("/documents")
      setDocuments(docs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append("file", file)
      try {
        await api.postForm("/documents", form)
        toast.success(`${file.name} ingested successfully`)
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`)
      }
    }
    setUploading(false)
    refresh()
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/documents/${id}`)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document")
    }
  }

  return (
    <AppShell>
      <div className="space-y-10 py-12">
        <div className="border-b border-border pb-8">
          <p className="eyebrow">Library</p>
          <h1 className="mt-4 font-display text-4xl font-medium tracking-tight">Your documents</h1>
          <p className="mt-2 text-muted-foreground">
            Upload files to add them to your knowledge base.
          </p>
        </div>

        <div
          className={cn(
            "crop-frame flex flex-col items-center gap-3 border border-dashed border-border py-16 text-center transition-colors",
            dragActive && "border-foreground bg-secondary"
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          {uploading ? (
            <Loader2 className="size-7 animate-spin text-muted-foreground" />
          ) : (
            <UploadCloud className="size-7 text-muted-foreground" />
          )}
          <div>
            <p className="font-display text-lg font-medium">Drag and drop files here</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
              PDF · MD · PPTX · PNG · JPG · WEBP
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.md,.markdown,.pptx,.png,.jpg,.jpeg,.webp,.gif"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            Browse files
          </Button>
        </div>

        <div>
          <p className="eyebrow mb-4">Ingested · {documents.length}</p>
          {loading && <p className="text-sm text-muted-foreground">Loading documents…</p>}
          {!loading && documents.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents yet — upload one above to get started.</p>
          )}
          {documents.length > 0 && (
            <ul className="divide-y divide-border border-t border-border">
              {documents.map((doc) => {
                const Icon = ICONS[doc.file_type]
                return (
                  <li key={doc.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{doc.filename}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {doc.page_count ? `${doc.page_count} section${doc.page_count === 1 ? "" : "s"} · ` : ""}
                          {new Date(doc.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        {doc.status === "failed" && doc.error_message && (
                          <p className="mt-1 text-xs text-destructive">{doc.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <Badge variant="outline" className="gap-1.5 font-normal">
                        <span className={cn("size-1.5 rounded-full", STATUS_DOT[doc.status])} />
                        {STATUS_LABEL[doc.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${doc.filename}`}
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  )
}
