import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export const INTRO_LINES = [
  "You are here to discover the deepest truth about yourself…",
  "the pain you feel sometimes is not meant to make you broken",
  "but rather break you open…",
  "whatever you try to control will eventually elude you…",
  "release yourself…",
  "to the unknown…",
];

const LINE_MS = 2600;

/** Full-screen cinematic intro shown once per session before the Coin Board. */
export function IntroSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const finished = shown >= INTRO_LINES.length;

  useEffect(() => {
    if (finished) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 900 : LINE_MS);
    return () => clearTimeout(t);
  }, [shown, finished]);

  const exit = () => {
    if (leaving) return;
    setLeaving(true);
    try { navigator.vibrate?.(30); } catch { /* unsupported */ }
    setTimeout(onDone, 1100);
  };

  return (
    <AnimatePresence>
      {!leaving && (
        <motion.div
          key="intro"
          className="intro-root fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-background px-7"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
          transition={{ duration: 1.1, ease: [0.7, 0, 0.3, 1] }}
        >
          <div className="intro-void" aria-hidden />
          <div className="intro-scan" aria-hidden />

          <div className="relative z-10 max-w-md space-y-4 text-center">
            {INTRO_LINES.slice(0, shown).map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 14, filter: "blur(8px)", letterSpacing: "0.3em" }}
                animate={{ opacity: i === shown - 1 ? 1 : 0.45, y: 0, filter: "blur(0px)", letterSpacing: "0.02em" }}
                transition={{ duration: 1.6, ease: "easeOut" }}
                className={`font-light leading-relaxed text-foreground ${i === INTRO_LINES.length - 1 ? "text-2xl text-primary intro-glow" : "text-lg"}`}
              >
                {line}
              </motion.p>
            ))}
          </div>

          <div className="absolute bottom-10 z-10 flex flex-col items-center gap-4">
            {finished ? (
              <motion.button
                type="button"
                onClick={exit}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
                className="intro-cta rounded-full border border-primary px-8 py-3 text-sm uppercase tracking-[0.4em] text-primary"
              >
                Enter
              </motion.button>
            ) : (
              <button type="button" onClick={exit} className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Skip
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
