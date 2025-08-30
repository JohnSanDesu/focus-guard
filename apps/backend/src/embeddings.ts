export type Vec = number[];

export function embedStub(text: string, dim = 48): Vec {
  const v = new Array<number>(dim).fill(0);
  let h1 = 2166136261 >>> 0;
  let h2 = 0x9e3779b9 >>> 0; 
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = (h1 * 16777619) >>> 0;
    h2 = (h2 + c + ((h2 << 6) >>> 0) + ((h2 >>> 2) >>> 0)) >>> 0;
    v[i % dim] = (v[i % dim] + ((h1 ^ h2) & 0xffff)) % 100000;
  }
  let n = 0;
  for (const x of v) n += x * x;
  const s = Math.sqrt(n) || 1;
  return v.map((x) => x / s);
}
