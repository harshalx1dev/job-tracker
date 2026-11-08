/** A point in time n days ago (kept out of components so render stays pure). */
export function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000);
}
