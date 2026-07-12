/*
  Technical-drawing "furniture" — the blueprint scaffolding from the Agentic UI
  reference: corner crop marks, a faint centerline, and a registration circle.
  Purely decorative; all elements are aria-hidden and pointer-events-none.
*/

export function CornerMarks() {
  const common = "pointer-events-none absolute size-3.5 border-muted-foreground/40"
  return (
    <div aria-hidden className="pointer-events-none absolute inset-4 z-0 md:inset-6">
      <span className={`${common} left-0 top-0 border-l border-t`} />
      <span className={`${common} right-0 top-0 border-r border-t`} />
      <span className={`${common} bottom-0 left-0 border-b border-l`} />
      <span className={`${common} bottom-0 right-0 border-b border-r`} />
    </div>
  )
}

export function RegistrationMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className={`pointer-events-none text-muted-foreground/25 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.5"
    >
      <circle cx="50" cy="50" r="49" />
      <circle cx="50" cy="50" r="30" />
      <line x1="50" y1="0" x2="50" y2="100" />
      <line x1="0" y1="50" x2="100" y2="50" />
    </svg>
  )
}
