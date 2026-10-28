import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { askName, DialogBox, MIYU, playerName, polite } from '../ui/components';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { G } from '../sim/GameState';
import { buildRoom, buildStreet } from '../three/sets/interiors';
import { addCat, addChibi, walkTo } from './common';
import { sfx } from '../ui/sfx';
import * as P from '../three/models/props';

/** Story: a programmer replaced by AI meets MIYU, who suggests a bubble tea & cat café. */
export function introScreen(stage: Stage): void {
  const dlg = new DialogBox();
  mount(h('div', 'top-right', btn('ข้าม ▶▶', '', () => skip(), 'small')));
  room(stage, dlg).then(() => street(stage, dlg));
}

async function room(stage: Stage, dlg: DialogBox): Promise<void> {
  const e = stage.engine;
  e.setSky('#2a2048', false);
  e.hemi.color.set('#e2d0ff');
  e.hemi.groundColor.set('#c9a0b8');
  e.hemi.intensity = 0.85;
  e.sun.intensity = 0.3;
  const set = buildRoom(G.playerKey === 'player_m' ? 'dark' : 'cute');
  stage.add(set.group);
  stage.onUpdate(set.update);
  const me = addChibi(stage, CAST[G.playerKey], set.seat.x, set.seat.z, Math.PI);
  me.root.position.y = 0.42;
  // he types away
  stage.onUpdate(() => (me.head.rotation.x = Math.sin(performance.now() / 180) * 0.03));
  e.camera.position.set(3.8, 3.2, 3.2);
  e.look(0.2, 1.6, -3);
  stage.cameraTo(new THREE.Vector3(2.6, 2.6, 1.2), new THREE.Vector3(0.1, 1.7, -3.6), 4000);

  await dlg.say([
    { who: 'narrator', text: 'กรุงเทพฯ ตีสองครึ่ง...' },
    { who: 'narrator', text: 'โปรแกรมเมอร์คนหนึ่งยังนั่งทำงานอยู่หน้าจอ' },
    { who: 'me', text: 'อีกนิดเดียว... บั๊กตัวนี้ต้องแก้ให้เสร็จก่อนเช้า', expr: 'annoyed' },
  ]);
  sfx('pop');
  set.showMail(true);
  await stage.cameraTo(new THREE.Vector3(1.2, 2.2, -1.6), new THREE.Vector3(-0.2, 1.95, -4.3), 900);
  await dlg.say([
    { who: 'narrator', text: 'ติ๊ง! อีเมลใหม่จากฝ่ายบุคคล' },
    { who: 'boss', text: 'ขอบคุณสำหรับการทำงานที่ผ่านมา บริษัทจะใช้ระบบ AI เขียนโค้ดแทนทีมพัฒนาทั้งหมด ตั้งแต่วันพรุ่งนี้เป็นต้นไป' },
  ]);
  me.root.rotation.y = Math.PI * 0.7;
  me.setExpr('surprised');
  await stage.cameraTo(new THREE.Vector3(1.9, 2.0, -0.4), new THREE.Vector3(0.3, 1.5, -2.55), 700);
  await dlg.say([
    { who: 'me', text: 'เดี๋ยวนะ... AI มาแทนเราแล้วเหรอ!?', expr: 'surprised' },
    { who: 'me', text: 'งานก็ไม่มี เงินเก็บรวมกับที่ยืมที่บ้านก็มีแค่ 180,000 บาท...', expr: 'sad' },
    { who: 'me', text: 'หรือจะลองทำธุรกิจของตัวเองดู? แต่เราไม่เคยทำธุรกิจมาก่อนเลย', expr: 'think' },
  ]);
  dlg.hide();
  await stage.wait(200);
}

