"use client";

import { useEffect, useState } from "react";
import { elapsedSeconds, formatClock } from "@/lib/timer";

/** Reloj del cronómetro: se actualiza cada segundo en el navegador (la hora real la guarda el servidor). */
export function TimerClock({ startedAt, accumulatedSeconds }: { startedAt: string | null; accumulatedSeconds: number }) {
  const start = startedAt ? new Date(startedAt) : null;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const secs = elapsedSeconds({ startedAt: start, accumulatedSeconds }, now);
  return (
    <span className="font-mono text-base font-semibold tabular-nums" data-testid="timer-clock" aria-live="off">
      {formatClock(secs)}
    </span>
  );
}
