import * as THREE from 'three';
import * as C from '../models/city';
import { canvasTexture, mat, mesh } from '../models/mat';
import { bubbleTea, plant } from '../models/props';

/**
 * Rooftop café terrace at night, like the key art: wooden deck and railing with
 * flower boxes, strings of warm fairy lights, lanterns, cushioned seats, a little
 * bar with a pink neon cat, and a glittering skyline under a moon and stars.
 * The characters stand around z = 2.4 with the railing and the city behind them.
 */
export interface TerraceSet {
  group: THREE.Group;
  update(dt: number): void;
}

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, o: Parameters<typeof mat>[1] = {}): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
  m.position.set(x, y, z);
  return m;
}

/** Night sky dome: deep indigo to violet-pink at the horizon, stars, a crescent moon and a shooting star. */
function nightSky(): THREE.Mesh {
  const tex = canvasTexture(1024, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#141a4a');
    g.addColorStop(0.55, '#3a3585');
    g.addColorStop(0.85, '#8a5aa8');
    g.addColorStop(1, '#d784b4');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 260; i++) {
      const x = (i * 397) % 1024;
      const y = (i * 151) % 360;
      c.fillStyle = `rgba(255,255,255,${0.35 + ((i * 7) % 10) / 15})`;
      c.fillRect(x, y, i % 9 === 0 ? 3 : 2, i % 9 === 0 ? 3 : 2);
    }
    // crescent moon
    c.fillStyle = '#fff6d8';
    c.beginPath();
    c.arc(720, 110, 30, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a2052';
    c.beginPath();
    c.arc(708, 100, 28, 0, Math.PI * 2);
    c.fill();
    // shooting star
    const s = c.createLinearGradient(380, 60, 520, 120);
    s.addColorStop(0, 'rgba(255,255,255,0)');
    s.addColorStop(1, 'rgba(255,255,255,0.9)');
    c.strokeStyle = s;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(380, 60);
    c.lineTo(520, 120);
    c.stroke();
    // soft pink clouds near the horizon
    c.fillStyle = 'rgba(214,140,190,0.35)';
    for (const [x, y, r] of [[120, 380, 60], [190, 395, 50], [600, 370, 70], [680, 390, 55], [900, 380, 60]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(90, 90, 80, 48, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
  sky.position.y = 22;
  return sky;
}

/** Warm bulb on a string of fairy lights. */
const bulbMat = () => mat('#fff1c8', { emissive: '#ffcf70' });

function fairyString(a: THREE.Vector3, b: THREE.Vector3, sag: number, n: number, g: THREE.Group, bulbs: THREE.Mesh[]): void {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(Math.PI * t) * sag;
    pts.push(p);
  }
  const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.01, 4), mat('#3a2f35'));
  g.add(wire);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= Math.sin(Math.PI * t) * sag + 0.06;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bulbMat());
    bulb.position.copy(p);
    g.add(bulb);
    bulbs.push(bulb);
  }
}

function lantern(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.26, 0.04, 0.26, '#3a2f35', 0, 0.36, 0), box(0.24, 0.03, 0.24, '#3a2f35', 0, 0, 0));
  for (const [dx, dz] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) g.add(box(0.02, 0.36, 0.02, '#3a2f35', dx, 0.18, dz));
  const glow = mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), mat('#ffe6b0', { emissive: '#ffb860', opacity: 0.9 }), false);
  glow.position.y = 0.18;
  g.add(glow);
  g.position.set(x, y, z);
  return g;
}

function cushionSeat(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 0.4, 0.6, '#9a6a45', 0, 0.2, 0), box(1.0, 0.14, 0.52, color, 0, 0.47, 0.02), box(1.1, 0.5, 0.12, '#9a6a45', 0, 0.55, -0.26));
  const pillow = mesh(new THREE.SphereGeometry(0.2, 14, 10), mat('#ffffff'));
  pillow.scale.set(1, 0.8, 0.45);
  pillow.position.set(0.3, 0.68, -0.15);
  g.add(pillow);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.06, 0.1, 4), mat('#ffffff'));
    ear.position.set(0.3 + s * 0.1, 0.84, -0.15);
    g.add(ear);
  }
  return g;
}

