import { supabase } from "@/lib/supabase"

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`/api${path}`, { headers: await authHeader() })
    return handle<T>(res)
  },

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: "PUT",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return handle<T>(res)
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return handle<T>(res)
  },

  async postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: await authHeader(),
      body: form,
    })
    return handle<T>(res)
  },

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: "DELETE",
      headers: await authHeader(),
    })
    return handle<T>(res)
  },
}
