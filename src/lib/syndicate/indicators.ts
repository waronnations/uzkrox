// Live price-feed indicators (pure). Candles are oldest → newest.
export type Candle = { t: number; close: number; volume: number };

/** Wilder RSI over `period` closes; null when there isn't enough history. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) gain += d; else loss -= d; }
  gain /= period; loss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(0, d)) / period;
    loss = (loss * (period - 1) + Math.max(0, -d)) / period;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return Math.round((100 - 100 / (1 + gain / loss)) * 10) / 10;
}

/** Latest volume divided by the average of the `window` candles before it. */
export function volumeSurge(volumes: number[], window = 14): number {
  if (volumes.length < 2) return 0;
  const last = volumes[volumes.length - 1];
  const prior = volumes.slice(-window - 1, -1);
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
  return avg > 0 ? Math.round((last / avg) * 100) / 100 : 0;
}
