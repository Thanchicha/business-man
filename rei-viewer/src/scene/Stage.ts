import * as THREE from 'three';

/**
 * Backdrop, floor contact shadow and lights.
 *
 * The key and rim lights ride with the camera, so the cel shading reads the same from every
 * view (front, side, back, 3/4) the way a game character-viewer is lit. Ambient light is kept
 * low enough that the toon ramp's lavender shadows actually show.
 */
export class Stage {
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    scene.background = makeBackdrop();

    this.group.add(new THREE.HemisphereLight('#ffffff', '#cfcbe0', 0.9));

    // Key: high and well to the camera's left, so forms turn into the lavender shade side.
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(-2.4, 1.9, -0.6);
    // Rim: behind and above, picks out the silhouette from every angle.
    const rim = new THREE.DirectionalLight('#f1efff', 0.55);
    rim.position.set(1.6, 1.8, -6.5);
    for (const light of [key, rim]) {
      light.target.position.set(0, 0, -3);
      camera.add(light, light.target);
    }
    scene.add(camera);

    this.group.add(makeContactShadow());
    scene.add(this.group);
  }
}

function makeBackdrop(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#d3d6dc');
  g.addColorStop(1, '#c1c4cb');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeContactShadow(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(90,88,105,0.45)');
  g.addColorStop(0.6, 'rgba(90,88,105,0.18)');
  g.addColorStop(1, 'rgba(90,88,105,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.3),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  mesh.name = 'contactShadow';
  return mesh;
}
