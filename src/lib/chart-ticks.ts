/** Clean axis ticks: 0..max in steps of 1, 2, 5 × 10^n, about `n` gridlines. */
export function niceTicks(max: number, n = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / n;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10;
  // Whole numbers only: counts never need fractional ticks.
  const whole = Math.max(1, Math.round(step));
  const top = Math.ceil(max / whole) * whole;
  return Array.from(
    { length: Math.round(top / whole) + 1 },
    (_, i) => i * whole,
  );
}
