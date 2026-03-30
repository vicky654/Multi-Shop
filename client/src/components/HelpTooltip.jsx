/**
 * HelpTooltip — lightweight reusable tooltip component.
 *
 * Usage:
 *   <HelpTooltip content="This sale will not be included in reports" />
 *   <HelpTooltip content="Add product manually or upload via CSV" side="right">
 *     <span>Custom trigger</span>
 *   </HelpTooltip>
 */
import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

const SIDE_CLASSES = {
  top:    'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  right:  'left-full ml-2 top-1/2 -translate-y-1/2',
  left:   'right-full mr-2 top-1/2 -translate-y-1/2',
};

const ARROW_CLASSES = {
  top:    'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800',
  right:  'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800',
  left:   'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800',
};

export default function HelpTooltip({
  content,
  children,
  side = 'top',
  maxWidth = 220,
}) {
  const [show, setShow] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children ?? (
        <HelpCircle className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500 cursor-help transition-colors shrink-0" />
      )}

      <AnimatePresence>
        {show && (
          <motion.div
            id={id}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1    }}
            exit={{   opacity: 0, scale: 0.93  }}
            transition={{ duration: 0.13 }}
            style={{ width: maxWidth }}
            className={`absolute z-50 bg-gray-900 text-white text-[11px] leading-relaxed px-3 py-2 rounded-xl shadow-xl pointer-events-none whitespace-normal ${SIDE_CLASSES[side]}`}
          >
            {content}
            {/* Arrow */}
            <span className={`absolute border-4 ${ARROW_CLASSES[side]}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
