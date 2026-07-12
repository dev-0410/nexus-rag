import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CornerMarks, RegistrationMark } from "@/components/Furniture"
import { ThemeToggle } from "@/components/ThemeToggle"
import { supabase } from "@/lib/supabase"

function humanizeAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("anonymous")) return "Enter your email and password first."
  if (m.includes("invalid login credentials")) return "Incorrect email or password."
  if (m.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link."
  if (m.includes("already registered")) return "That email already has an account. Try signing in."
  if (m.includes("email address") && m.includes("invalid")) return "That email address looks invalid."
  return message
}

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handlePasswordSignIn(mode: "signin" | "signup") {
    if (!email.trim() || !password) {
      toast.error("Enter your email and password first.")
      return
    }
    if (mode === "signup" && password.length < 6) {
      toast.error("Password must be at least 6 characters.")
      return
    }
    setLoading(true)
    try {
      const { error } =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password })
      if (error) throw error
      if (mode === "signup") {
        toast.success("Check your email to confirm your account.")
      } else {
        navigate("/")
      }
    } catch (err) {
      toast.error(err instanceof Error ? humanizeAuthError(err.message) : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      toast.error("Enter your email first.")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      toast.success("Magic link sent — check your email.")
    } catch (err) {
      toast.error(err instanceof Error ? humanizeAuthError(err.message) : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <CornerMarks />

      {/* faint blueprint centerline + registration mark */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 hidden lg:block">
        <div className="absolute left-1/2 top-0 h-full w-px bg-border/60" />
        <RegistrationMark className="absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* top bar: logo mark + meta */}
      <header className="relative z-10 mx-auto flex max-w-[1400px] items-start justify-between px-8 pt-10 md:px-12">
        <div className="flex size-9 items-center justify-center border border-foreground">
          <div className="size-4 rotate-45 bg-foreground" />
        </div>
        <div className="flex items-start gap-10">
          <dl className="hidden space-y-4 text-right sm:block">
            <div>
              <dt className="eyebrow justify-end">Stack</dt>
              <dd className="mt-1 font-mono text-xs text-foreground">FASTAPI · PGVECTOR</dd>
            </div>
            <div>
              <dt className="eyebrow justify-end">Retrieval</dt>
              <dd className="mt-1 font-mono text-xs text-foreground">HYBRID · RRF</dd>
            </div>
          </dl>
          <ThemeToggle />
        </div>
      </header>

      {/* main split */}
      <main className="relative z-10 mx-auto grid max-w-[1400px] gap-16 px-8 pb-20 pt-16 md:px-12 lg:grid-cols-2 lg:gap-24 lg:pt-24">
        {/* left — thesis */}
        <div className="max-w-xl">
          <h1 className="font-display text-6xl font-medium leading-[0.95] tracking-tight sm:text-7xl">
            Nexus
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            A private retrieval engine for your documents. Upload PDFs, slides, and
            notes — then ask anything, with every answer traced back to the exact
            page it came from.
          </p>

          <div className="mt-14 space-y-10">
            <Feature
              index="01"
              title="Bring your own model"
              body="Connect an OpenAI, Anthropic, or free Gemini key. Your key, your data, encrypted at rest."
            />
            <Feature
              index="02"
              title="Hybrid retrieval"
              body="Dense vector search fused with keyword search over Postgres + pgvector for precise recall."
            />
            <Feature
              index="03"
              title="Cited answers"
              body="Every response is grounded in your library and footnoted to its source chunks."
            />
          </div>
        </div>

        {/* right — auth card */}
        <div className="lg:justify-self-end">
          <div className="crop-frame w-full max-w-md border border-border bg-card p-8 md:p-10">
            <p className="eyebrow">Access</p>
            <h2 className="mt-4 font-display text-3xl font-medium tracking-tight">
              Enter the Nexus
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in or create an account to reach your knowledge base.
            </p>

            <Tabs defaultValue="password" className="mt-8">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="magic">Magic link</TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="eyebrow-plain">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="eyebrow-plain">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button className="group flex-1" disabled={loading} onClick={() => handlePasswordSignIn("signin")}>
                    Sign in
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button className="flex-1" variant="outline" disabled={loading} onClick={() => handlePasswordSignIn("signup")}>
                    Create account
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="magic" className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="magic-email" className="eyebrow-plain">Email</Label>
                  <Input id="magic-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <Button className="group w-full" disabled={loading} onClick={handleMagicLink}>
                  Send magic link
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}

function Feature({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-5 border-t border-border pt-5">
      <span className="font-mono text-xs text-muted-foreground">{index}</span>
      <div>
        <h3 className="font-display text-lg font-medium">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
