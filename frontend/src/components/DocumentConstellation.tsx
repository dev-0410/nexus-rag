import { useEffect, useRef } from "react"

/*
  Quiet, monochrome connected-graph. Reads "connected knowledge" without any
  color, glow, or space imagery. Small nodes drift gently and link with thin
  hairlines. Colors are derived from the current theme's foreground so it works
  in both light and pitch-black dark. Subtle pointer parallax only.
*/

type Node = {
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  z: number
  phase: number
}

const NODE_COUNT = 28
const CONNECT_DIST = 150

export function DocumentConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let w = 0
    let h = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let nodes: Node[] = []
    let raf = 0
    const start = performance.now()

    // read the theme foreground so lines/dots match light or dark automatically
    let inkRGB = "10, 10, 10"
    function readInk() {
      const fg = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim()
      // parse hex → rgb triplet
      const hex = fg.replace("#", "")
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16)
        const g = parseInt(hex.slice(2, 4), 16)
        const b = parseInt(hex.slice(4, 6), 16)
        inkRGB = `${r}, ${g}, ${b}`
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.max(1, Math.floor(w * dpr))
      canvas!.height = Math.max(1, Math.floor(h * dpr))
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function build() {
      const cx = w / 2
      const cy = h / 2
      const spread = Math.min(w, h) * 0.5
      nodes = Array.from({ length: NODE_COUNT }, (_, i) => {
        const ang = (i / NODE_COUNT) * Math.PI * 2 + Math.random() * 0.6
        const rad = spread * (0.25 + Math.random() * 0.75)
        const edge = Math.random() * Math.PI * 2
        return {
          x: cx + Math.cos(edge) * (spread + 300),
          y: cy + Math.sin(edge) * (spread + 300),
          tx: cx + Math.cos(ang) * rad,
          ty: cy + Math.sin(ang) * rad * 0.85,
          vx: 0,
          vy: 0,
          z: 0.5 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        }
      })
    }

    function frame(now: number) {
      const t = now - start
      ctx!.clearRect(0, 0, w, h)

      pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.05
      pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.05
      const pax = (pointer.current.x - w / 2) * 0.03
      const pay = (pointer.current.y - h / 2) * 0.03

      for (const n of nodes) {
        const dx = n.tx - n.x
        const dy = n.ty - n.y
        n.vx = (n.vx + dx * 0.045) * 0.82
        n.vy = (n.vy + dy * 0.045) * 0.82
        n.x += n.vx
        n.y += n.vy
        if (!reduce) {
          n.x += Math.sin(t * 0.0004 + n.phase) * 0.1
          n.y += Math.cos(t * 0.00035 + n.phase) * 0.1
        }
      }

      const settle = Math.min(1, t / 1800)

      // hairline connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          if (dist >= CONNECT_DIST) continue
          const alpha = (1 - dist / CONNECT_DIST) * settle * 0.35
          ctx!.strokeStyle = `rgba(${inkRGB}, ${alpha.toFixed(3)})`
          ctx!.lineWidth = 1
          ctx!.beginPath()
          ctx!.moveTo(a.x + pax * a.z, a.y + pay * a.z)
          ctx!.lineTo(b.x + pax * b.z, b.y + pay * b.z)
          ctx!.stroke()
        }
      }

      // nodes
      for (const n of nodes) {
        const x = n.x + pax * n.z
        const y = n.y + pay * n.z
        ctx!.beginPath()
        ctx!.arc(x, y, 2.2 * n.z, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${inkRGB}, ${(0.5 * settle).toFixed(3)})`
        ctx!.fill()
      }

      raf = requestAnimationFrame(frame)
    }

    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      pointer.current.tx = e.clientX - rect.left
      pointer.current.ty = e.clientY - rect.top
    }
    function onLeave() {
      pointer.current.tx = w / 2
      pointer.current.ty = h / 2
    }

    readInk()
    resize()
    build()
    pointer.current.x = pointer.current.tx = w / 2
    pointer.current.y = pointer.current.ty = h / 2
    raf = requestAnimationFrame(frame)

    const ro = new ResizeObserver(() => {
      resize()
      build()
    })
    ro.observe(canvas)

    // re-read ink when theme attribute flips
    const mo = new MutationObserver(readInk)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })

    window.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
}
