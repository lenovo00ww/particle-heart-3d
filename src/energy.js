import * as T from 'three';
import { pointCloud } from './particles.js';

export const BASE_Y = -1.85;
const TAU = Math.PI * 2;
const PATHS = 31;
const RINGS = 9;
const SEGMENTS = 44;

function trailPoint(target, i, time, progress, life) {
  const ring = i < RINGS;
  const angle = i * 2.39996 + time * (.7 + (i % 3) * .28) + progress * (ring ? 3.6 : 1.9 + (i % 4) * .47) + (.20 + (i % 4) * .07) * Math.sin(progress * (5 + i % 4) + i);
  const radius = ring
    ? (.39 + (i % 5) * .145) * (.72 + progress * .34)
    : .20 + (i % 6) * .14 * Math.sin(Math.PI * progress) + .68 * progress ** 2;
  const height = ring
    ? .03 + (i % 4) * .065 + .11 * Math.sin(progress * 5 + i)
    : progress * (1.18 + (i % 5) * .46) + .095 * Math.sin(angle * 1.7) * Math.sin(Math.PI * progress);
  return target.set(Math.cos(angle) * radius, BASE_Y + height + (ring ? 0 : life * .1), Math.sin(angle) * radius);
}

export function energyEffects() {
  const group = new T.Group();
  const tracks = new T.BufferGeometry();
  const positions = new Float32Array(PATHS * SEGMENTS * 6);
  const strength = new Float32Array(PATHS * SEGMENTS * 2);
  tracks.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
  tracks.setAttribute('strength', new T.BufferAttribute(strength, 1).setUsage(T.DynamicDrawUsage));
  const material = new T.ShaderMaterial({
    vertexShader: `
      attribute float strength;
      varying float light;
      void main() {
        light = strength;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying float light;
      void main() { gl_FragColor = vec4(.11, 1.15, 2.15, light); }
    `,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  });
  const lines = new T.LineSegments(tracks, material);
  lines.frustumCulled = false;

  const heads = pointCloud(PATHS, '', 0.35);
  const energy = pointCloud(900, `
    float travel = fract(p.y + clock * (.17 + .21 * fract(phase)));
    float angle = p.x + travel * 5.5 + clock * .95;
    float radius = p.z * (.68 + .57*sin(travel * 3.1416)) * (1.0 - .36*travel);
    p = vec3(cos(angle)*radius, ${BASE_Y.toFixed(2)} + travel*(1.8 + .7*fract(phase)), sin(angle)*radius);
    flowFade = smoothstep(0.0,.09,travel) * (1.0-smoothstep(.65,1.0,travel));
  `, .55);
  const base = pointCloud(370, `
    float spin = clock * (.55 + position.y*.7);
    p = vec3(cos(spin)*p.x - sin(spin)*p.z, p.y, sin(spin)*p.x + cos(spin)*p.z);
    p.y += .051 * sin(clock*3.2+phase);
  `, .55);
  for (let i = 0; i < energy.opacity.length; i++) {
    energy.positions.set([Math.random() * TAU, Math.random(), Math.random() ** 1.6 * 1.19], i * 3);
    energy.colors.set([.05, .47 + Math.random() * .18, 1], i * 3);
    energy.opacity[i] *= .68;
    energy.sizes[i] *= 1.12;
  }
  for (let i = 0; i < base.opacity.length; i++) {
    const angle = Math.random() * TAU;
    const radius = Math.random() ** .52 * 1.11;
    base.positions.set([Math.cos(angle) * radius, BASE_Y + Math.random() * .21, Math.sin(angle) * radius], i * 3);
    base.colors.set([.015, .5, 1], i * 3);
    base.sizes[i] *= 1.22;
  }
  for (let i = 0; i < PATHS; i++) {
    heads.colors.set([.12, .67, 1], i * 3);
    heads.sizes[i] = 1.85 + (i % 4) * .25;
  }
  heads.geometry.attributes.position.setUsage(T.DynamicDrawUsage);
  heads.geometry.attributes.opacity.setUsage(T.DynamicDrawUsage);

  const aura = new T.Mesh(new T.PlaneGeometry(2.78, 1.03), new T.ShaderMaterial({
    uniforms: { clock: { value: 0 }, glow: { value: .8 } },
    vertexShader: `
      varying vec2 q;
      void main() { q = uv*2.0-1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform float clock, glow;
      varying vec2 q;
      void main() {
        float flicker = .78 + .15*sin(clock*3.7) + .07*sin(clock*8.1);
        float fog = exp(-5.5*q.x*q.x-13.0*q.y*q.y) * .22;
        float core = exp(-12.0*q.x*q.x-72.0*q.y*q.y) * .44;
        float edge = (1.0-smoothstep(.74,1.0,abs(q.x))) * (1.0-smoothstep(.72,1.0,abs(q.y)));
        gl_FragColor = vec4(.02,.60,1.20,(fog+core)*flicker*edge*(.46 + glow*.55));
      }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  }));
  aura.position.set(0, BASE_Y + .06, .06);
  group.add(aura, lines, heads.points, energy.points, base.points);

  const point = new T.Vector3();
  return {
    group, clouds: [heads, energy, base],
    update(time, glow) {
      aura.material.uniforms.clock.value = time;
      aura.material.uniforms.glow.value = glow;
      for (let i = 0; i < PATHS; i++) {
        const life = (time * (.31 + (i % 7) * .035) + i * .618033) % 1;
        const end = i < RINGS ? life * .6 + .47 : life;
        const span = (i < RINGS ? .39 : .51) + (i % 3) * .10;
        const fade = Math.sin(life * Math.PI) ** 1.1;
        for (let s = 0; s < SEGMENTS; s++) {
          for (let v = 0; v < 2; v++) {
            const u = (s + v) / SEGMENTS;
            const index = (i * SEGMENTS + s) * 2 + v;
            trailPoint(point, i, time, Math.max(0, end - span * (1 - u)), life).toArray(positions, index * 3);
            const shimmer = .79 + .21 * Math.sin(u * 14 - time * (3.1 + i % 4) + i);
            strength[index] = u ** 1.45 * fade * shimmer * (i < RINGS ? .87 : .75) * (.61 + glow * .47);
          }
        }
        point.toArray(heads.positions, i * 3);
        heads.opacity[i] = .92 * fade;
      }
      tracks.attributes.position.needsUpdate = true;
      tracks.attributes.strength.needsUpdate = true;
      heads.geometry.attributes.position.needsUpdate = true;
      heads.geometry.attributes.opacity.needsUpdate = true;
    },
  };
}
