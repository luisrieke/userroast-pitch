import { useEffect, useMemo, useState } from 'react'
import { API_BASE, navigate, scoreColor, ScoreBar } from './App'

// Hardcode the hackathon entries here as owner/repo slugs (lowercase).
// e.g. "vercel/next.js". The "hackathon only" toggle filters to this set.
export const HACKATHON_REPOS: string[] = [
  // "owner/repo",
]

type LeaderboardScan = {
  job_id: string
  repo_url: string
  status: string
  overall: number | null
  summary: string | null
  updated_at: string
}

// Strip protocol / github.com / .git down to a lowercase owner/repo slug.
const normalizeSlug = (repoUrl: string) =>
  repoUrl
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
    .toLowerCase()

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="w-8 shrink-0 text-center font-mono text-sm font-bold text-muted-foreground">
      {rank}
    </span>
  )
}

export default function Leaderboard() {
  const [scans, setScans] = useState<LeaderboardScan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hackathonOnly, setHackathonOnly] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scans`)
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const data: LeaderboardScan[] = await res.json()
        setScans(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hackathonSet = useMemo(
    () => new Set(HACKATHON_REPOS.map((s) => s.toLowerCase())),
    [],
  )

  const visible = useMemo(() => {
    if (!hackathonOnly) return scans
    return scans.filter((s) => hackathonSet.has(normalizeSlug(s.repo_url)))
  }, [scans, hackathonOnly, hackathonSet])

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
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-16">
        <header className="mb-8 rounded-[10px] border border-line bg-card p-8 shadow-xl sm:p-10">
          <p className="eyebrow mb-4">public repo rankings</p>
          <h1 className="font-heading text-[clamp(40px,7.5vw,72px)] leading-[0.98] font-semibold tracking-tight">
            leader<span className="mark">board</span>
          </h1>
          <p className="mt-4 max-w-[540px] text-[17px] text-[#3a3830]">
            Every repo we've roasted, ranked by overall score. The harsh truth,
            sorted best to worst.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHackathonOnly(false)}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[13px] transition-colors ${
                hackathonOnly
                  ? 'border-line text-muted-foreground hover:border-ink hover:text-ink'
                  : 'border-ink bg-ink text-white'
              }`}
            >
              all repos
            </button>
            <button
              type="button"
              onClick={() => setHackathonOnly(true)}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[13px] transition-colors ${
                hackathonOnly
                  ? 'border-ink bg-ink text-white'
                  : 'border-line text-muted-foreground hover:border-ink hover:text-ink'
              }`}
            >
              hackathon only
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-[10px] border-2 border-meat/40 bg-meat/10 px-4 py-3 font-mono text-sm text-meat">
            {error}
          </div>
        )}

        {loading ? (
          <p className="rounded-[10px] border border-line bg-card px-5 py-4 font-mono text-sm text-muted-foreground shadow-sm">
            loading…
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-[10px] border border-line bg-card px-5 py-4 font-mono text-sm text-muted-foreground shadow-sm">
            {hackathonOnly ? 'no hackathon repos yet.' : 'no roasts yet.'}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {visible.map((s, i) => {
              const slug = normalizeSlug(s.repo_url)
              const roasting = s.status !== 'done' && s.status !== 'error'
              return (
                <li key={s.job_id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/roast/${s.job_id}`)}
                    className="flex w-full items-center gap-4 rounded-[10px] border border-line bg-card px-5 py-4 text-left shadow-sm transition-colors hover:border-ink"
                  >
                    <RankBadge rank={i + 1} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-heading text-[17px] font-semibold tracking-tight">
                          {slug}
                        </span>
                        {roasting && (
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            roasting…
                          </span>
                        )}
                      </div>
                      {s.summary && (
                        <p className="mt-1 line-clamp-1 text-[13px] text-[#3a3830]">
                          {s.summary}
                        </p>
                      )}
                      <div className="mt-2 max-w-[220px]">
                        <ScoreBar score={s.overall} />
                      </div>
                    </div>
                    <div
                      className="shrink-0 font-mono text-2xl font-bold"
                      style={{ color: scoreColor(s.overall) }}
                    >
                      {s.overall ?? '–'}
                      <span className="text-sm text-muted-foreground">/100</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </main>
    </>
  )
}
