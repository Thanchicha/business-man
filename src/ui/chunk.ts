/**
 * Cuts a long line into short pieces at the spaces between phrases, so characters never throw a
 * paragraph at the player. Short lines are left alone.
 */
export function chunkText(s: string, max = 40): string[] {
  if ([...s].length <= max + 10) return [s];
  const phrases = s.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const ph of phrases) {
    if (cur && [...(cur + ' ' + ph)].length > max) {
      out.push(cur);
      cur = ph;
    } else cur = cur ? `${cur} ${ph}` : ph;
  }
  if (cur) out.push(cur);
  // a tiny tail reads better stuck to the line before it
  if (out.length > 1 && [...out[out.length - 1]].length < 8) out.splice(-2, 2, `${out[out.length - 2]} ${out[out.length - 1]}`);
  return out;
}


