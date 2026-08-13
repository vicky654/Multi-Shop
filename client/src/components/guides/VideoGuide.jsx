/**
 * VideoGuide — one workflow guide: a short screen recording of the REAL app when
 * one has been produced, and the written walkthrough either way.
 *
 * BEHAVIOUR WHEN THERE IS NO VIDEO
 *   The written steps are always rendered — they are the guide, not a stand-in.
 *   The player is added only once the file is confirmed to exist, so a missing
 *   recording shows nothing broken: no dead <video> element, no spinner, no
 *   "failed to load" chrome. Existence is checked with a HEAD request, because a
 *   dev server that answers every path with index.html would otherwise hand the
 *   <video> tag an HTML document and produce a decode error in the console.
 *
 * NO AUTOPLAY
 *   `preload="none"` and no autoplay attribute: nothing downloads or moves until
 *   the owner presses play. A guide that starts talking on its own is worse than
 *   no guide.
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PlayCircle, ListOrdered, Lightbulb, Info, ArrowRight, Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { videoUrlFor } from '../../constants/guides';

/** 'checking' → 'present' | 'absent'. Absent is a normal state, not an error. */
function useVideoAvailability(id) {
  const [state, setState] = useState('checking');
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    setState('checking');
    const url = videoUrlFor(id);

    fetch(url, { method: 'HEAD' })
      .then((res) => {
        if (cancelled.current) return;
        // A dev server SPA fallback returns 200 with text/html for any unknown
        // path, so the content type is the part that actually proves a video.
        const type = res.headers.get('content-type') || '';
        setState(res.ok && type.includes('video') ? 'present' : 'absent');
      })
      .catch(() => { if (!cancelled.current) setState('absent'); });

    return () => { cancelled.current = true; };
  }, [id]);

  return state;
}

export default function VideoGuide({ guide, defaultOpen = false }) {
  const availability = useVideoAvailability(guide.id);
  const [showSteps, setShowSteps] = useState(defaultOpen);

  if (!guide) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center justify-center shrink-0">
              {guide.order}
            </span>
            {guide.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{guide.summary}</p>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
          <Clock className="w-3 h-3" /> {guide.minutes} min
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Video, only when one genuinely exists ── */}
        {availability === 'present' && (
          <video
            controls
            preload="none"
            playsInline
            data-testid={`guide-video-${guide.id}`}
            className="w-full rounded-xl bg-black aspect-video"
            src={videoUrlFor(guide.id)}
          >
            {/* Spoken aloud by screen readers; the written steps below are the
                real accessible alternative. */}
            Your browser cannot play this video — the written steps below cover
            the same workflow.
          </video>
        )}

        {availability === 'absent' && (
          <div
            data-testid={`guide-video-missing-${guide.id}`}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100"
          >
            <PlayCircle className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              No screen recording for this guide yet — the written walkthrough below
              covers the same steps. Recordings are produced from the real app with
              <code className="mx-1 px-1 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px]">npm run guides:record</code>
              and appear here automatically.
            </p>
          </div>
        )}

        {/* ── Written walkthrough: always present ── */}
        <div>
          <button
            onClick={() => setShowSteps((v) => !v)}
            data-testid={`guide-steps-toggle-${guide.id}`}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-blue-700 transition"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            {showSteps ? 'Hide the steps' : `Show the steps (${guide.steps.length})`}
          </button>

          {showSteps && (
            <motion.ol
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.18 }}
              className="mt-2.5 space-y-2"
              data-testid={`guide-steps-${guide.id}`}
            >
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-gray-600 leading-relaxed">
                  <span className="w-4 h-4 rounded bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </motion.ol>
          )}
        </div>

        {/* ── Why it matters — the half owners are usually missing ── */}
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-900 leading-relaxed">{guide.why}</p>
        </div>

        {guide.note && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-900 leading-relaxed">{guide.note}</p>
          </div>
        )}

        {/* ── Straight into the real screen ── */}
        <Link
          to={guide.route}
          data-testid={`guide-open-${guide.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 transition"
        >
          Open {guide.title} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
