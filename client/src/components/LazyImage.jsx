import { useRef, useState, useEffect } from 'react';

/**
 * Lazy-loads an image using IntersectionObserver.
 * Shows a gray placeholder until the image enters the viewport,
 * then fades it in smoothly.
 */
export default function LazyImage({ src, alt = '', className = '', fallback = null }) {
  const ref     = useRef(null);
  const [loaded,  setLoaded]  = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!src) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  if (!src) return fallback;

  return (
    <div ref={ref} className={`relative overflow-hidden bg-gray-100 ${className}`}>
      {visible && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}
