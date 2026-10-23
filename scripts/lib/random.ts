/** Deterministic PRNG (mulberry32) so every seed run produces the same city. */
export function createRandom(seed: number) {
  let state = seed;
  function random(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }
  const between = (min: number, max: number) => min + random() * (max - min);
  const int = (min: number, max: number) => Math.floor(between(min, max + 1));
  const chance = (p: number) => random() < p;
  function pick<T>(items: readonly T[]): T {
    return items[Math.floor(random() * items.length)] as T;
  }
  function weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = random() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return entries[entries.length - 1]?.[0] as T;
  }
  const hex = (bytes: number) =>
    Array.from({ length: bytes }, () =>
      int(0, 255).toString(16).padStart(2, "0"),
    ).join("");
  return { random, between, int, chance, pick, weighted, hex };
}
