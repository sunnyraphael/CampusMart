// Shown by Next.js while the products page waits for the database. Solid blocks, no gradient shimmer.
export default function Loading() {
  return (
    <section className="pl" aria-busy="true" aria-label="Loading listings">
      <div className="pl-skel-line" style={{ width: 'min(220px, 60%)', height: 28 }} />
      <div className="pl-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="pc">
            <div className="pc-photo pl-skel" />
            <div className="pc-body">
              <div className="pl-skel-line" style={{ width: '90%' }} />
              <div className="pl-skel-line" style={{ width: '65%' }} />
              <div className="pl-skel-line" style={{ width: '40%', height: 18 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}