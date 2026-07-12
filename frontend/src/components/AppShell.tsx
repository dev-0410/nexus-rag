import { type ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/", label: "Library" },
  { to: "/chat", label: "Chat" },
  { to: "/settings", label: "Settings" },
]

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { session } = useAuth()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/login")
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 md:px-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center border border-foreground">
                <div className="size-3 rotate-45 bg-foreground" />
              </div>
              <span className="font-display text-lg font-medium tracking-tight">Nexus</span>
            </div>
            <nav className="flex items-center gap-6">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "font-mono text-xs uppercase tracking-[0.15em] transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <span className="mr-1 hidden font-mono text-xs text-muted-foreground md:inline">
              {session?.user.email}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 md:px-10">{children}</main>
    </div>
  )
}
