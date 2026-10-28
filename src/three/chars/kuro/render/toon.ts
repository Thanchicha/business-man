import * as THREE from 'three';

/**
 * Anime cel-shading toolkit.
 *
 * `toonMaterial` is a MeshToonMaterial whose gradient ramp is read as RGB (stock three.js only
 * reads `.r`), so every material can have its own tinted shadow color — e.g. white cloth shades
 * to cool lavender-gray instead of plain gray. A soft rim term adds the airy edge light seen in
 * the reference.
 */

export interface ToonOptions {
  /** Lit color (sRGB hex). */
  color: THREE.ColorRepresentation;
  /** First shadow tone (sRGB hex). Defaults to a cool darkened version of `color`. */
  shade?: THREE.ColorRepresentation;
  /** Optional deeper core-shadow tone; enables a 3-step ramp. */
  deep?: THREE.ColorRepresentation;
  /** Where the lit/shade terminator sits on the 0..1 half-lambert ramp. */
  threshold?: number;
  /** Ramp softness (0 = hard cel edge). */
  softness?: number;
  /** Rim light strength (0 disables). */
  rim?: number;
  rimColor?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
  /** Emissive boost — keeps very bright things (whites) from going gray under weak light. */
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
}

const rampCache = new Map<string, THREE.DataTexture>();

/** Builds (and caches) a 256px RGB ramp texture: deep → shade → lit, divided by lit color. */
function buildRamp(lit: THREE.Color, shade: THREE.Color, deep: THREE.Color | null, threshold: number, softness: number): THREE.DataTexture {
  const key = [lit.getHexString(), shade.getHexString(), deep?.getHexString() ?? '-', threshold, softness].join('|');
  const cached = rampCache.get(key);
  if (cached) return cached;

  const size = 256;
  const data = new Uint8Array(size * 4);
  // Ramp values are multipliers on the lit diffuse color, computed in linear space.
  const ratio = (c: THREE.Color, ch: 'r' | 'g' | 'b') => Math.min(1, c[ch] / Math.max(lit[ch], 1e-4));
  const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - e0) / Math.max(e1 - e0, 1e-5)));
    return t * t * (3 - 2 * t);
  };
  const deepThreshold = threshold * 0.55;
  for (let i = 0; i < size; i++) {
    const x = i / (size - 1);
    const tLit = smooth(threshold - softness, threshold + softness, x);
    const tDeep = deep ? smooth(deepThreshold - softness, deepThreshold + softness, x) : 1;
    for (const [j, ch] of (['r', 'g', 'b'] as const).entries()) {
      const s = deep ? THREE.MathUtils.lerp(ratio(deep, ch), ratio(shade, ch), tDeep) : ratio(shade, ch);
      const v = THREE.MathUtils.lerp(s, 1, tLit);
      data[i * 4 + j] = Math.round(Math.min(1, v) * 255);
    }
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  rampCache.set(key, tex);
  return tex;
}

/** Cool, slightly lavender darkening used when no explicit shade color is given. */
export function defaultShade(color: THREE.ColorRepresentation, amount = 0.18): THREE.Color {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const tint = new THREE.Color().setHSL(0.7, 0.18, Math.max(0, hsl.l - amount));
  return c.clone().lerp(tint, 0.65).multiplyScalar(1 - amount * 0.35);
}

export function toonMaterial(opts: ToonOptions): THREE.MeshToonMaterial {
  const lit = new THREE.Color(opts.color);
  const shade = opts.shade !== undefined ? new THREE.Color(opts.shade) : defaultShade(lit);
  const deep = opts.deep !== undefined ? new THREE.Color(opts.deep) : null;
  const ramp = buildRamp(lit, shade, deep, opts.threshold ?? 0.56, opts.softness ?? 0.035);

  const mat = new THREE.MeshToonMaterial({
    color: lit,
    gradientMap: ramp,
    map: opts.map ?? null,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    alphaTest: opts.alphaTest ?? 0,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });

  const rim = opts.rim ?? 0.12;
  const rimColor = new THREE.Color(opts.rimColor ?? 0xffffff);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uRimColor = { value: rimColor };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <gradientmap_pars_fragment>',
        /* glsl */ `
#ifdef USE_GRADIENTMAP
  uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float dotNL = dot( normal, lightDirection );
  vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.5 );
  #ifdef USE_GRADIENTMAP
    return texture2D( gradientMap, coord ).rgb;
  #else
    return vec3( 1.0 );
  #endif
}
uniform float uRim;
uniform vec3 uRimColor;
`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
{
  float facing = clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );
  float rimT = smoothstep( 0.55, 0.95, 1.0 - facing );
  outgoingLight += uRimColor * uRim * rimT;
}
#include <opaque_fragment>
`,
      );
  };
  // Distinct program per rim value so the cache does not share a compiled variant incorrectly.
  mat.customProgramCacheKey = () => `toon-rim-${rim.toFixed(3)}`;
  return mat;
}

/** Flat unlit material for tiny details (stitches, line accents, decals). */
export function flatMaterial(color: THREE.ColorRepresentation, extra: THREE.MeshBasicMaterialParameters = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

// ---------------------------------------------------------------------------------------------
// Inverted-hull outlines
// ---------------------------------------------------------------------------------------------

export const OUTLINE_COLOR = new THREE.Color('#4b4857');

const outlineMaterials = new Map<string, THREE.ShaderMaterial>();

/**
 * Outline material: back faces pushed out along the normal. Width is in world units but scaled
 * by view distance so lines stay roughly constant in screen space while zooming.
 */
export function outlineMaterial(width = 0.0024, color: THREE.ColorRepresentation = OUTLINE_COLOR): THREE.ShaderMaterial {
  const c = new THREE.Color(color);
  const key = `${width}|${c.getHexString()}`;
  const cached = outlineMaterials.get(key);
  if (cached) return cached;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: width }, uColor: { value: c } },
    // Skinning chunks are no-ops on plain meshes and deform the hull on skinned ones.
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      uniform float uWidth;
      void main() {
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mvPos = modelViewMatrix * vec4( transformed, 1.0 );
        vec3 n = normalize( normalMatrix * objectNormal );
        float dist = clamp( -mvPos.z, 0.5, 12.0 );
        mvPos.xyz += n * uWidth * ( dist / 3.0 );
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4( uColor, 1.0 ); }
    `,
    side: THREE.BackSide,
    // Push hulls slightly back in depth so they don't speckle through surfaces lying close in front.
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
  });
  outlineMaterials.set(key, mat);
  return mat;
}

/** Adds an outline hull as a child of `mesh` (shares geometry). Returns the hull. */
export function addOutline(mesh: THREE.Mesh, width = 0.0024, color?: THREE.ColorRepresentation): THREE.Mesh {
  const hull = new THREE.Mesh(mesh.geometry, outlineMaterial(width, color));
  hull.name = `${mesh.name || 'mesh'}__outline`;
  hull.userData.isOutline = true;
  hull.renderOrder = mesh.renderOrder;
  mesh.add(hull);
  return hull;
}

/** Convenience: mesh + toon material + outline in one call. */
export function toonMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: { name?: string; outline?: number | false; outlineColor?: THREE.ColorRepresentation } = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  if (opts.name) mesh.name = opts.name;
  if (opts.outline !== false) addOutline(mesh, opts.outline ?? 0.0024, opts.outlineColor);
  return mesh;
}
