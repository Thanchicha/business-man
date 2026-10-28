import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();

/** Soft, matte, pastel material, cached by colour and options. */
export function mat(color: string, o: { rough?: number; emissive?: string; opacity?: number; side?: THREE.Side; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.rough ?? 0.75}|${o.emissive ?? ''}|${o.opacity ?? 1}|${o.side ?? 0}|${o.flat ?? false}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.75,
      metalness: 0,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.emissive ? 0.6 : 0,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      flatShading: o.flat ?? false,
    });
    cache.set(key, m);
  }
  return m;
}

/** A canvas-drawn texture, e.g. for stripes, signs and screens. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const texCache = new Map<string, THREE.Material>();

export function texMat(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, o: { rough?: number; emissive?: boolean } = {}): THREE.MeshStandardMaterial {
  let m = texCache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    const map = canvasTexture(w, h, draw);
    m = new THREE.MeshStandardMaterial({ map, roughness: o.rough ?? 0.8, emissive: o.emissive ? '#ffffff' : '#000000', emissiveMap: o.emissive ? map : null, emissiveIntensity: o.emissive ? 0.9 : 0 });
    texCache.set(key, m);
  }
  return m;
}

/** Shorthand for a mesh that casts and receives shadows. */
export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/** Text sign drawn on a canvas; returns a plane mesh. */
export function signPlane(text: string, w: number, h: number, o: { bg?: string; fg?: string; font?: string; border?: string } = {}): THREE.Mesh {
  const scale = 128;
  const material = texMat(`sign|${text}|${w}|${h}|${o.bg}|${o.fg}`, Math.round(w * scale), Math.round(h * scale), (ctx) => {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    ctx.fillStyle = o.bg ?? '#fff7fb';
    ctx.beginPath();
    ctx.roundRect(0, 0, cw, ch, ch * 0.25);
    ctx.fill();
    if (o.border) {
      ctx.strokeStyle = o.border;
      ctx.lineWidth = ch * 0.08;
      ctx.beginPath();
      ctx.roundRect(ch * 0.06, ch * 0.06, cw - ch * 0.12, ch - ch * 0.12, ch * 0.2);
      ctx.stroke();
    }
    ctx.fillStyle = o.fg ?? '#e0558f';
    ctx.font = `600 ${Math.round(ch * 0.5)}px ${o.font ?? 'Mitr, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2 + ch * 0.04);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
}
