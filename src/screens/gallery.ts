import * as THREE from 'three';
import type { Stage } from '../three/engine';
import { Chibi, Cat, CAT_COATS } from '../three/models/character';
import { CAST, extraSpec, randomCustomer, type Expr } from '../game/specs';
import * as P from '../three/models/props';
import { h, mount } from '../ui/dom';
import { portrait } from '../three/portrait';
import { buildTown } from '../three/sets/town';
import { createCharacter, MiyuModel } from '../three/models/miyu';
import { LOOKS } from '../three/chars/extra/character/looks';

/** Dev-only (?screen=gallery[&set=town]): check the models. */
export function gallery(stage: Stage): void {
  const e = stage.engine;
  if (new URLSearchParams(location.search).get('set') === 'miyu') {
    const g = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.MeshStandardMaterial({ color: '#fbe3ec' }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    stage.add(g);
    const key = (new URLSearchParams(location.search).get('m') ?? 'miyu') as 'miyu' | 'kuro' | 'kira';
    [0, -Math.PI / 2, Math.PI, 0.6].forEach((yaw, i) => {
      const m = new MiyuModel(key);
      m.root.position.set(-2.4 + i * 1.6, 0, 0);
      m.root.rotation.y = yaw;
      m.setExpr(i === 3 ? 'wink' : 'normal');
      stage.add(m.root);
    });
    e.camera.position.set(0, 1.4, 5.2);
    e.look(0, 0.85, 0);
    const exprs: Expr[] = ['normal', 'happy', 'wink', 'surprised', 'think', 'sad', 'annoyed'];
    const row = mount(h('div', 'bottom-center panel row'));
    const castKey = key === 'miyu' ? 'advisor' : key === 'kuro' ? 'player_m' : 'player_f';
    for (const ex of exprs) row.append(h('img', { src: portrait(castKey, CAST[castKey], ex), width: 110 }));
    return;
  }
  if (new URLSearchParams(location.search).get('set') === 'cast') {
    // the background cast: one rigged model per look, front and then three-quarter view
    const g = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: '#fbe3ec' }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    stage.add(g);
    const looks = Object.values(LOOKS);
    const chars = looks.map((look, i) => {
      const c = createCharacter(extraSpec(look));
      c.root.position.set((i - (looks.length - 1) / 2) * 1.35, 0, 0);
      c.root.rotation.y = i % 2 ? -0.35 : 0.35;
      c.setExpr(i % 3 === 0 ? 'happy' : 'normal');
      stage.add(c.root);
      return c;
    });
    stage.onUpdate((dt) => chars.forEach((c) => c.update(dt)));
    e.camera.position.set(0, 1.5, 12);
    e.look(0, 0.8, 0);
    return;
  }
  if (new URLSearchParams(location.search).get('set') === 'town') {
    const town = buildTown();
    stage.add(town.group);
    stage.onUpdate(town.update);
    e.camera.position.set(0, 30, 38);
    e.look(0, 0, 0);
    return;
  }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ color: '#a9d79f' }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  stage.add(ground);
  const exprs: Expr[] = ['normal', 'happy', 'surprised', 'think', 'sad', 'annoyed', 'wink'];
  const chars: Chibi[] = [];
  Object.keys(CAST).forEach((k, i) => {
    const c = new Chibi(CAST[k]);
    c.root.position.set(-4 + i * 2, 0, 0);
    c.setExpr(exprs[i % exprs.length]);
    stage.add(c.root);
    chars.push(c);
  });
  for (let i = 0; i < 5; i++) {
    const c = new Chibi(randomCustomer(i + 3));
    c.root.position.set(-4 + i * 2, 0, -2.5);
    c.walking = i % 2 === 0;
    stage.add(c.root);
    chars.push(c);
  }
  const cats = CAT_COATS.map(([a, b], i) => {
    const cat = new Cat(a, b);
    cat.root.position.set(-3 + i * 1.2, 0, 2);
    stage.add(cat.root);
    return cat;
  });
  const cup = P.bubbleTea('#d9a877', true);
  cup.position.set(2, 0, 2);
  cup.scale.setScalar(2);
  stage.add(cup);
  stage.onUpdate((dt) => {
    chars.forEach((c) => c.update(dt));
    cats.forEach((c) => c.update(dt));
  });
  e.camera.position.set(0, 2.2, 8);
  e.look(0, 0.9, 0);
  const row = mount(h('div', 'top-left panel row'));
  for (const ex of exprs) row.append(h('img', { src: portrait('advisor', CAST.advisor, ex), width: 96 }));
}
