export default function Loading() {
  return <div className="vx-page" role="status" aria-label="Loading your workspace"><div className="vx-skeleton" style={{ height: 70, maxWidth: 420, marginBottom: 26 }} /><div className="vx-stats">{[0, 1, 2, 3].map(n => <div key={n} className="vx-skeleton" />)}</div><div className="vx-skeleton" style={{ height: 330 }} /><span className="sr-only">Loading your workspace…</span></div>
}
