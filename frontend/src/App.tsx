import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// SPA navigation helper for our manual (no-router) routing. pushState then
// dispatch popstate so listeners (Root, App) re-read window.location.
export const navigate = (path: string) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

type Stage = { ts: string; stage: string; message: string }
type Finding = {
  id?: string
  title: string
  category: string
  severity: string
  description: string
  fix?: string
}
type CategoryScore = {
  key: string
  label: string
  score: number | null
  roast: string | null
}
type Scores = {
  overall: number | null
  categories: CategoryScore[]
}
type Scan = {
  job_id: string
  repo_url: string
  scope?: string
  status: string
  stages: Stage[]
  findings: Finding[]
  scores: Scores
  summary: string | null
  error: string | null
  created_at: string
  updated_at: string
}

const TERMINAL_STATES = ['done', 'error']

// Audit scope ladder (lenient -> strict). Mirror of SCOPES in backend.
// First entry is the default selection.
const SCOPE_OPTIONS = [
  { value: 'hackathon', label: 'hackathon' },
  { value: 'mvp', label: 'mvp' },
  { value: 'beta', label: 'beta' },
  { value: 'production', label: 'prod' },
] as const

const scopeLabel = (value: string | undefined) =>
  SCOPE_OPTIONS.find((s) => s.value === value)?.label ?? null

