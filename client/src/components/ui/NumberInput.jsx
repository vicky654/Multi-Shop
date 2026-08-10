import { useState } from 'react';

/**
 * NumberInput — a numeric field that is safe to clear and retype.
 *
 * WHY THIS EXISTS
 *   A plain controlled `<input type="number" value={qty} onChange={...}/>` where
 *   the parent coerces empty input to a fallback ("" → 0, or "" → 1) snaps the
 *   displayed value back the instant the field is emptied. The caret then sits
 *   next to that fallback digit, so clearing a field and typing "10" produces
 *   "010" or "100" — a cashier silently bills the wrong discount or quantity.
 *
 * HOW IT FIXES IT
 *   While focused the field renders a local draft string, so an empty field
 *   stays empty and typing replaces rather than appends. Every keystroke still
 *   commits upward, so totals stay live. On blur the draft is discarded and the
 *   canonical prop value is rendered again — already normalised and clamped by
 *   the parent. Focusing also selects the contents so typing over a value just
 *   works.
 *
 *   Note there is deliberately NO effect syncing prop → draft while focused:
 *   the parent clamps "" to a fallback, and copying that back into the draft is
 *   exactly the append bug this component exists to prevent. External updates
 *   (the +/- steppers) blur the input, so the unfocused branch already shows them.
 *
 * Props:
 *   value    — canonical numeric value from the parent
 *   onCommit — (rawString) => void, called on every keystroke
 *   ...rest  — forwarded to the input (className, min, max, step, data-testid…)
 */
export default function NumberInput({ value, onCommit, onFocus, onBlur, ...rest }) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <input
      type="number"
      value={focused ? draft : String(value ?? '')}
      onFocus={(e) => {
        setDraft(String(value ?? ''));
        setFocused(true);
        e.target.select();       // typing replaces instead of appending
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
      {...rest}
    />
  );
}
