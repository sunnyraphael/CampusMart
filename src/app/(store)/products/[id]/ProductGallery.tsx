"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Package } from "lucide-react"

export default function ProductGallery({
  images,
  title,
}: {
  images: string[] | null
  title: string
}) {
  const list = (images ?? []).slice(0, 8)
  const [active, setActive] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const go = (next: number) => setActive((next + list.length) % list.length)

  // Swipe: compare where the finger started and where it ended
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? active + 1 : active - 1)
    touchStartX.current = null
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(active + 1)
    if (e.key === "ArrowLeft") go(active - 1)
  }

  return (
    <div className="pg">
      <style>{`
        .pg { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
        .pg-main {
          position: relative; aspect-ratio: 1; border-radius: 24px; overflow: hidden;
          background: linear-gradient(135deg, #f8faff, #eff2ff); border: 1px solid #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          touch-action: pan-y; outline: none;
        }
        .pg-main:focus-visible { box-shadow: 0 0 0 3px rgba(37,99,235,.4); }
        .pg-main img { width: 100%; height: 100%; object-fit: cover; animation: pg-fade .25s ease-out; }
        @keyframes pg-fade { from { opacity: .4; } to { opacity: 1; } }
        .pg-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 38px; height: 38px; border-radius: 50%; border: 0; cursor: pointer;
          background: rgba(255,255,255,.92); color: #0a0f2e;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 10px rgba(0,0,0,.15); transition: background .15s;
        }
        .pg-nav:hover { background: #fff; }
        .pg-nav:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        .pg-prev { left: 10px; }
        .pg-next { right: 10px; }
        .pg-count {
          position: absolute; bottom: 10px; right: 10px; padding: 3px 10px; border-radius: 999px;
          background: rgba(10,15,46,.7); color: #fff; font: 600 12px 'DM Sans', sans-serif;
        }
        .pg-thumbs { display: flex; gap: 10px; overflow-x: auto; padding: 2px; scroll-snap-type: x proximity; }
        .pg-thumb {
          width: 68px; height: 68px; flex-shrink: 0; border-radius: 12px; overflow: hidden; padding: 0;
          border: 2px solid transparent; background: #f1f5f9; cursor: pointer; scroll-snap-align: start;
          transition: border-color .2s, opacity .2s; opacity: .75;
        }
        .pg-thumb:hover { opacity: 1; }
        .pg-thumb.active { border-color: #2563eb; opacity: 1; }
        .pg-thumb:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        .pg-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        @media (max-width: 639px) {
          .pg-main { aspect-ratio: 4 / 3; border-radius: 16px; }
          .pg-thumb { width: 56px; height: 56px; border-radius: 10px; }
          .pg-nav { width: 34px; height: 34px; }
        }
        @media (prefers-reduced-motion: reduce) { .pg-main img { animation: none; } }
      `}</style>

      <div
        className="pg-main"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-label={`${title} photos`}
      >
        {list.length > 0 ? (
          // key={active} makes React replay the fade animation each time the photo changes
          <img key={active} src={list[active]} alt={`${title} ${active + 1}`} />
        ) : (
          <Package size={80} color="#cbd5e1" />
        )}

        {list.length > 1 && (
          <>
            <button className="pg-nav pg-prev" onClick={() => go(active - 1)} aria-label="Previous photo">
              <ChevronLeft size={20} />
            </button>
            <button className="pg-nav pg-next" onClick={() => go(active + 1)} aria-label="Next photo">
              <ChevronRight size={20} />
            </button>
            <span className="pg-count">{active + 1} / {list.length}</span>
          </>
        )}
      </div>

      {list.length > 1 && (
        <div className="pg-thumbs">
          {list.map((img, i) => (
            <button
              key={i}
              className={`pg-thumb ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === active}
            >
              <img src={img} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}