// Accept full URLs (github.com/owner/repo) or bare slugs (owner/repo).
const normalizeRepoUrl = (input: string) => {
  const value = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  if (/^https?:\/\//i.test(value)) return value
  if (/^github\.com\//i.test(value)) return `https://${value}`
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) return `https://github.com/${value}`
  return value
}

const readJobFromUrl = () => {
  const match = window.location.pathname.match(/^\/roast\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

const severityVariant = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'destructive' as const
    case 'medium':
      return 'secondary' as const
    default:
      return 'outline' as const
  }
}

// Lighthouse-style score bands, kept on-brand: meat (bad), yellow (meh), ink (good).
export const scoreColor = (score: number | null) => {
  if (score == null) return 'var(--line)'
  if (score < 50) return 'var(--meat)'
  if (score < 80) return 'var(--yellow)'
  return 'var(--ink)'
}

function ScoreGauge({
  value,
  loading = false,
}: {
  value: number | null
  loading?: boolean
}) {
  const size = 168
  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = value ?? 0
  const offset = circ - (pct / 100) * circ
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className={loading ? 'animate-spin animation-duration-[1.2s]' : '-rotate-90'}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={loading ? `${circ * 0.25} ${circ}` : circ}
          strokeDashoffset={loading ? 0 : offset}
          className={loading ? '' : 'transition-[stroke-dashoffset] duration-700 ease-out'}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-bold leading-none">
          {value ?? '–'}
        </span>
        <span className="font-mono text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

export function ScoreBar({ score }: { score: number | null }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${score ?? 0}%`, background: scoreColor(score) }}
      />
    </div>
  )
}

function FindingsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[0, 1, 2].map((g) => (
        <div key={g}>
          <div className="flex items-center gap-3">
            <span className="size-2 shrink-0 rounded-full bg-line" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-line" />
            <div className="ml-auto h-4 w-12 animate-pulse rounded-full bg-line" />
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-muted-foreground/30" />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1].map((c) => (
              <div
                key={c}
                className="flex items-center gap-3 rounded-[10px] border border-line px-4 py-3"
              >
                <span className="size-4 shrink-0 animate-pulse rounded bg-line" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-line" />
                <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-line" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ProgressLog({ scan, running }: { scan: Scan; running: boolean }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [scan.stages.length, running])

  return (
    <div className="w-full text-left">
      <div ref={scrollRef} className="max-h-[180px] overflow-y-auto">
        <ol className="flex flex-col gap-4">
          {scan.stages.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              <div>
                <span className="eyebrow">{s.stage}</span>
                <p className="text-sm">{s.message}</p>
              </div>
            </li>
          ))}
          {running && (
            <li className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-meat" />
              <p className="font-mono text-sm text-muted-foreground">working…</p>
            </li>
          )}
        </ol>
      </div>
    </div>
  )
}

function App() {
  const [repoUrl, setRepoUrl] = useState('')
  const [scope, setScope] = useState<string>(SCOPE_OPTIONS[0].value)
  const [jobId, setJobId] = useState<string | null>(() => readJobFromUrl())
  const [scan, setScan] = useState<Scan | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    const onPopState = () => {
      const job = readJobFromUrl()
      setJobId(job)
      if (!job) {
        setScan(null)
        setError(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scans/${jobId}`)
        if (!res.ok) return
        const data: Scan = await res.json()
        setScan(data)
        setRepoUrl((prev) => prev || data.repo_url)
        if (TERMINAL_STATES.includes(data.status) && pollRef.current) {
          window.clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {
        /* keep polling */
      }
    }

    poll()
    pollRef.current = window.setInterval(poll, 2000)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [jobId])

  const startScan = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setScan(null)
    setJobId(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: normalizeRepoUrl(repoUrl), scope }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Request failed (${res.status})`)
      }
      const data = await res.json()
      window.history.pushState({}, '', `/roast/${data.job_id}`)
      setJobId(data.job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan')
    } finally {
      setSubmitting(false)
    }
  }

  const running = scan != null && !TERMINAL_STATES.includes(scan.status)
  const categories = scan?.scores?.categories ?? []
  const findingsFor = (key: string) =>
    scan?.findings.filter((f) => f.category === key) ?? []

  return (
    <>
      <video
        className="fixed inset-0 -z-10 h-full w-full scale-105 object-cover blur-sm"
        src="/bg.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <a
        className="qr-badge fixed right-4 top-[42px] z-50 flex flex-col items-center gap-1.5 rounded-[10px] border border-[var(--line-strong)] bg-card p-2.5 no-underline transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(22,21,15,0.12)]"
        href="https://userroast.com"
        aria-label="Scan to open userroast.com"
      >
        <img
          src="/images/qr-userroast.png"
          alt="QR code linking to userroast.com"
          width={96}
          height={96}
          className="block rounded"
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          scan me
        </span>
      </a>
      <main
        className={`mx-auto flex min-h-screen flex-col px-6 ${
          scan ? 'max-w-6xl py-16' : 'max-w-4xl justify-center'
        }`}
      >
      <div
        className={`mx-auto w-full max-w-3xl rounded-[10px] border border-line bg-card shadow-xl transition-all duration-500 ease-out ${
          scan ? 'mb-10 p-5 sm:p-6' : 'p-8 sm:p-10'
        }`}
      >
        <header
          className={`transition-all duration-500 ease-out ${
            scan ? 'mb-5' : 'mb-8 text-center'
          }`}
        >
          {!scan && (
            <div className="mb-4 flex items-center justify-center gap-4">
              <p className="eyebrow">product-gap roast · now in beta</p>
              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="font-mono text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-ink"
              >
                leaderboard →
              </button>
            </div>
          )}
          <h1
            className={`font-heading leading-[0.98] font-semibold tracking-tight transition-all duration-500 ease-out ${
              scan
                ? 'text-[clamp(28px,4vw,40px)]'
                : 'text-[clamp(40px,7.5vw,72px)]'
            }`}
          >
            user <span className="mark">roast</span>
          </h1>
          {!scan && (
            <p className="mx-auto mt-4 max-w-[540px] text-[17px] text-[#3a3830]">
              Point it at a public GitHub repo. Our agent reads the codebase,
              scores it like Lighthouse — feature completeness, UX, integrations,
              reliability, security — then roasts the gaps and tells you how to
              fix them.
            </p>
          )}
        </header>

        {scan ? (
          <div className="flex w-full items-center gap-3 rounded-md border border-line bg-secondary/40 px-3.5 py-2.5">
            <svg
              className="size-5 shrink-0"
              viewBox="0 0 24 24"
              fill="#8a877a"
              aria-hidden="true"
            >
              <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.74 1.27 3.4.97.11-.76.41-1.27.74-1.56-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.42.36.8 1.08.8 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
            </svg>
            <a
              href={scan.repo_url}
              target="_blank"
              rel="noopener"
              className="truncate font-mono text-sm text-ink hover:underline"
            >
              {scan.repo_url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
            </a>
            {scopeLabel(scan.scope) && (
              <span className="ml-auto shrink-0 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                judged as <span className="text-ink">{scopeLabel(scan.scope)}</span>
              </span>
            )}
            <span
              className={`${
                scopeLabel(scan.scope) ? '' : 'ml-auto '
              }shrink-0 font-mono text-xs uppercase tracking-wide text-muted-foreground`}
            >
              {running ? 'roasting…' : 'roasted 🍖'}
            </span>
          </div>
        ) : (
          <form className="flex w-full gap-3" onSubmit={startScan}>
            <Input
              type="text"
              required
              placeholder="owner/repo or https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={submitting}
              className="flex-1 font-mono"
            />
            <div className="flex shrink-0">
              <Button
                type="submit"
                className="shrink-0 rounded-r-none font-mono uppercase tracking-wide"
                disabled={submitting}
              >
                {submitting ? 'starting…' : 'roast it 🍖'}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="-ml-px rounded-l-none border-line bg-card text-ink"
                      disabled={submitting}
                      aria-label={`audit scope: ${scopeLabel(scope) ?? scope}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-4"
                        aria-hidden="true"
                      >
                        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
                        <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.1 7.1 0 0 0-1.69-.98L14.5 2.42A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42L9.12 5.07a7.1 7.1 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.02.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.51.4 1.08.73 1.69.98l.38 2.65a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.38-2.65c.61-.25 1.18-.58 1.69-.98l2.49 1a.5.5 0 0 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65Z" />
                      </svg>
                    </Button>
                  }
                />
                <DropdownMenuContent>
                  <DropdownMenuLabel>judge as</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={scope} onValueChange={(value) => setScope(value)}>
                    {SCOPE_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem key={opt.value} value={opt.value} closeOnClick>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </form>
        )}
      </div>

      {error && (
        <div className="mx-auto w-full max-w-3xl rounded-[10px] border-2 border-meat/40 bg-meat/10 px-4 py-3 font-mono text-sm text-meat">
          {error}
        </div>
      )}

      {scan && (
        <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex-1 rounded-[10px] border border-line bg-card p-8 shadow-xl sm:p-10">
          {scan.error && (
            <div className="mb-8 rounded-[10px] border-2 border-meat/40 bg-meat/10 px-4 py-3 font-mono text-sm text-meat">
              {scan.error}
            </div>
          )}

          {/* Overall score hero + verdict */}
          <div className="flex flex-col items-center gap-6 border-b border-line pb-8 sm:flex-row sm:items-start">
            <ScoreGauge
              value={scan.scores?.overall ?? null}
              loading={running}
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              {scan.summary ? (
                <div className="roast">
                  <b>🍖 roast</b>
                  {scan.summary}
                </div>
              ) : running ? (
                <ProgressLog scan={scan} running={running} />
              ) : (
                <p className="max-w-[360px] text-[15px] text-[#3a3830]">
                  no verdict yet.
                </p>
              )}
            </div>
          </div>

          {/* Per-category scores + roasts + findings */}
          <div className="mt-8 flex flex-col gap-8">
            {running && categories.length === 0 && <FindingsSkeleton />}
            {categories.map((cat) => {
              const catFindings = findingsFor(cat.key)
              return (
                <div key={cat.key}>
                  <div className="flex items-center gap-3">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: scoreColor(cat.score) }}
                    />
                    <h3 className="text-[17px] font-semibold">{cat.label}</h3>
                    <span className="ml-auto font-mono text-sm font-bold">
                      {cat.score ?? '–'}
                      <span className="text-muted-foreground">/100</span>
                    </span>
                  </div>
                  <div className="mt-2">
                    <ScoreBar score={cat.score} />
                  </div>
                  {cat.roast && (
                    <div className="roast mt-3">
                      <b>🍖 roast</b>
                      {cat.roast}
                    </div>
                  )}

                  {catFindings.length > 0 && (
                    <div className="mt-4 flex flex-col gap-3">
                      {catFindings.map((f) => (
                        <details
                          key={f.id}
                          className="group/finding rounded-[10px] border border-line bg-card transition-colors hover:border-ink open:border-ink"
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                            <svg
                              className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/finding:rotate-90"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                            <span className="font-heading text-sm font-medium">
                              {f.title}
                            </span>
                            <Badge
                              variant={severityVariant(f.severity)}
                              className="ml-auto font-mono uppercase tracking-wide"
                            >
                              {f.severity}
                            </Badge>
                          </summary>
                          <div className="flex flex-col gap-3 px-4 pb-4 pl-11 text-[15px] text-[#3a3830]">
                            <p>{f.description}</p>
                            {f.fix && (
                              <div className="rounded-[8px] border border-line bg-secondary/50 px-3 py-2.5">
                                <p className="eyebrow mb-1">fix</p>
                                <p className="text-sm text-[#3a3830]">{f.fix}</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-3 font-mono uppercase tracking-wide"
                                >
                                  create pull request
                                </Button>
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </section>

        </div>
      )}
      </main>
    </>
  )
}

export default App
