import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { MIYU, modal } from '../ui/components';
import { bubbleTea } from '../three/models/props';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { clearSave, hasSave, loadGame, resetGame } from '../sim/GameState';
import { isMuted, setMuted, sfx } from '../ui/sfx';
import { portrait } from '../three/portrait';
import { addCat, addChibi } from './common';
import { buildStreet } from '../three/sets/street';
import { setMiyuTalking } from '../three/models/miyu';
import { inRoom } from '../coop/session';
import { openLobby, playWithFriends } from './coopLobby';
import { mountCover, type CoverHandle } from './cover';

/** Big bubbly logo: purple outline, white rim, pink fill, like the cover art. */
export function logo(lines: string[]): HTMLElement {
  const layer = (cls: string) => h('div', cls, ...lines.flatMap((l, i) => (i ? [h('br'), l] : [l])));
  return h('div', 'logo3', layer('l-back'), layer('l-mid'), layer('l-top'), h('span', 'spark s1', '✦'), h('span', 'spark s2', '★'), h('span', 'spark s3', '✦'), h('span', 'logo-cup', '🧋'));
}

export function titleScreen(stage: Stage): (() => void) | void {
  stage.engine.viewLocked = true;
  stage.add(buildStreet());
  // cover cast: everyone stands clear of the menu on the left, with their feet above the bottom edge
  const cast: [string, number, number, number][] = [
    ['shion', 0.2, 1.0, 0.55],
    ['rei', 2.6, 1.2, -0.5],
    ['player_f', 0.9, 3.0, 0.4],
    ['player_m', 4.0, 2.4, -0.7],
    ['advisor', 2.3, 4.3, -0.12],
  ];
  const chars = cast.map(([k, x, z, yaw]) => addChibi(stage, CAST[k], x, z, yaw));
  const miyu = chars[4];
  chars.forEach((c) => c.setExpr('normal'));
  const cup = bubbleTea('#d9a877', true);
  cup.position.set(0, -0.36, 0.07);
  miyu.arm(1).add(cup);
  addCat(stage, 0, 3.4, 3.7, -0.6);
  // she says her greeting when the title appears
  setTimeout(() => setMiyuTalking(true), 600);
  setTimeout(() => setMiyuTalking(false), 3400);
  let t = 0;
  stage.onUpdate((dt) => {
    t += dt;
    chars.forEach((c, i) => (c.root.position.y = Math.max(0, Math.sin(t * 2 + i)) * 0.04));
    stage.engine.camera.position.set(-0.5 + Math.sin(t * 0.15) * 0.3, 1.65, 9.8);
    const tall = stage.engine.camera.aspect < 1;
    if (tall) stage.engine.camera.position.set(-0.2 + Math.sin(t * 0.15) * 0.3, 1.7, 11.5);
    stage.engine.look(tall ? 1.4 : 0.5, tall ? 0.6 : 2.0, 0);
  });

  const left = h('div', { class: 'col title-menu' });
  left.append(logo(['My Bubble Tea', 'Journey']), h('div', 'logo-sub', 'จากไอเดียเล็กๆ สู่ร้านชานมในฝัน'));
  left.append(btn('▶  เริ่มเกม', 'pink', () => chooseCharacter(), 'big start'));
  if (hasSave()) left.append(btn('⟳  เล่นต่อ', 'mint', () => loadGame() && go('map')));
  left.append(btn('👥  เล่นกับเพื่อน', 'lav', () => (inRoom() ? openLobby() : playWithFriends())));
  left.append(btn('📖  คู่มือการเล่น', '', guide));
  const sound = btn(isMuted() ? '🔇  เสียง: ปิด' : '🔊  เสียง: เปิด', '', () => {
    setMuted(!isMuted());
    sound.textContent = isMuted() ? '🔇  เสียง: ปิด' : '🔊  เสียง: เปิด';
  });
  left.append(sound, btn('👤  เครดิต', '', credits));
  left.append(h('div', 'title-quote', '"ร้านเล็กๆ...', h('br'), 'เริ่มได้จากความฝันของเรา"'));
  mount(left);
  const say = stage.label(miyu.head, h('div', 'bubble big title-say', h('div', 'tip-head', `🐾 ${MIYU}`), `สวัสดี! เรา "${MIYU}" มาเปิดร้านชานมด้วยกันนะ!`), 0.75);
  mount(h('div', 'top-right pill', '🐾 Demo • Chapter 1'));

  // painted cover art replaces the 3D scene when public/cover/layers.json exists (?cover=3d keeps the scene)
  if (new URLSearchParams(location.search).get('cover') === '3d') return;
  let cover: CoverHandle | null = null;
  let left3d = false;
  void mountCover(document.getElementById('app')!).then((c) => {
    if (!c) return;
    if (left3d) return c.dispose();
    cover = c;
    stage.group.visible = false;
    say.style.display = 'none';
  });
  return () => {
    left3d = true;
    cover?.dispose();
  };
}