export function buildTerrace(): TerraceSet {
  const g = new THREE.Group();
  g.add(nightSky());
  // wooden deck
  const deck = canvasTexture(128, 128, (c) => {
    for (let y = 0; y < 128; y += 16) {
      c.fillStyle = (y / 16) % 2 ? '#8a5f42' : '#7d5439';
      c.fillRect(0, y, 128, 16);
      c.fillStyle = 'rgba(40,20,10,0.35)';
      c.fillRect(0, y, 128, 1);
    }
  });
  deck.wrapS = deck.wrapT = THREE.RepeatWrapping;
  deck.repeat.set(6, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshStandardMaterial({ map: deck, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 2;
  floor.receiveShadow = true;
  g.add(floor);
  // railing with flower boxes along the edge, the city behind it
  g.add(box(16, 0.08, 0.12, '#6e4a33', 0, 1.05, -0.6), box(16, 0.06, 0.08, '#6e4a33', 0, 0.55, -0.6));
  for (let x = -7.5; x <= 7.5; x += 0.5) g.add(box(0.06, 1.05, 0.06, '#6e4a33', x, 0.52, -0.6));
  for (const x of [-5.5, -2.8, 2.8, 5.5]) {
    const fb = C.flowerBed(1.8, 0.35, x * 5);
    fb.position.set(x, 1.08, -0.6);
    g.add(fb);
  }
  // ivy creeping along the railing
  for (let i = 0; i < 40; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.09, 6, 5), mat(i % 3 ? '#4f8a46' : '#6fae55'), false);
    leaf.position.set(-7.5 + i * 0.38 + Math.sin(i) * 0.1, 0.9 + Math.sin(i * 1.7) * 0.18, -0.55);
    leaf.scale.set(1, 0.7, 0.5);
    g.add(leaf);
  }
  // café bar on the right with a pink neon cat
  const bar = new THREE.Group();
  bar.add(box(2.4, 1.1, 0.8, '#7d5439', 0, 0.55, 0), box(2.5, 0.08, 0.9, '#a8774f', 0, 1.12, 0));
  bar.add(box(2.6, 2.6, 0.2, '#5e3f2c', 0, 1.3, -0.9));
  bar.add(box(2.8, 0.12, 1.6, '#3a2f35', 0, 2.65, -0.2));
  for (let i = 0; i < 3; i++) {
    const cup = bubbleTea(['#d9a877', '#c9a8e6', '#f39a4f'][i], i !== 1);
    cup.position.set(-0.6 + i * 0.5, 1.16, 0.1);
    bar.add(cup);
  }
  bar.add(box(2.2, 0.05, 0.25, '#a8774f', 0, 2.0, -0.75));
  for (let i = 0; i < 6; i++) bar.add(box(0.12, 0.2, 0.12, ['#ffd6e6', '#fff1c8', '#c9e8ff'][i % 3], -0.9 + i * 0.36, 2.13, -0.72));
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.7),
    new THREE.MeshBasicMaterial({
      transparent: true,
      fog: false,
      map: canvasTexture(160, 140, (c) => {
        c.strokeStyle = '#ff7ab8';
        c.shadowColor = '#ff4fa0';
        c.shadowBlur = 14;
        c.lineWidth = 7;
        c.beginPath();
        c.moveTo(30, 60);
        c.lineTo(42, 18);
        c.lineTo(66, 44);
        c.lineTo(94, 44);
        c.lineTo(118, 18);
        c.lineTo(130, 60);
        c.arc(80, 76, 52, -0.35, Math.PI + 0.35);
        c.closePath();
        c.stroke();
        c.fillStyle = '#ff9ccb';
        c.fillRect(58, 68, 8, 10);
        c.fillRect(94, 68, 8, 10);
      }),
    }),
  );
  neon.position.set(0, 1.6, -0.79);
  bar.add(neon);
  const neonLight = new THREE.PointLight('#ff7ab8', 5, 6, 1.5);
  neonLight.position.set(0, 1.6, -0.3);
  bar.add(neonLight);
  bar.position.set(5.2, 0, 2.2);
  bar.rotation.y = -Math.PI / 2.4;
  g.add(bar);
  // seats, a low table and potted plants
  for (const [x, z, rot, col] of [[-4.2, 2.2, Math.PI / 2.6, '#f6c1d4'], [-3.6, 4.4, Math.PI / 1.6, '#efe2cf']] as [number, number, number, string][]) {
    const s = cushionSeat(col);
    s.position.set(x, 0, z);
    s.rotation.y = rot;
    g.add(s);
  }
  const table = new THREE.Group();
  table.add(box(0.9, 0.06, 0.6, '#a8774f', 0, 0.45, 0), box(0.06, 0.45, 0.06, '#6e4a33', -0.38, 0.22, -0.24), box(0.06, 0.45, 0.06, '#6e4a33', 0.38, 0.22, 0.24));
  table.add(lantern(0.2, 0.48, 0));
  const tcup = bubbleTea('#d9a877', true);
  tcup.position.set(-0.2, 0.48, 0.05);
  table.add(tcup);
  table.position.set(-3.0, 0, 3.2);
  g.add(table);
  for (const [x, z, s] of [[-6.6, 0.2, 1.6], [6.8, 0.0, 1.5], [-6.2, 4.6, 1.3], [3.4, 0.2, 1.1]]) {
    const p = plant(s);
    p.position.set(x, 0, z);
    g.add(p);
  }
  g.add(lantern(-1.6, 1.12, -0.6), lantern(2.0, 1.12, -0.6));
  // fairy lights strung overhead between posts
  const bulbs: THREE.Mesh[] = [];
  for (const x of [-6.5, 6.5]) for (const z of [-0.5, 5.5]) g.add(box(0.1, 3.2, 0.1, '#5e3f2c', x, 1.6, z));
  fairyString(new THREE.Vector3(-6.5, 3.1, -0.5), new THREE.Vector3(6.5, 3.1, -0.5), 0.5, 26, g, bulbs);
  fairyString(new THREE.Vector3(-6.5, 3.1, -0.5), new THREE.Vector3(6.5, 3.1, 5.5), 0.7, 30, g, bulbs);
  fairyString(new THREE.Vector3(6.5, 3.1, -0.5), new THREE.Vector3(-6.5, 3.1, 5.5), 0.7, 30, g, bulbs);
  for (const [x, z] of [[-3, 1.5], [3, 1.5]]) {
    const l = new THREE.PointLight('#ffc98a', 4, 8, 1.6);
    l.position.set(x, 2.6, z);
    g.add(l);
  }
  // the skyline: lit towers stepping back into the night
  for (let i = 0; i < 34; i++) {
    const row = i % 3;
    const h = 6 + ((i * 37) % 17) + row * 4;
    const b = C.building({ w: 3 + (i % 3), d: 3, h, style: (['glass', 'office', 'apartment'] as const)[i % 3], wall: ['#4a4f78', '#5a5f86', '#3f4468'][i % 3], night: true, seed: i + 50 });
    b.position.set(-60 + (i % 12) * 10.5 + row * 3.5, -12, -26 - row * 12 - (i % 4) * 1.5);
    g.add(b);
  }
  // a tall TV tower with a red tip, like the art
  const tower = new THREE.Group();
  tower.add(mesh(new THREE.CylinderGeometry(0.4, 1.2, 30, 8), mat('#5a5f86')), mesh(new THREE.SphereGeometry(1.2, 12, 8), mat('#fff1c8', { emissive: '#ffd890' })));
  tower.children[0].position.y = 15;
  tower.children[1].position.y = 22;
  const tip = mesh(new THREE.SphereGeometry(0.35, 8, 6), mat('#ff6060', { emissive: '#ff3030' }), false);
  tip.position.y = 30.5;
  tower.add(tip);
  tower.position.set(16, -12, -48);
  g.add(tower);

  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      // fairy lights twinkle gently, the tower tip blinks
      bulbs.forEach((b, i) => b.scale.setScalar(0.85 + 0.25 * Math.max(0, Math.sin(t * 2 + i * 1.3))));
      tip.visible = Math.sin(t * 3) > -0.3;
      neonLight.intensity = 4.5 + Math.sin(t * 7) * 0.3 + (Math.sin(t * 23) > 0.97 ? -2 : 0);
    },
  };
}
