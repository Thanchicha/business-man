import * as THREE from 'three';
import * as P from '../models/props';
import { canvasTexture, mat, mesh } from '../models/mat';

export interface RoomSet {
  group: THREE.Group;
  seat: THREE.Vector3;
  monitorLight: THREE.PointLight;
  /** Swap the monitor content: scrolling code, or the HR email. */
  showMail(on: boolean): void;
  update(dt: number): void;
}

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, o: Parameters<typeof mat>[1] = {}): THREE.Mesh {
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color, o));
  m.position.set(x, y, z);
  return m;
}

/** Big window view: the city at night under a violet sky, a tall tower and a moon. */
function nightCity(): THREE.CanvasTexture {
  return canvasTexture(512, 320, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 320);
    g.addColorStop(0, '#1d2258');
    g.addColorStop(0.6, '#4b3f8f');
    g.addColorStop(1, '#c47aae');
    c.fillStyle = g;
    c.fillRect(0, 0, 512, 320);
    for (let i = 0; i < 80; i++) {
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect((i * 173) % 512, (i * 71) % 150, 2, 2);
    }
    c.fillStyle = '#fff3d0';
    c.beginPath();
    c.arc(420, 60, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#25296a';
    c.beginPath();
    c.arc(410, 54, 20, 0, Math.PI * 2);
    c.fill();
    // tower
    c.fillStyle = '#2a2d5e';
    c.fillRect(250, 60, 8, 240);
    c.beginPath();
    c.arc(254, 120, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff6a6a';
    c.fillRect(252, 52, 4, 8);
    // two rows of lit buildings
    for (const [base, col, lit] of [[230, '#2f3270', 0.35], [320, '#1c1f4a', 0.5]] as [number, string, number][]) {
      for (let x = 0; x < 512; x += 30) {
        const h = 60 + ((x * 7) % 90) + (base === 320 ? 40 : 0);
        c.fillStyle = col;
        c.fillRect(x, base - h, 26, h);
        for (let y = base - h + 6; y < base - 6; y += 10)
          for (let wx = x + 3; wx < x + 22; wx += 7) {
            if (((x * 13 + y * 7 + wx) % 100) / 100 < lit) {
              c.fillStyle = (wx + y) % 3 ? '#ffd98a' : '#ffb8d8';
              c.fillRect(wx, y, 4, 5);
            }
          }
      }
    }
  });
}

/** Pink neon cat face sign. */
function neonCat(line = '#ff8cc6', glow = '#ff4fa8'): THREE.Mesh {
  const tex = canvasTexture(200, 170, (c) => {
    c.strokeStyle = line;
    c.shadowColor = glow;
    c.shadowBlur = 16;
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(36, 78);
    c.lineTo(52, 22);
    c.lineTo(82, 54);
    c.lineTo(118, 54);
    c.lineTo(148, 22);
    c.lineTo(164, 78);
    c.arc(100, 96, 66, -0.3, Math.PI + 0.3);
    c.closePath();
    c.stroke();
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(72, 96);
    c.lineTo(72, 108);
    c.moveTo(128, 96);
    c.lineTo(128, 108);
    c.moveTo(92, 124);
    c.quadraticCurveTo(100, 132, 108, 124);
    c.stroke();
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.85), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

/** Plush-ish cat: white body with ears, sitting. */
function plushCat(color = '#ffffff'): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.22, 16, 12), mat(color));
  body.scale.set(1, 0.85, 0.9);
  body.position.y = 0.18;
  const head = mesh(new THREE.SphereGeometry(0.17, 16, 12), mat(color));
  head.position.set(0, 0.42, 0.04);
  g.add(body, head);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.06, 0.1, 4), mat(color));
    ear.position.set(s * 0.09, 0.57, 0.02);
    const eye = mesh(new THREE.SphereGeometry(0.018, 8, 6), mat('#3a2a34'), false);
    eye.position.set(s * 0.06, 0.44, 0.19);
    const blush = mesh(new THREE.CircleGeometry(0.03, 12), mat('#ffb3cc'), false);
    blush.position.set(s * 0.1, 0.4, 0.2);
    g.add(ear, eye, blush);
  }
  return g;
}

function hangingPlant(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.015, 0.5, 0.015, '#d8c8b0', 0, 0.25, 0));
  const pot = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 14), mat('#f3e2d0'));
  g.add(pot);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const vine = mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(i % 2 ? '#5f9e4a' : '#7dba5f'), false);
    vine.position.set(Math.cos(a) * 0.14, -0.1 - (i % 3) * 0.12, Math.sin(a) * 0.14);
    g.add(vine);
  }
  g.position.set(x, y, z);
  return g;
}