function chooseCharacter(): void {
  const opts: ['player_m' | 'player_f', string, string][] = [
    ['player_m', 'ผู้ชาย', 'โปรแกรมเมอร์หนุ่ม'],
    ['player_f', 'ผู้หญิง', 'โปรแกรมเมอร์สาว'],
  ];
  const row = h('div', 'row', ...opts.map(([key, name, role]) => {
    const card = h('div', { class: 'card', style: { width: '230px', textAlign: 'center' } }, h('img', { src: portrait(key, CAST[key], 'normal'), width: 190, style: { borderRadius: '16px', background: '#f6eef3' } }), h('h3', {}, name), h('div', 'muted', role));
    card.addEventListener('click', () => {
      sfx('done');
      clearSave();
      resetGame(key);
      close();
      go('intro');
    });
    return card;
  }));
  const { close } = modal([h('h2', { style: { textAlign: 'center' } }, 'เลือกตัวละครเริ่มต้น'), h('p', { class: 'muted', style: { textAlign: 'center' } }, 'เลือกหน้าตาตัวละคร (ชื่อจะได้ตั้งเองตอนเจอ มิว)'), row, h('div', { style: { textAlign: 'center', marginTop: '14px' } }, btn('ย้อนกลับ', '', () => close()))]);
}

function guide(): void {
  const lines = [
    'เดินด้วยปุ่มลูกศร / WASD หรือคลิกที่พื้นเพื่อเดินไปตรงนั้น',
    'ลากเมาส์เพื่อหมุนมุมกล้อง • คลิกขวาลาก (หรือกด Shift ค้างแล้วลาก) เพื่อเลื่อน • หมุนล้อเมาส์เพื่อซูม • มือถือใช้สองนิ้วซูม/เลื่อน',
    'คลิกชั้นวางสินค้าเพื่อหยิบของ (เมื่อเดินไปใกล้ๆ)',
    'มิว จะคอยแนะนำ แต่ไม่บอกคำตอบ ลองตัดสินใจเอง!',
    'ซื้อของทีละเยอะได้ส่วนลด และลองต่อราคาได้ถ้ายอดซื้อสูงพอ',
    'นมสดเก็บได้ 2 วัน น้ำแข็งละลายภายในวัน ซื้อให้พอดี',
    'ตอนเปิดร้าน ฟังเสียงลูกค้า แล้วเลือกว่าจะตอบอย่างไร',
    'ทุกเย็นมีสรุปบัญชีอัตโนมัติ ดูว่ากำไรหรือขาดทุน',
    'เดโมมีทั้งหมด 7 วัน ยิ่งนานยิ่งยากขึ้น!',
  ];
  const { close } = modal([h('h2', {}, 'คู่มือการเล่น'), h('ul', { style: { lineHeight: '1.9', fontSize: '18px' } }, ...lines.map((l) => h('li', {}, l))), btn('เข้าใจแล้ว', 'pink', () => close())], { width: '640px' });
}

function credits(): void {
  const { close } = modal([h('h2', {}, 'My Bubble Tea Journey (Demo)'), h('p', 'muted', 'โมเดล 3D ทุกชิ้นสร้างจากรูปทรงพื้นฐานด้วยโค้ดในเกม'), h('p', 'muted', 'ฟอนต์ Mitr (SIL Open Font License) • สร้างด้วย Three.js'), btn('ปิด', 'pink', () => close())], { width: '520px' });
}

