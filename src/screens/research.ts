import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { Advisor, DialogBox, Hud, polite, stepChip, toast, playerName, modal } from '../ui/components';
import { go } from '../game/flow';
import { CAST, crowdFor } from '../game/specs';
import { G, saveGame } from '../sim/GameState';
import { DEPOSIT_MONTHS, LOCATION } from '../data/locations';
import { SHOP_SIZES } from '../data/shopSizes';
import { canUse, findings, INTERVIEW_APPROACHES, METHODS, methodCost, move, recordRefusal, recordTalk, rest, REST, spendApproach, talksLeft, TIRED_BELOW, useMethod, MOVE_HOURS, MOVE_ENERGY, type ChartSpec, type Finding, type Method } from '../sim/research';
import { MOOD_HINT, personaFor, refusal, talkWith, TEA_PRICE, willTalk, type Persona } from '../sim/interviews';
import { buildStreet } from '../three/sets/street';
import { createCharacter, type Character } from '../three/models/miyu';
import * as P from '../three/models/props';
import { addChibi, walkTo } from './common';
import { baht } from '../game/format';
import { sfx } from '../ui/sfx';
import { chartView, tableView } from '../ui/charts';
import { miyuStory, type Slide } from '../ui/story';
import { notebookView, openNotebook } from './notebook';

export { notebookView, openNotebook };