/** Colours for the two bedrooms: pastel pink for her, black and charcoal for him. */
const THEMES = {
  cute: { wall: '#e7cfe6', wall2: '#e2c8e2', ceiling: '#f6eaf3', wainscot: '#fbf4f8', trim: '#f3d6e6', frame: '#ffffff', curtain: '#ffd6e8', bulb: '#fff1c8', bulbGlow: '#ffcf70', neon: '#ff7ab8', neonLine: '#ff8cc6', neonGlow: '#ff4fa8', shelf: '#ffffff', books: ['#ffb3cc', '#c9e8ff', '#fff1c8', '#d6c8f5', '#ffd6e6'], plush: '#ffe4ef', poster1: '#f6c1d4', poster2: '#bfe0f7', desk: '#ffffff', deskLeg: '#f3eef5', monitor: '#f4f0f6', keyboard: '#ffc8de', lamp: '#ffffff', shade: '#ffe0ec', chair: '#ffb3d0', chairBase: '#ffffff', bed: '#fbf4f8', blanket: '#ffc8de', pillow1: '#ffffff', pillow2: '#ffe4ef', rug: '#ffc8de', cushion: '#d6c8f5', catEars: true },
  dark: { wall: '#2c2c34', wall2: '#26262d', ceiling: '#1f1f25', wainscot: '#3a3a44', trim: '#4a4a56', frame: '#1c1c22', curtain: '#4a4a58', bulb: '#e6f4ff', bulbGlow: '#9fd0ff', neon: '#6fd6ff', neonLine: '#9fe8ff', neonGlow: '#3fb8ff', shelf: '#2f2f38', books: ['#5a5a66', '#8a8a96', '#3a3a44', '#c9ccd3', '#6f6f7c'], plush: '#2f2f36', poster1: '#3f4466', poster2: '#6b2f3f', desk: '#1f1f25', deskLeg: '#2a2a32', monitor: '#16161a', keyboard: '#2a2a32', lamp: '#1c1c22', shade: '#3a3a44', chair: '#1e1e24', chairBase: '#2a2a32', bed: '#2a2a32', blanket: '#1b1b20', pillow1: '#d8d8de', pillow2: '#5a5a66', rug: '#3a3a44', cushion: '#4a4a56', catEars: false },
};