async function street(stage: Stage, dlg: DialogBox): Promise<void> {
  const e = stage.engine;
  stage.group.clear();
  e.daySky();
  e.hemi.intensity = 1.6;
  e.sun.intensity = 2.2;
  stage.add(buildStreet());
  e.camera.position.set(0.5, 2.8, 9);
  e.look(0.5, 1.2, 0);
  const me = addChibi(stage, CAST[G.playerKey], -9, 1.5);
  const miyu = addChibi(stage, CAST.advisor, 10, 1.5);
  const cat = addCat(stage, 0, 11.2, 1.8);
  const cup = P.bubbleTea('#d9a877', true);
  cup.scale.setScalar(0.9);
  cup.position.set(0, -0.36, 0.07);
  miyu.arm(-1).add(cup);

  await dlg.say([{ who: 'narrator', text: 'เย็นวันนั้น ระหว่างเดินเล่นให้หัวโล่ง...' }]);
  dlg.hide();
  me.setExpr('sad');
  await walkTo(stage, me, -0.8, 1.5, 2);
  me.root.rotation.y = Math.PI / 2;
  await stage.wait(300);
  walkTo(stage, cat, 2.5, 1.0, 2.2);
  await walkTo(stage, miyu, 1.4, 1.5, 2.6);
  miyu.root.rotation.y = -Math.PI / 2;
  cat.root.rotation.y = 0;
  miyu.setExpr('happy');
  miyu.hop(stage);
  // aim low so everyone's feet (and the cat) stay above the dialogue box
  stage.cameraTo(new THREE.Vector3(0.6, 2.1, 7.4), new THREE.Vector3(0.6, 0.55, 1.5), 900);

  // strangers at first: polite until MIW learns the player's name
  const p = polite();
  const lines = [
    { who: 'miyu' as const, text: 'ขอโทษนะ... คุณดูไม่ค่อยสบายใจเลย เป็นอะไรรึเปล่า?', expr: 'surprised' as const },
    { who: 'me' as const, text: `เพิ่งโดนเลิกจ้าง${p} บริษัทเอา AI มาทำงานแทน`, expr: 'sad' as const },
    { who: 'miyu' as const, text: 'แย่เลย... เอานี่ไปดื่มก่อน ชานมไข่มุก ดื่มแล้วจะรู้สึกดีขึ้น', expr: 'happy' as const },
    { who: 'miyu' as const, text: 'ส่วนนี่โมจิ แมวของเรา', expr: 'wink' as const },
    { who: 'me' as const, text: `ขอบคุณ${p}... แล้วคุณเป็นใครเหรอ${p}?`, expr: 'think' as const },
    { who: 'miyu' as const, text: `เราชื่อ ${MIYU} เรียนจบบริหารมา ชอบเรื่องธุรกิจกับแมว`, expr: 'wink' as const },
  ];
  for (const l of lines) {
    if (l.who === 'me') me.setExpr(l.expr);
    else miyu.setExpr(l.expr);
    await dlg.say([l]);
  }
  miyu.setExpr('happy');
  G.playerName = await dlg.prompt({ who: 'miyu', text: 'แล้วคุณล่ะ ชื่อเล่นอะไร?', expr: 'happy' }, 'พิมพ์ชื่อเล่นของคุณ...');
  miyu.setExpr('wink');
  miyu.hop(stage);
  const more = [
    { who: 'miyu' as const, text: `${playerName()} เหรอ ยินดีที่ได้รู้จักนะ ต่อไปเราเรียก ${playerName()} เลยนะ ไม่ต้องคุณๆ กันแล้ว`, expr: 'wink' as const },
    { who: 'me' as const, text: `ได้เลย ${MIYU}... ตอนนี้อยากทำธุรกิจเอง แต่ไม่รู้จะเริ่มยังไงเลย`, expr: 'sad' as const },
    { who: 'miyu' as const, text: 'งั้นลองเปิดร้านชานมไหม? ต้นทุนแก้วละสิบกว่าบาท ขายได้สามสี่สิบบาท แล้วทำมุมคาเฟ่แมวด้วยก็ได้นะ', expr: 'think' as const },
    { who: 'miyu' as const, text: `แต่ทำธุรกิจต้องคิดหลายเรื่องนะ ${playerName()} ทั้งทำเล คู่แข่ง ต้นทุน ค่าเช่า แล้วก็ลูกค้า`, expr: 'normal' as const },
    { who: 'miyu' as const, text: `เราจะคอยช่วยแนะนำ แต่${playerName()}เป็นคนตัดสินใจเองนะ ถ้าพลาดก็ถือว่าเป็นบทเรียน`, expr: 'happy' as const },
  ];
  for (const l of more) {
    if (l.who === 'me') me.setExpr(l.expr);
    else miyu.setExpr(l.expr);
    await dlg.say([l]);
  }
  me.setExpr('happy');
  me.hop(stage);
  await dlg.say([{ who: 'me', text: '...ตกลง! ลองดูสักตั้ง!', expr: 'happy' }]);
  dlg.hide();
  go('shopType');
}

/** Skipping the story still asks for the player's name, which MIW uses from then on. */
async function skip(): Promise<void> {
  if (!G.playerName) G.playerName = await askName();
  go('shopType');
}
