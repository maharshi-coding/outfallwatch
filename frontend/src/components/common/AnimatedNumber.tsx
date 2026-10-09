import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";

/** Smoothly tween a numeric readout. Falls back to the raw value when reduced-motion. */
export function AnimatedNumber({ value, decimals = 0, className }: {
  value: number | null | undefined;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (value == null) return;
    if (reduce) {
      if (ref.current) ref.current.textContent = value.toFixed(decimals);
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = v.toFixed(decimals);
      },
    });
    return () => controls.stop();
  }, [value, decimals, reduce, mv]);

  if (value == null) return <span className={className}>—</span>;
  return <span ref={ref} className={className}>{value.toFixed(decimals)}</span>;
}