/** Resources left for research, as a small bar. */
function prepBar(): HTMLElement {
  const r = G.research;
  const day = Math.min(3, Math.floor((30 - r.hours) / 10) + 1);
  return h(
    'div',
    { class: 'panel row', style: { padding: '8px 14px', gap: '14px', fontSize: '15px' } },
    h('span', {}, `🗓️ เตรียมร้านวันที่ ${day}/3`),
    h('span', {}, `⏱ เหลือ ${r.hours} ชม.`),
    h('span', { class: r.energy < TIRED_BELOW ? 'bad' : '' }, `⚡ แรง ${r.energy}/100`),
    h('span', {}, `💰 ${baht(G.cash)}`),
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** One short line about a chart: who or what stands out. */
function captionFor(c: ChartSpec): string {
  const top = [...c.items].sort((a, b) => b.value - a.value)[0];
  if (c.kind === 'donut') return `${top.label} มากที่สุด ราว ${pct(top.value / (c.items.reduce((s, i) => s + i.value, 0) || 1))}`;
  return `${top.label} สูงสุด`;
}

/** MIYU's walk-through of a result: one chart or table per slide with a single short line. */
function slidesFor(f: Finding): Slide[] {
  const slides: Slide[] = [{ text: f.headline, expr: 'happy', visual: h('div', { class: 'note-headline', style: { fontSize: '20px', margin: 0 } }, f.headline) }];
  for (const c of f.charts ?? []) slides.push({ text: captionFor(c), expr: 'think', visual: chartView(c, true) });
  if (f.table) slides.push({ text: 'ลองเทียบกันดูนะ', expr: 'think', visual: tableView(f.table) });
  if (f.refused) slides.push({ text: `มี ${f.refused} คนปฏิเสธ ไม่ใช่ทุกคนที่ว่างคุยนะ`, expr: 'surprised' });
  slides.push({ text: 'จดลงสมุดบันทึกแล้ว เปิดดูทีหลังได้ตลอดเลย', expr: 'wink', visual: h('div', { style: { fontSize: '56px', textAlign: 'center' } }, '📒') });
  return slides.slice(0, 6);
}

/** Study one location before deciding to open there. */
export function researchScreen(stage: Stage, data: { loc: string }): void {
  const locId = data.loc;
  const loc = LOCATION[locId];
  const e = stage.engine;
  e.daySky();
  e.hemi.intensity = 1.6;
  e.sun.intensity = 2.2;
  stage.add(buildStreet());
  e.camera.position.set(0.6, 4.2, 14);
  e.look(0.4, 1.2, 2.5);
  const me = addChibi(stage, CAST[G.playerKey], -0.6, 3.0, 0);

  // the people of this area, walking up and down the street; busy ones walk fast
  interface Walker {
    c: Character;
    persona: Persona;
    label?: HTMLElement;
    gone: boolean;
  }
  const walkers: Walker[] = [];
  const COUNT = 7;
  for (let i = 0; i < COUNT; i++) {
    const spec = crowdFor(locId, locId.length * 50 + i);
    const c = createCharacter(spec);
    const persona = personaFor(spec.extra!.id, locId.length * 50 + i);
    c.root.position.set(-9 + i * 2.8, 0, 2.2 + (i % 3) * 0.8);
    stage.add(c.root);
    const w: Walker = { c, persona, gone: false };
    walkers.push(w);
    const speed = persona.mood === 'busy' ? 2 : 1.2;
    let goal = new THREE.Vector3((Math.random() - 0.5) * 18, 0, c.root.position.z);
    stage.onUpdate((dt) => {
      c.update(dt);
      if (c.root.userData.busy) return;
      const p = c.root.position;
      const d = goal.distanceTo(p);
      if (d < 0.1) {
        goal = new THREE.Vector3((Math.random() - 0.5) * 18, 0, 2 + Math.random() * 1.8);
        return;
      }
      c.walking = true;
      c.root.rotation.y = Math.atan2(goal.x - p.x, goal.z - p.z);
      p.addScaledVector(goal.clone().sub(p).normalize(), Math.min(d, dt * speed));
    });
  }

  const hud = new Hud(`สำรวจ: ${loc.area}`);
  stepChip(4, `สำรวจตลาด: ${loc.area}`, 'เก็บข้อมูลก่อนตัดสินใจเปิดร้าน แต่ละวิธีใช้เวลา แรง และเงิน');
  const bar = mount(h('div', { class: 'top-right research-bar', style: { top: '76px' } }));
  const adv = new Advisor('bottom-left');
  adv.say(G.research.done[locId]?.length ? 'กลับมาที่นี่อีกแล้ว ข้อมูลอยู่ในสมุดนะ' : 'เลือกวิธีเก็บข้อมูลทางซ้ายได้เลย ใช้หลายวิธีประกอบกันจะเห็นภาพชัดสุด', 'think');
  const methods = mount(h('div', { class: 'panel col research-sheet', style: { position: 'absolute', left: '20px', top: '150px', width: '300px', gap: '8px', maxHeight: 'calc(100% - 390px)', overflowY: 'auto' } }));
  const notes = mount(h('div', { class: 'panel research-sheet', style: { position: 'absolute', right: '20px', top: '140px', width: '340px', maxHeight: 'calc(100% - 320px)', overflowY: 'auto' } }));
  const dlg = new DialogBox();
  let busy = false;

  // phones: one sheet at a time, switched from a small tab bar, so the scene stays visible
  let tab: 'methods' | 'notes' = 'methods';
  const tabs = mount(h('div', 'research-tabs row'));
  const showTab = (t: typeof tab) => {
    tab = t;
    methods.classList.toggle('tab-off', t !== 'methods');
    notes.classList.toggle('tab-off', t !== 'notes');
    tabs.replaceChildren(btn('🔍 วิธีเก็บข้อมูล', t === 'methods' ? 'pink' : '', () => showTab('methods'), 'small'), btn('📒 สมุดบันทึก', t === 'notes' ? 'pink' : '', () => showTab('notes'), 'small'));
  };
  showTab(tab);

  const draw = () => {
    hud.refresh();
    bar.replaceChildren(prepBar());
    methods.replaceChildren(
      h('h3', {}, '🔍 วิธีเก็บข้อมูล'),
      ...METHODS.map((m) => {
        const can = canUse(G, m, locId);
        const cost = methodCost(m, loc);
        const resume = m.id === 'interview' && talksLeft(G, locId) > 0;
        const done = G.research.done[locId]?.includes(m.id);
        const label = resume ? `🎤 ไปคุยต่อ (เหลือ ${talksLeft(G, locId)} คน)` : can.ok ? 'ทำวิธีนี้' : done ? 'ทำแล้ว ✓' : can.reason;
        const b = btn(label, can.ok || resume ? 'pink' : '', () => (resume ? void interviewRound() : void run(m)), 'small');
        b.disabled = (!can.ok && !resume) || busy;
        return h(
          'div',
          'promo',
          h('div', 'row', h('b', { style: { flex: '1' } }, `${m.icon} ${m.name}`), h('span', 'pill', m.kind)),
          h('div', { class: 'muted', style: { fontSize: '14px' } }, m.desc),
          h('div', { style: { fontSize: '14px' } }, `⏱ ${m.hours} ชม. • ⚡ −${m.energy} • 💰 ${cost ? baht(cost) : 'ฟรี'}`),
          b,
        );
      }),
    );
    notes.replaceChildren(h('h3', {}, `📒 สมุดบันทึก • ${loc.area}`), h('div', { class: 'muted', style: { fontSize: '14px' } }, `ค่าเช่า ${baht(loc.monthlyRent)}/เดือน`), notebookView(locId));
  };

  const dock = mount(
    h(
      'div',
      { class: 'bottom-right row dock research-dock', style: { flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '640px' } },
      btn(`😴 พักผ่อน (+${REST.energy} แรง, ${REST.hours} ชม.)`, '', () => {
        if (busy) return;
        const r = rest(G);
        if (!r.ok) return toast(r.reason, 'bad');
        me.setExpr('happy');
        toast(`พักแล้ว แรงกลับมาเป็น ${G.research.energy}`, 'good');
        draw();
      }),
      btn(`🗺️ ไปดูทำเลอื่น (${MOVE_HOURS} ชม., −${MOVE_ENERGY} แรง)`, '', () => {
        if (busy) return;
        const r = move(G);
        if (!r.ok) return toast(r.reason, 'bad');
        saveGame();
        go('townMap');
      }),
      btn('✓ ตัดสินใจเปิดร้านที่นี่', 'pink', () => decide(), 'big'),
    ),
  );

  /** MIYU tells the result slide by slide, then it stays in the notebook. */
  async function tell(f: Finding): Promise<void> {
    adv.el.style.display = 'none';
    dock.style.visibility = 'hidden';
    await miyuStory(f.title, slidesFor(f));
    adv.el.style.display = '';
    dock.style.visibility = '';
  }

  // ---- interviews: pick who to talk to ----
  let picking = false;
  let banner: HTMLElement | null = null;
  const marker = (w: Walker): HTMLElement => {
    const hint = MOOD_HINT[w.persona.mood];
    const el = h('div', { class: 'talk-label' }, `${w.persona.icon} ${w.persona.tag}`, hint ? h('small', {}, hint) : null);
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      void approach(w);
    });
    return el;
  };
  const showMarkers = (on: boolean) => {
    for (const w of walkers) {
      if (w.label) stage.unlabel(w.label);
      w.label = undefined;
      stage.clickables.delete(w.c.root);
      if (on && !w.gone) {
        w.label = stage.label(w.c.root, marker(w), 2.05);
        stage.click(w.c.root, () => void approach(w));
      }
    }
  };
  const drawBanner = () => {
    banner?.remove();
    banner = mount(h('div', { class: 'top-center panel row', style: { top: '130px', gap: '12px', padding: '8px 16px' } }, h('b', {}, `🎤 เลือกคนที่จะสัมภาษณ์ (เหลือ ${talksLeft(G, locId)} คน)`), btn('จบสัมภาษณ์', '', () => void endInterview(), 'small')));
  };

  async function interviewRound(): Promise<void> {
    if (busy || picking) return;
    picking = true;
    adv.el.style.display = 'none';
    showMarkers(true);
    drawBanner();
    draw();
    toast('คลิกคนที่เดินอยู่เพื่อเข้าไปขอสัมภาษณ์ บางคนอาจรีบจนปฏิเสธนะ', '');
  }

  async function endInterview(): Promise<void> {
    if (!picking) return;
    picking = false;
    showMarkers(false);
    banner?.remove();
    banner = null;
    adv.el.style.display = '';
    const f = findings(locId, 'interview', G);
    saveGame();
    draw();
    if (f.people?.length) await tell(f);
    adv.say(f.people?.length ? 'ได้ฟังเหตุผลจริงๆ แล้ว แต่ก็แค่ไม่กี่คนนะ' : 'ยังไม่ได้คุยกับใครเลย แต่เหนื่อยไปแล้วนะ', f.people?.length ? 'happy' : 'surprised');
    draw();
  }

  /** Hands a bubble tea to somebody: the cup leaves my hand and lands in theirs. */
  async function handTea(w: Walker): Promise<void> {
    const cup = P.bubbleTea('#d9a877', true);
    cup.scale.setScalar(0.9);
    cup.position.set(0, -0.36, 0.07);
    me.arm(1).add(cup);
    me.faceTo(w.c.root.position.x, w.c.root.position.z);
    me.hop(stage);
    await stage.tween(cup.position, { z: 0.5, y: -0.25 }, 450);
    cup.removeFromParent();
    cup.position.set(0, -0.36, 0.07);
    w.c.arm(-1).add(cup);
    w.c.setExpr('surprised');
    await stage.wait(300);
    w.c.setExpr('happy');
    w.c.hop(stage);
    sfx('pop');
    toast('🧋 ยื่นชานมไข่มุกให้แล้ว', 'good');
    await stage.wait(500);
    setTimeout(() => cup.removeFromParent(), 6000);
  }

  async function approach(w: Walker): Promise<void> {
    if (!picking || busy || w.gone) return;
    busy = true;
    showMarkers(false);
    const left = talksLeft(G, locId);
    w.c.root.userData.busy = true;
    w.c.walking = false;
    // they stop and turn to face me, or hurry past
    await walkTo(stage, w.c, me.root.position.x + 1.1, me.root.position.z, 2.8);
    w.c.faceTo(me.root.position.x, me.root.position.z);
    me.faceTo(w.c.root.position.x, w.c.root.position.z);
    const p = w.persona;
    const choice = await dlg.ask(
      { who: 'narrator', text: p.mood === 'busy' ? `${p.name} ดูรีบมาก (เหลือโควต้า ${left})` : `${p.name} หยุดมองคุณ (เหลือโควต้า ${left})` },
      [
        { id: 'ask', label: `ขอสัมภาษณ์หน่อยได้ไหม${polite()}` },
        { id: 'tea', label: `🧋 ยื่นชานมให้ก่อน (฿${TEA_PRICE})` },
        { id: 'back', label: 'ไม่รบกวนแล้ว' },
      ],
    );
    let talked = false;
    if (choice === 'back') {
      dlg.hide();
    } else {
      const tea = choice === 'tea';
      const spent = spendApproach(G, locId, tea);
      if (!spent.ok) {
        toast(spent.reason, 'bad');
        dlg.hide();
      } else {
        dlg.hide();
        if (tea) await handTea(w);
        if (willTalk(p, tea ? 'tea' : 'ask')) {
          const t = talkWith(locId, p, tea);
          recordTalk(G, locId, t);
          w.c.setExpr('happy');
          await dlg.say([{ who: 'narrator', text: `${p.icon} ${p.name}: "${t.quote}"` }]);
          dlg.hide();
          toast(`จดลงสมุดแล้ว: ${t.chips.join(' • ')}`, 'good');
          talked = true;
        } else {
          recordRefusal(G, locId);
          w.c.setExpr('sad');
          await dlg.say([{ who: 'narrator', text: `${p.icon} ${p.name}: "${tea ? 'ขอบคุณสำหรับชานมนะ แต่... ' : ''}${refusal(p)}"` }]);
          dlg.hide();
          sfx('bad');
          toast(`${p.name} ปฏิเสธการสัมภาษณ์`, 'bad');
        }
      }
    }
    me.setExpr(talked ? 'happy' : choice === 'back' ? 'normal' : 'sad');
    w.c.setExpr('normal');
    w.c.root.userData.busy = false;
    saveGame();
    draw();
    busy = false;
    if (talksLeft(G, locId) <= 0) return void endInterview();
    showMarkers(true);
    drawBanner();
  }

  async function run(m: Method) {
    if (busy || !canUse(G, m, locId).ok) return;
    busy = true;
    useMethod(G, m, locId);
    draw();
    sfx('click');
    if (m.id === 'interview') {
      busy = false;
      saveGame();
      draw();
      return void interviewRound();
    }
    const f = findings(locId, m.id, G);
    if (m.id === 'walk') {
      await walkTo(stage, me, 7, 3.4, 3);
      await walkTo(stage, me, -7, 2.6, 3);
      await walkTo(stage, me, -0.6, 3.0, 3);
    } else if (m.id === 'survey') {
      for (const w of walkers) {
        w.c.setExpr('happy');
        w.c.hop(stage);
        await stage.wait(250);
      }
      toast('แจกแบบสอบถามไป 50 ใบ ได้คืนมา 40 ใบ', 'good');
      await stage.wait(600);
    } else if (m.id === 'online') {
      me.setExpr('think');
      toast('📱 กำลังอ่านรีวิวและเมนูในแอป...', '');
      await stage.wait(1500);
    } else {
      await walkTo(stage, me, -6.4, 0.6, 3);
      await stage.wait(1200);
      await walkTo(stage, me, -0.6, 3.0, 3);
      me.setExpr('think');
    }
    saveGame();
    draw();
    await tell(f);
    adv.say(
      m.kind === 'เชิงปริมาณ' ? 'ตัวเลขบอกว่า "อะไร" และ "เท่าไหร่" แต่ไม่บอก "ทำไม" นะ' : 'รู้จักคู่แข่งมากขึ้นแล้ว ลองหาจุดที่เขายังทำไม่ดี แล้วเราทำให้ดีกว่านะ',
      'happy',
    );
    if (G.research.energy < TIRED_BELOW) setTimeout(() => adv.say(`${playerName()} เริ่มเหนื่อยแล้วนะ พักบ้างนะ`, 'surprised'), 3500);
    busy = false;
    draw();
  }

  function decide() {
    if (busy || picking) return;
    const done = G.research.done[locId]?.length ?? 0;
    const deposit = Math.round(loc.monthlyRent * SHOP_SIZES[G.shopSize].rentMult * DEPOSIT_MONTHS);
    const { close } = modal(
      [
        h('h2', {}, `เปิดร้านที่ ${loc.area}?`),
        h('p', {}, done ? `สำรวจที่นี่ไปแล้ว ${done} วิธี` : 'ยังไม่ได้สำรวจที่นี่เลย! เปิดร้านโดยไม่มีข้อมูลเสี่ยงมากนะ'),
        G.research.energy < TIRED_BELOW ? h('p', 'bad', `แรงเหลือ ${G.research.energy} วันแรกจะชงช้าลง 15%`) : h('span'),
        h('div', {}, `ค่ามัดจำ ${DEPOSIT_MONTHS} เดือน ${baht(deposit)} (ได้คืนเมื่อเลิกเช่า) • เงินสดตอนนี้ ${baht(G.cash)}`),
        h('div', { class: 'row', style: { justifyContent: 'center' } }, btn('ขอคิดอีกที', '', () => close()), btn(`ตัดสินใจแล้ว! จ่ายมัดจำ ${baht(deposit)} ›`, 'pink', () => {
          if (G.cash < deposit) return toast('เงินไม่พอจ่ายค่ามัดจำ ลองทำเลที่ค่าเช่าถูกกว่านี้', 'bad');
          close();
          G.cash -= deposit;
          G.deposit = deposit;
          G.location = locId;
          saveGame();
          go('menuSelect');
        }, 'big')),
      ],
      { width: '520px' },
    );
  }

  draw();
}

void INTERVIEW_APPROACHES;
