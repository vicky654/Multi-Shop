import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn, Package } from 'lucide-react';

const LABELS = ['Front', 'Side', 'Back', 'Detail', 'Zoom'];

// ── Full-screen lightbox ───────────────────────────────────────────────────────
function Lightbox({ images, current, onClose, onPrev, onNext }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
      >
        <X className="w-6 h-6" />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <img
        src={images[current]}
        alt={`Image ${current + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {images.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all ${
              i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ── ImageCarousel — main export ────────────────────────────────────────────────
// Props:
//   images   — string[]  (base64 or URL)
//   compact  — boolean   (small variant for tables/cards, default false)
//   name     — string    (product name, shown in lightbox title)
export default function ImageCarousel({ images = [], compact = false, name = '' }) {
  const [active,    setActive]    = useState(0);
  const [lightbox,  setLightbox]  = useState(false);

  const imgs = images.filter(Boolean);
  const safeActive = Math.min(active, imgs.length - 1);

  const prev = useCallback(() => setActive((i) => (i === 0 ? imgs.length - 1 : i - 1)), [imgs.length]);
  const next = useCallback(() => setActive((i) => (i === imgs.length - 1 ? 0 : i + 1)), [imgs.length]);

  if (imgs.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 ${compact ? 'w-16 h-16' : 'w-full aspect-square'}`}>
        <Package className={`text-gray-300 ${compact ? 'w-6 h-6' : 'w-12 h-12'}`} />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shrink-0"
        onClick={() => setLightbox(true)}>
        <img src={imgs[0]} alt={name} className="w-full h-full object-cover" loading="lazy" />
        {imgs.length > 1 && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] px-1 rounded leading-4">
            +{imgs.length - 1}
          </span>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
          <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition" />
        </div>
        {lightbox && (
          <Lightbox images={imgs} current={safeActive}
            onClose={() => setLightbox(false)} onPrev={prev} onNext={next} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Main image */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-200 group cursor-zoom-in"
          onClick={() => setLightbox(true)}>
          <img
            src={imgs[safeActive]}
            alt={`${name} — ${LABELS[safeActive] || `Image ${safeActive + 1}`}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />

          {/* Zoom hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition shadow-lg">
              <ZoomIn className="w-5 h-5 text-gray-700" />
            </div>
          </div>

          {/* Angle label */}
          {LABELS[safeActive] && (
            <span className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
              {LABELS[safeActive]}
            </span>
          )}

          {/* Nav arrows (only when multiple images) */}
          {imgs.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail strip */}
        {imgs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {imgs.map((src, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  i === safeActive
                    ? 'border-blue-500 shadow-md shadow-blue-200 scale-105'
                    : 'border-gray-200 hover:border-blue-300 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={src} alt={LABELS[i] || `View ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {/* Dot indicators (shown when thumbnails would overflow) */}
        {imgs.length > 1 && (
          <div className="flex justify-center gap-1.5">
            {imgs.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-full transition-all ${
                  i === safeActive ? 'w-5 h-1.5 bg-blue-500' : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={imgs}
          current={safeActive}
          onClose={() => setLightbox(false)}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
