import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { btn, h, mount } from '../ui/dom';
import { bubble } from '../ui/components';
import { go } from '../game/flow';
import { CAST } from '../game/specs';
import { buildStreet } from '../three/sets/street';
import * as P from '../three/models/props';
import type { MiyuModel } from '../three/models/miyu';
import { sfx } from '../ui/sfx';
import { addCat, addChibi, walkTo } from './common';

const SEEN_KEY = 'bubbletea.opening.seen';

/** Whether the opening has been shown on this browser before. */
export function openingSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // private mode: it just plays again next time
  }
}

type Pose = Record<string, [number, number, number]>;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A tablet held in both hands, glowing. */
function tablet(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: '#2a2630' })));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.25), new THREE.MeshBasicMaterial({ color: '#bfe3ff' }));
  screen.position.z = 0.0115;
  g.add(screen);
  return g;
}

/** A phone, held up to film. */
function phone(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.17, 0.012), new THREE.MeshStandardMaterial({ color: '#f4a6c8' })));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.15), new THREE.MeshBasicMaterial({ color: '#202428' }));
  screen.position.z = 0.0065;
  g.add(screen);
  return g;
}

/**
 * The very first thing a new player sees. Each character is introduced with a close-up of their
 * face before the camera pulls away to the next one: MIYU, Mochi, Kuro, Kira, Shion, Rei. Then
 * everybody settles into the title-screen line-up and the title opens. It is all code: the same
 * models and stage as the game, moved on a script (see tools/opening-shots.mjs for stills).
 */
