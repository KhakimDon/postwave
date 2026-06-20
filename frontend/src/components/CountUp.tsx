import { useEffect, useRef, useState } from "react";

/** Анимированный счётчик: плавно считает от 0 до value за `duration` мс. */
export function CountUp({
  value,
  duration = 2000,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current; // стартуем с текущего показанного (обычно 0)
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const cur = Math.round(from + (to - from) * eased);
      setDisplay(cur);
      fromRef.current = cur;
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setDisplay(to);
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display}</>;
}
