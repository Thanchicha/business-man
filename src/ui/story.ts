import { btn, h, mount } from './dom';
import { portrait } from '../three/portrait';
import { CAST, type Expr } from '../game/specs';
import { MIYU } from './components';
import { sfx } from './sfx';

export interface Slide {
  /** One short line. */
  text: string;
  /** A chart, table or card to show with the line. */
  visual?: HTMLElement;
  expr?: Expr;
}

/**
 * MIYU walks the player through results one slide at a time: a chart and a single short line,
 * so nobody has to read a long paragraph. Resolves when the last slide is closed.
 */
export function miyuStory(title: string, slides: Slide[]): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const img = h('img', { class: 'story-miyu' });
    const text = h('div', 'say');
    const visual = h('div', 'story-visual');
    const dots = h('div', 'row story-dots');
    const nextBtn = btn('ต่อไป ▶', 'pink', () => step(1), 'big');
    const panel = h('div', 'panel story-panel', h('h2', {}, title), visual, h('div', 'story-talk', img, h('div', 'bubble', h('div', 'tip-head', `🐾 ${MIYU}`), text)), dots, h('div', { class: 'row', style: { justifyContent: 'center', gap: '10px' } }, btn('ข้าม', '', () => finish(), 'small'), nextBtn));
    const overlay = mount(h('div', 'overlay story-overlay', panel));
    const finish = () => {
      overlay.remove();
      resolve();
    };
    const step = (d: number) => {
      sfx('click');
      if (i + d >= slides.length) return finish();
      i = Math.max(0, i + d);
      draw();
    };
    const draw = () => {
      const s = slides[i];
      img.src = portrait('advisor', CAST.advisor, s.expr ?? 'happy');
      text.textContent = s.text;
      visual.replaceChildren(...(s.visual ? [s.visual] : []));
      dots.replaceChildren(...slides.map((_, n) => h('i', { class: `dot ${n === i ? 'on' : ''}` })));
      nextBtn.textContent = i === slides.length - 1 ? '📒 บันทึกลงสมุด ✓' : 'ต่อไป ▶';
    };
    draw();
  });
}