/** The player's bedroom at night, lit by monitors, a neon sign and fairy lights. */
export function buildRoom(style: keyof typeof THEMES = 'cute'): RoomSet {
  const K = THEMES[style];
  const g = new THREE.Group();
  // light wood floor
  const planks = canvasTexture(128, 128, (c) => {
    for (let y = 0; y < 128; y += 16) {
      c.fillStyle = (y / 16) % 2 ? (style === 'dark' ? '#4a3b31' : '#d9b48e') : style === 'dark' ? '#3f3229' : '#cfa982';
      c.fillRect(0, y, 128, 16);
      c.fillStyle = 'rgba(120,80,50,0.3)';
      c.fillRect(0, y, 128, 1);
    }
  });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping;
  planks.repeat.set(4, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ map: planks, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // lilac-pink walls with white wainscot
  g.add(box(10, 5, 0.3, K.wall, 0, 2.5, -5), box(0.3, 5, 10, K.wall2, -5, 2.5, 0), box(10, 0.1, 10, K.ceiling, 0, 5, 0), box(0.3, 5, 10, K.wall2, 5, 2.5, 0));
  g.add(box(10, 0.9, 0.34, K.wainscot, 0, 0.45, -5), box(0.34, 0.9, 10, K.wainscot, -5, 0.45, 0));
  g.add(box(10, 0.06, 0.36, K.trim, 0, 0.92, -5), box(0.36, 0.06, 10, K.trim, -5, 0.92, 0));
  // big window on the left wall with sheer pink curtains and fairy lights along the top
  const win = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), new THREE.MeshBasicMaterial({ map: nightCity() }));
  win.position.set(-4.84, 2.6, -0.4);
  win.rotation.y = Math.PI / 2;
  g.add(win);
  for (const [y, z, h, w] of [[1.4, -0.4, 0.12, 4.4], [3.8, -0.4, 0.12, 4.4], [2.6, -2.55, 2.5, 0.12], [2.6, 1.75, 2.5, 0.12], [2.6, -0.4, 2.4, 0.06]] as [number, number, number, number][])
    g.add(box(0.12, h, w, K.frame, -4.8, y, z));
  for (const z of [-2.9, 2.1]) {
    const curtain = mesh(new THREE.BoxGeometry(0.04, 3.0, 0.8), mat(K.curtain, { opacity: 0.75 }));
    curtain.position.set(-4.7, 2.5, z);
    g.add(curtain);
  }
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i <= 18; i++) {
    const z = -2.7 + i * 0.25;
    const b = mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(K.bulb, { emissive: K.bulbGlow }), false);
    b.position.set(-4.65, 3.95 - Math.sin((i / 18) * Math.PI) * 0.18, z);
    g.add(b);
    bulbs.push(b);
  }
  // neon cat on the back wall, shelves with figures and plants
  const neon = neonCat(K.neonLine, K.neonGlow);
  neon.position.set(2.7, 3.35, -4.84);
  g.add(neon);
  const neonLight = new THREE.PointLight(K.neon, 5, 6, 1.6);
  neonLight.position.set(2.7, 3.2, -4.2);
  g.add(neonLight);
  for (const y of [2.2, 2.75]) g.add(box(2.0, 0.07, 0.4, K.shelf, 2.6, y, -4.75));
  ['#7fc8f8', '#ffc94d', '#ff9fc4', '#a993f5'].forEach((c, i) => g.add(box(0.18, 0.3, 0.18, c, 1.9 + i * 0.45, 2.39, -4.72)));
  K.books.forEach((c, i) => g.add(box(0.1, 0.32, 0.26, c, 1.8 + i * 0.13, 2.94, -4.72)));
  const shelfCat = plushCat(K.plush);
  shelfCat.scale.setScalar(0.6);
  shelfCat.position.set(3.2, 2.79, -4.72);
  g.add(shelfCat);
  for (const [x, y] of [[-1.8, 3.4], [-0.4, 3.0]]) {
    // framed little posters
    g.add(box(0.8, 1.0, 0.04, K.frame, x, y, -4.83), box(0.66, 0.86, 0.05, x < -1 ? K.poster1 : K.poster2, x, y, -4.82));
  }
  g.add(hangingPlant(1.3, 3.6, -4.4), hangingPlant(-3.9, 3.7, 2.6));
  // white desk with two monitors, pink keyboard and a cat mug
  g.add(box(3.6, 0.1, 1.4, K.desk, 0.4, 1.2, -3.9));
  for (const x of [-1.1, 1.9]) g.add(box(0.1, 1.2, 1.2, K.deskLeg, x, 0.6, -3.9));
  g.add(box(0.8, 0.5, 1.1, K.deskLeg, 1.45, 0.4, -3.9));
  const codeCanvas = document.createElement('canvas');
  codeCanvas.width = 256;
  codeCanvas.height = 160;
  const codeTex = new THREE.CanvasTexture(codeCanvas);
  codeTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: codeTex });
  for (const [x, w] of [[-0.2, 1.5], [1.35, 1.1]] as [number, number][]) {
    g.add(box(w + 0.1, 0.95, 0.08, K.monitor, x, 1.95, -4.3));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.82), screenMat);
    scr.position.set(x, 1.95, -4.25);
    g.add(scr, box(0.08, 0.4, 0.08, K.monitor, x, 1.45, -4.35));
  }
  g.add(box(1, 0.05, 0.35, K.keyboard, 0.3, 1.29, -3.6));
  const mug = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 14), mat('#ffffff'));
  mug.position.set(-0.75, 1.33, -3.55);
  g.add(mug);
  if (K.catEars) for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.03, 0.05, 4), mat('#ffffff'));
    ear.position.set(-0.75 + s * 0.045, 1.43, -3.55);
    g.add(ear);
  }
  const lamp = new THREE.Group();
  lamp.add(box(0.2, 0.04, 0.2, K.lamp, 0, 0.02, 0), box(0.03, 0.4, 0.03, K.lamp, 0, 0.22, 0));
  const shade = mesh(new THREE.ConeGeometry(0.16, 0.18, 16, 1, true), mat(K.shade, { emissive: '#ffd0a0', side: THREE.DoubleSide }), false);
  shade.position.y = 0.46;
  lamp.add(shade);
  lamp.position.set(1.95, 1.25, -3.6);
  g.add(lamp);
  const deskLight = new THREE.PointLight('#ffd6a8', 2.5, 4, 1.6);
  deskLight.position.set(1.95, 1.7, -3.4);
  g.add(deskLight);
  const deskPlant = P.plant(0.6);
  deskPlant.position.set(-0.95, 1.25, -4.1);
  g.add(deskPlant);
  // gaming chair (with cat ears in the pink room)
  const chair = new THREE.Group();
  chair.add(box(0.8, 0.14, 0.8, K.chair, 0, 0.75, 0), box(0.8, 1.05, 0.14, K.chair, 0, 1.32, 0.38), box(0.5, 0.3, 0.05, '#ffffff', 0, 1.5, 0.3));
  if (K.catEars) for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.14, 0.26, 4), mat(K.chair));
    ear.position.set(s * 0.26, 1.95, 0.38);
    ear.rotation.y = Math.PI / 4;
    chair.add(ear);
  }
  const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7), mat(K.chairBase));
  post.position.y = 0.38;
  chair.add(post);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    chair.add(box(0.4, 0.05, 0.06, K.chairBase, Math.cos(a) * 0.2, 0.05, Math.sin(a) * 0.2));
  }
  chair.position.set(0.3, 0, -2.4);
  g.add(chair);
  // bed with a pink blanket, pillows and a cat plush; round cat rug
  g.add(box(2.4, 0.45, 3.4, K.bed, -3.5, 0.23, 2.6), box(2.3, 0.18, 2.4, K.blanket, -3.5, 0.55, 3.0), box(2.4, 1.0, 0.15, K.bed, -3.5, 0.7, 0.95));
  g.add(box(0.9, 0.22, 0.55, K.pillow1, -4.0, 0.6, 1.4), box(0.9, 0.22, 0.55, K.pillow2, -3.0, 0.6, 1.4));
  const bedCat = plushCat(style === 'dark' ? '#2f2f36' : '#ffffff');
  bedCat.position.set(-3.0, 0.62, 2.2);
  bedCat.rotation.y = 0.5;
  g.add(bedCat);
  const rug = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 32), mat(K.rug));
  rug.position.set(-0.8, 0.015, 1.2);
  g.add(rug);
  if (K.catEars) for (const s of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.0, 0.42, 0.03, 3), mat(K.rug));
    ear.position.set(-0.8 + s * 0.75, 0.015, 0.0);
    ear.rotation.y = s * 0.3 + Math.PI;
    g.add(ear);
  }
  // little things on the floor: a suitcase and a cushion
  g.add(box(0.6, 0.8, 0.3, '#c9c4d6', 2.8, 0.4, -1.4), box(0.2, 0.06, 0.04, '#8e8a9e', 2.8, 0.83, -1.4));
  const cushion = mesh(new THREE.SphereGeometry(0.35, 16, 10), mat(K.cushion));
  cushion.scale.set(1, 0.4, 1);
  cushion.position.set(1.6, 0.14, 0.4);
  g.add(cushion);

  const monitorLight = new THREE.PointLight('#a8d8ff', 6, 7, 1.6);
  monitorLight.position.set(0.5, 2, -3.4);
  g.add(monitorLight);

  let mail = false;
  let t = 0;
  let line = 0;
  let tt = 0;
  const colors = ['#7fc8f8', '#ffc94d', '#5cc9a7', '#ff7eb6', '#d8d4e2'];
  const draw = () => {
    const c = codeCanvas.getContext('2d')!;
    c.fillStyle = '#1d1a33';
    c.fillRect(0, 0, 256, 160);
    if (mail) {
      c.fillStyle = '#ffffff';
      c.fillRect(30, 30, 196, 100);
      c.fillStyle = '#7fb2f0';
      c.fillRect(30, 30, 196, 22);
      c.fillStyle = '#ffffff';
      c.font = '600 14px Mitr';
      c.fillText('✉ HR', 40, 46);
      c.fillStyle = '#4a3448';
      c.font = '13px Mitr';
      c.fillText('เรื่อง: ปรับโครงสร้างองค์กร', 40, 76);
      c.fillText('ระบบ AI จะเขียนโค้ดแทน...', 40, 98);
    } else {
      for (let row = 0; row < 11; row++) {
        const seed = (row + line) * 7919;
        let x = 10 + (seed % 4) * 12;
        for (let k = 0; k < 3; k++) {
          const w = 18 + ((seed >> (k + 2)) % 5) * 14;
          if (x + w > 246) break;
          c.fillStyle = colors[(seed + k) % colors.length];
          c.fillRect(x, 10 + row * 13, w, 6);
          x += w + 10;
        }
      }
    }
    codeTex.needsUpdate = true;
  };
  draw();
  return {
    group: g,
    seat: new THREE.Vector3(0.3, 0.55, -2.55),
    monitorLight,
    showMail(on) {
      mail = on;
      draw();
    },
    update(dt) {
      t += dt;
      tt += dt;
      if (!mail && t > 0.35) {
        t = 0;
        line++;
        draw();
      }
      monitorLight.intensity = 5.5 + Math.sin(performance.now() / 300) * 0.5;
      bulbs.forEach((b, i) => b.scale.setScalar(0.8 + 0.3 * Math.max(0, Math.sin(tt * 2 + i))));
      neonLight.intensity = 4.6 + Math.sin(tt * 6) * 0.3;
    },
  };
}