export function openingScreen(stage: Stage): () => void {
  markSeen();
  const e = stage.engine;
  e.viewLocked = true;
  e.daySky();
  e.hemi.intensity = 1.6;
  e.sun.intensity = 2.2;
  stage.add(buildStreet());
  stage.labelInset.top = 90;
  stage.labelInset.bottom = 90;

  // film bars, a fade in from black, a skip button
  const barTop = mount(h('div', 'cine-bar top'));
  const barBottom = mount(h('div', 'cine-bar bottom'));
  const fade = mount(h('div', 'cine-fade'));
  setTimeout(() => fade.remove(), 1500);
  const skipBtn = mount(h('div', 'top-right', btn('ข้าม ▶▶', '', () => finish(), 'small')));
  let rec: HTMLElement | null = null;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    go('title');
  };

  const say = (who: { root: THREE.Object3D }, text: string, ms = 1800, rise = 1.95): Promise<void> => {
    const el = stage.label(who.root, bubble(text, 'big'), rise);
    return stage.wait(ms).then(() => stage.unlabel(el));
  };

  // ---- camera director: it glides toward wherever the shot wants it, so every move eases ----
  const cam = e.camera;
  const camPos = V(0, 1.4, 6);
  const camLook = V(0, 1, 0);
  let posOf: () => THREE.Vector3 = () => camPos;
  let lookOf: () => THREE.Vector3 = () => camLook;
  let ease = 3;
  stage.onUpdate((dt) => {
    const a = 1 - Math.exp(-ease * dt);
    camPos.lerp(posOf(), a);
    camLook.lerp(lookOf(), a);
    cam.position.copy(camPos);
    e.look(camLook.x, camLook.y, camLook.z);
  });
  const val = (v: THREE.Vector3 | (() => THREE.Vector3)) => (typeof v === 'function' ? v : () => v);
  /** Hard cut to a new shot. */
  const cut = (pos: THREE.Vector3 | (() => THREE.Vector3), look: THREE.Vector3 | (() => THREE.Vector3), slow = 0.5) => {
    posOf = val(pos);
    lookOf = val(look);
    camPos.copy(posOf());
    camLook.copy(lookOf());
    ease = slow;
  };
  /** Glide to a new shot (higher speed = quicker). */
  const glide = (pos: THREE.Vector3 | (() => THREE.Vector3), look: THREE.Vector3 | (() => THREE.Vector3), speed = 2) => {
    posOf = val(pos);
    lookOf = val(look);
    ease = speed;
  };
  /** The middle of a character's face. */
  const faceOf = (c: { head: THREE.Object3D }): THREE.Vector3 => c.head.getWorldPosition(V(0, 0, 0)).add(V(0, 0.17, 0));
  /** A close-up of a face: `dist` away, `turn` radians off the direction they face, a little above or below. */
  const closeUp = (c: { root: THREE.Object3D; head: THREE.Object3D }, dist = 1.45, turn = 0.5, rise = 0.04) => ({
    pos: () => {
      const f = faceOf(c);
      const yaw = c.root.rotation.y + turn;
      return V(f.x + Math.sin(yaw) * dist, f.y + rise, f.z + Math.cos(yaw) * dist);
    },
    look: () => faceOf(c).add(V(0, -0.02, 0)),
  });

  // ---- cast: everyone far from where the camera starts, so each one appears in turn ----
  const miyu = addChibi(stage, CAST.advisor, 3.4, 1.5, -Math.PI / 2) as MiyuModel;
  const mochi = addCat(stage, 0, 4.3, 1.7, -Math.PI / 2);
  const kuro = addChibi(stage, CAST.player_m, -6, 1.9, Math.PI / 2) as MiyuModel;
  const kira = addChibi(stage, CAST.player_f, -9, 0.7, 0) as MiyuModel;
  const shion = addChibi(stage, CAST.shion, 5.4, 4.4, -Math.PI / 2) as MiyuModel;
  const rei = addChibi(stage, CAST.rei, 13.4, 1.6, Math.PI / 2) as MiyuModel;
  const girlA = addChibi(stage, CAST.extra_uni_girl, 18, 2.4, -Math.PI / 2);
  const girlB = addChibi(stage, CAST.extra_influencer, 19.2, 1.3, -Math.PI / 2);
  kuro.setExpr('sad');
  rei.setExpr('normal');
  // nobody but MIYU and Mochi is on screen at first; each one is switched on when their scene starts
  const hidden = [kuro, kira, shion, rei, girlA, girlB];
  for (const c of hidden) c.root.visible = false;

  // arm poses are pinned with pose(); props ride on the hands and chest
  const miyuHand = miyu.holder('wristR');
  const cup = P.bubbleTea('#d9a877', true);
  cup.scale.setScalar(1);
  cup.position.set(0, -0.12, 0.06);
  miyuHand.add(cup);
  // the cup stays upright whichever way her wrist turns
  const upright = new THREE.Quaternion();
  stage.onUpdate(() => {
    if (cup.parent) cup.quaternion.copy(cup.parent.getWorldQuaternion(upright).invert());
  });
  const pad = tablet();
  const kiraChest = kira.holder('chest');
  // screen turned toward her face, so the camera sees the back of it
  pad.position.set(0, -0.08, 0.28);
  pad.rotation.set(-0.5, Math.PI, 0);
  kiraChest.add(pad);
  const cam2 = phone();
  const shionHand = shion.holder('wristR');
  cam2.position.set(0.02, -0.04, 0.1);
  shionHand.add(cam2);

  const SIP: Pose = { shoulderR: [-1.2, 0, 0.8], elbowR: [-2.3, -0.3, 0] };
  const HOLD: Pose = { shoulderR: [-0.45, 0, 0.18], elbowR: [-1.2, 0, 0] };
  const OFFER: Pose = { shoulderR: [-1.55, 0, 0.05], elbowR: [-0.3, 0, 0] };
  const READ: Pose = { shoulderL: [-0.85, 0, -0.05], shoulderR: [-0.85, 0, 0.05], elbowL: [-1.35, 0, 0], elbowR: [-1.35, 0, 0], head: [0.5, 0, 0], neck: [0.12, 0, 0] };
  const LOOK_UP: Pose = { ...READ, head: [-0.08, 0.25, 0.05], neck: [0, 0, 0] };
  const FILM: Pose = { shoulderR: [-1.45, 0, 0.2], elbowR: [-0.55, 0, 0] };
  const SLUMP: Pose = { head: [0.2, 0, 0], chest: [0.08, 0, 0], shoulderL: [0, 0, 0.1], shoulderR: [0, 0, -0.1] };

  /** Eases a character's pinned bones toward a pose over `ms`. */
  const current = new WeakMap<object, Pose>();
  async function poseTo(c: MiyuModel, target: Pose, ms = 500): Promise<void> {
    const from = current.get(c) ?? {};
    const keys = new Set([...Object.keys(from), ...Object.keys(target)]);
    const start: Pose = {};
    for (const k of keys) start[k] = from[k] ?? [0, 0, 0];
    const goal: Pose = {};
    for (const k of keys) goal[k] = target[k] ?? [0, 0, 0];
    const now: Pose = {};
    const tmp = { t: 0 };
    const apply = () => {
      for (const k of keys) now[k] = [0, 1, 2].map((i) => start[k][i] + (goal[k][i] - start[k][i]) * tmp.t) as [number, number, number];
      current.set(c, { ...now });
      c.pose({ ...now });
    };
    apply();
    const off = stage.onUpdate(apply);
    await stage.tween(tmp, { t: 1 }, ms);
    off();
    tmp.t = 1;
    apply();
  }

  async function run(): Promise<void> {
    // 1. MIYU: a close-up of her face while she sips her bubble tea
    miyu.setExpr('happy');
    void poseTo(miyu, HOLD, 10);
    let c = closeUp(miyu, 1.5, 0.55, 0.0);
    cut(c.pos, c.look, 1.2);
    await stage.wait(700);
    await poseTo(miyu, SIP, 600);
    sfx('step');
    void say(miyu, 'อื้ม~ ชานมไข่มุก อร่อยที่สุดเลย!', 2300, 1.55);
    await stage.wait(1500);
    await poseTo(miyu, HOLD, 500);

    // 2. Mochi, at her feet: a close-up of the cat, then back out to the two of them
    const mochiHead = () => mochi.root.getWorldPosition(V(0, 0, 0)).add(V(-0.2, 0.4, 0));
    cut(() => mochiHead().add(V(-0.7, 0.05, 0.75)), () => mochiHead().add(V(0, -0.03, 0)), 0.8);
    await stage.wait(500);
    sfx('meow');
    void say(mochi, 'เมี้ยว~', 1500, 0.95);
    await stage.wait(1700);
    glide(V(2.0, 1.45, 4.6), V(3.6, 1.0, 1.6), 1.3);
    await stage.wait(1200);

    // 3. Kuro trudges in from the left: a close-up on his face as he walks toward the camera
    kuro.root.visible = true;
    void walkTo(stage, kuro, 0.1, 1.9, 1.7);
    void poseTo(kuro, SLUMP, 10);
    c = closeUp(kuro, 1.6, 0.35, -0.12);
    cut(c.pos, c.look, 3);
    void say(kuro, '...ตกงานแล้ว', 2400, 1.55);
    await stage.wait(2600);
    // pull out to the two of them as MIYU notices him
    miyu.setExpr('surprised');
    miyu.faceTo(kuro.root.position.x, kuro.root.position.z);
    glide(V(1.4, 1.5, 4.7), V(1.0, 1.15, 1.7), 1.6);
    await stage.wait(900);
    void walkTo(stage, mochi, 3.2, 1.8, 2.4);
    await walkTo(stage, miyu, 1.0, 1.65, 2.3);
    miyu.faceTo(kuro.root.position.x, kuro.root.position.z);
    kuro.faceTo(miyu.root.position.x, miyu.root.position.z);
    miyu.setExpr('wink');
    void say(miyu, 'นี่ค่ะ ชานมเย็นๆ ให้ค่ะ!', 1700);
    void poseTo(kuro, {}, 500);
    await poseTo(miyu, OFFER, 700);

    // 4. the cold cup on his cheek: a close-up of his face, startled and then perked up
    const side = () => faceOf(kuro).add(V(0.35, 0.02, 1.45));
    cut(side, () => faceOf(kuro).add(V(0.2, -0.04, 0)), 1.5);
    stage.group.attach(cup);
    const cheek = faceOf(kuro).add(V(0.2, -0.09, 0.1));
    await stage.tween(cup.position, { x: cheek.x, y: cheek.y, z: cheek.z }, 600);
    sfx('pop');
    kuro.setExpr('surprised');
    kuro.hop(stage);
    await stage.wait(1100);
    kuro.setExpr('happy');
    await poseTo(miyu, HOLD, 600);
    void say(kuro, 'เย็นจัง! ...สดชื่นขึ้นเลย', 1700, 1.55);
    await stage.wait(900);

    // 5. Mochi leaps onto Kuro's neck
    glide(V(1.9, 1.4, 4.6), V(0.8, 1.1, 1.7), 1.4);
    const k = kuro.root.getWorldPosition(V(0, 0, 0));
    const jump = Promise.all([
      stage.tween(mochi.root.position, { x: k.x, z: k.z - 0.02 }, 750),
      (async () => {
        await stage.tween(mochi.root.position, { y: 2.0 }, 330);
        await stage.tween(mochi.root.position, { y: 1.22 }, 420);
      })(),
    ]);
    mochi.root.rotation.y = Math.PI / 2;
    sfx('meow');
    await jump;
    kuro.root.attach(mochi.root);
    mochi.root.rotation.set(0, 0, 0.15);
    // he takes the cup in his hand
    const kuroHand = kuro.holder('wristR');
    kuroHand.add(cup);
    cup.position.set(0, -0.12, 0.06);
    kuro.setExpr('surprised');
    cut(() => faceOf(kuro).add(V(0.3, -0.05, 1.55)), () => faceOf(kuro).add(V(0.05, -0.12, 0)), 1.2);
    await stage.wait(1300);
    kuro.setExpr('happy');
    await stage.wait(500);

    // 6. he glances back: Kira's face, bent over her tablet, then she looks up at them
    kuro.faceTo(-6, 0.7);
    void poseTo(kuro, {}, 400);
    kira.root.visible = true;
    kira.faceTo(0, 8);
    void poseTo(kira, READ, 10);
    kira.root.position.set(-5.2, 0, 1.0);
    c = closeUp(kira, 1.55, 0.3, -0.02);
    cut(c.pos, c.look, 1.0);
    await stage.wait(1700);
    kira.faceTo(0.6, 1.7);
    await poseTo(kira, LOOK_UP, 800);
    await stage.wait(1300);
    glide(() => faceOf(kira).add(V(1.2, 0.0, 2.4)), () => faceOf(kira).add(V(2.0, -0.1, 0)), 0.9);
    await stage.wait(900);

    // 7. Shion, cheerful: her face, then she films the two of them (the phone's own view, with REC)
    shion.root.visible = true;
    shion.setExpr('happy');
    shion.root.position.set(5.0, 0, 3.3);
    shion.faceTo(0.7, 1.7);
    c = closeUp(shion, 1.5, 0.55, 0.04);
    cut(c.pos, c.look, 1.1);
    void say(shion, 'อัดคลิปไว้ก่อนนะ~ 🎥', 1900, 1.55);
    await stage.wait(700);
    await poseTo(shion, FILM, 700);
    await stage.wait(900);
    rec = mount(h('div', 'rec-ui', h('div', 'rec-corner tl'), h('div', 'rec-corner tr'), h('div', 'rec-corner bl'), h('div', 'rec-corner br'), h('div', 'rec-dot', '● REC'), h('div', 'rec-time', '00:00')));
    let secs = 0;
    const recTimer = setInterval(() => rec && (rec.querySelector('.rec-time')!.textContent = `00:0${Math.min(9, ++secs)}`), 700);
    sfx('pop');
    const mid = () => V(0.55, 1.2, 1.75);
    cut(V(4.6, 1.5, 4.2), mid, 0.5);
    miyu.setExpr('happy');
    kuro.setExpr('happy');
    miyu.faceTo(5.0, 3.3);
    kuro.faceTo(5.0, 3.3);
    glide(V(3.6, 1.45, 3.8), mid, 0.35);
    miyu.hop(stage);
    await stage.wait(2300);
    clearInterval(recTimer);
    rec.remove();
    rec = null;

    // 8. Rei: his face as two girls ask for his LINE, and he turns them down
    rei.root.visible = true;
    girlA.root.visible = true;
    girlB.root.visible = true;
    rei.setExpr('annoyed');
    rei.root.position.set(13.4, 0, 1.6);
    rei.faceTo(15, 1.6);
    c = closeUp(rei, 1.45, 0.8, 0.02);
    cut(c.pos, c.look, 1.0);
    void walkTo(stage, girlA, 14.7, 2.0, 3.4);
    void walkTo(stage, girlB, 15.0, 1.3, 3.4);
    await stage.wait(900);
    girlA.faceTo(rei.root.position.x, rei.root.position.z);
    girlB.faceTo(rei.root.position.x, rei.root.position.z);
    girlA.setExpr('happy');
    girlB.setExpr('wink');
    void say(girlA, 'ขอไลน์ได้ไหมคะ 💚', 1800);
    await stage.wait(1000);
    void say(girlB, 'นะคะ นะ~', 1400);
    await stage.wait(900);
    void say(rei, 'ขอโทษนะ ไม่สะดวกครับ', 1800, 1.55);
    await stage.wait(1500);
    girlA.setExpr('sad');
    girlB.setExpr('sad');
    void walkTo(stage, girlA, 22, 2.4, 2.4);
    void walkTo(stage, girlB, 22, 1.3, 2.4);
    rei.faceTo(4, 1.7);
    rei.setExpr('surprised');
    void say(rei, 'นั่นมัน... มิว กับ คุโระ!', 1900, 1.55);
    await stage.wait(1500);

    // 9. they all run over
    rei.setExpr('happy');
    shion.setExpr('happy');
    kira.setExpr('happy');
    void poseTo(shion, {}, 300);
    void poseTo(kira, {}, 300);
    cam2.visible = false;
    pad.visible = false;
    cup.visible = false;
    void say(shion, 'ไปกัน!', 1300);
    cut(V(7.5, 1.9, 8.5), V(5, 1.1, 1.8), 1.3);
    glide(V(3.2, 2.0, 9.0), V(2.4, 1.1, 1.9), 1.0);
    void walkTo(stage, rei, 3.2, 2.1, 5.4);
    void walkTo(stage, shion, 4.4, 1.4, 4.6);
    void walkTo(stage, kira, 1.5, 2.4, 3.6);
    await stage.wait(2200);
    miyu.setExpr('surprised');
    kuro.setExpr('surprised');
    await stage.wait(700);

    // 10. the line-up of the title screen, and the title opens
    glide(V(-0.5, 1.65, 9.8), V(0.5, 2.0, 0), 1.4);
    stage.group.attach(mochi.root);
    const lineup: [MiyuModel, number, number, number][] = [
      [shion, 0.2, 1.0, 0.55],
      [rei, 2.6, 1.2, -0.5],
      [kira, 0.9, 3.0, 0.4],
      [kuro, 4.0, 2.4, -0.7],
      [miyu, 2.3, 4.3, -0.12],
    ];
    void stage.tween(mochi.root.position, { x: 3.4, y: 0, z: 3.7 }, 700);
    mochi.root.rotation.set(0, -0.6, 0);
    await Promise.all(
      lineup.map(async ([who, x, z, yaw]) => {
        await walkTo(stage, who, x, z, 4);
        await stage.tween(who.root.rotation, { y: yaw }, 400);
      }),
    );
    for (const who of [shion, rei, kira, kuro, miyu]) who.setExpr('normal');
    await stage.wait(300);
    finish();
  }

  void run();

  return () => {
    ended = true;
    barTop.remove();
    barBottom.remove();
    skipBtn.remove();
    fade.remove();
    rec?.remove();
    stage.labelInset.top = 8;
    stage.labelInset.bottom = 8;
  };
}
