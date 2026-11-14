import * as T from 'three';

export const BLUES = ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#bfdbfe', '#1d4ed8'];
export const HEART_COUNTS = [5600, 8500, 12000];
const palette = BLUES.map(value => new T.Color(value));
const tau = Math.PI * 2;

export function pointCloud(count, motion = '', tightness = 1) {
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const opacity = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    palette[i % palette.length].toArray(colors, i * 3);
    sizes[i] = 0.88 + Math.random() ** 3.2 * 1.46;
    phases[i] = Math.random() * tau;
    opacity[i] = 0.32 + Math.random() * 0.68;
  }
  for (const [name, data, stride] of [
    ['position', positions, 3], ['tint', colors, 3], ['size', sizes, 1],
    ['phase', phases, 1], ['opacity', opacity, 1],
  ]) {
    geometry.setAttribute(name, new T.BufferAttribute(data, stride));
  }
  const material = new T.ShaderMaterial({
    uniforms: {
      clock: { value: 0 }, pixels: { value: 1 }, pulse: { value: 0 },
      sharpness: { value: tightness }, heartMode: { value: 0 },
    },
    vertexShader: `
      attribute vec3 tint;
      attribute float size, phase, opacity;
      uniform float clock, pixels, pulse, heartMode;
      varying vec3 hue;
      varying float strength;
      varying float diameter;
      void main() {
        vec3 p = position;
        float beat = sin(clock * (1.15 + fract(phase)*1.9) + phase);
        float energy = pow(0.5 + 0.5*sin(clock*2.6 - p.y*2.4 + sin(p.x*2.5 + p.z*1.7)), 9.0);
        float flowFade = 1.0;
        ${motion}
        vec4 view = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * view;
        diameter = size * pixels * (7.8 / -view.z);
        // Use a slightly larger raster footprint to retain round cores on high-DPR displays.
        gl_PointSize = max(3.0, diameter * 2.05);
        hue = tint * mix(vec3(1.0), vec3(.62,.86,1.18), heartMode);
        strength = opacity * (.76 + .24*beat) * clamp(9.8 / -view.z, .55, 1.25);
        strength *= flowFade * (1.0 + heartMode * (.20 + .47 * energy));
      }`,
    fragmentShader: `
      uniform float sharpness;
      varying vec3 hue;
      varying float strength;
      varying float diameter;
      void main() {
        float footprint = max(3.0, diameter * 2.05);
        vec2 q = (gl_PointCoord - .5) * footprint / max(1.16, diameter);
        float r = dot(q,q);
        float core = exp(-mix(5.0, 7.1, sharpness)*r);
        float halo = .075 * exp(-3.4*r);
        float light = (core + halo) * (1.0 - smoothstep(.19,.58,r));
        gl_FragColor = vec4(hue * 2.35, light * strength);
      }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material, positions, colors, sizes, phases, opacity };
}

export function heartParticles(useHighQuality) {
  const cloud = pointCloud(HEART_COUNTS.at(-1), `
    p += normalize(p + vec3(.002)) * (beat * .021 + pulse * .17);
    p.y += .008 * sin(clock * 2.0 + p.x * 3.0 + phase);
  `);
  cloud.material.uniforms.heartMode.value = 1;
  const { positions, opacity, geometry } = cloud;
  // Shape the frontal perimeter first, then inflate it into a rounded volume.
  // Using the distance to the perimeter for depth keeps the cleft open through Z.
  const outline = Array.from({length: 96}, (_, i) => {
    const t = i * tau / 96;
    const height = .106 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
    return [
      1.76 * Math.sin(t) ** 3,
      height + .43 + .21 * Math.max(0, -height) ** 1.18,
    ];
  });
  let state = 139531;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < opacity.length;) {
    const x = (random() * 2 - 1) * 1.76;
    const y = random() * 3.2 - 1.39;
    let inside = false;
    let distanceSquared = Infinity;
    for (let j = 0; j < outline.length; j++) {
      const [ax, ay] = outline[j];
      const [bx, by] = outline[(j + 1) % outline.length];
      const dx = bx - ax;
      const dy = by - ay;
      if ((ay > y) !== (by > y) && x < ax + (y - ay) * dx / dy) inside = !inside;
      const t = T.MathUtils.clamp(((x - ax)*dx + (y - ay)*dy) / (dx*dx + dy*dy), 0, 1);
      distanceSquared = Math.min(distanceSquared, (x - ax - t*dx)**2 + (y - ay - t*dy)**2);
    }
    if (!inside) continue;
    const distance = Math.sqrt(distanceSquared);
    const bevel = Math.min(1, distance / .80);
    const maxDepth = .90 * Math.sqrt(bevel * (2 - bevel));
    const onShell = random() < .74;
    const layer = onShell ? .86 + .14 * random() : random() * .86;
    const edgeLight = 1 + .68 * Math.exp(-distance * 12);
    positions.set([x, y, maxDepth * layer * (random() < .5 ? -1 : 1)], i * 3);
    cloud.sizes[i] = 1.00 + random() ** 4.5 * .82;
    opacity[i] *= (onShell ? 1.0 : .57) * edgeLight;
    i++;
  }
  geometry.setDrawRange(0, HEART_COUNTS[useHighQuality ? 2 : 1]);
  return cloud;
}

export function floatingParticles() {
  const cloud = pointCloud(160, `
    p.x += .22*sin(clock*.36+phase);
    p.z += .16*cos(clock*.42+phase);
    p.y = mod(p.y + 3.0 + clock*.135, 6.0) - 3.0;
  `);
  for (let i = 0; i < cloud.opacity.length; i++) {
    const theta = Math.random() * tau;
    const radius = 1.1 + Math.random() * 2.25;
    cloud.positions.set([radius * Math.cos(theta), Math.random() * 6 - 3, radius * Math.sin(theta)], i * 3);
    cloud.opacity[i] *= 0.29;
  }
  return cloud;
}

export function burstParticles() {
  const count = 640;
  const cloud = pointCloud(count);
  const speed = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const duration = new Float32Array(count);
  cloud.opacity.fill(0);
  cloud.geometry.attributes.position.setUsage(T.DynamicDrawUsage);
  cloud.geometry.attributes.opacity.setUsage(T.DynamicDrawUsage);
  let cursor = 0;
  let active = 0;
  return {
    ...cloud,
    spawn(origin, quantity, ambient = false) {
      for (let n = 0; n < quantity; n++) {
        const i = cursor++ % count;
        if (life[i] <= 0) active++;
        const angle = Math.random() * tau;
        const vertical = Math.random() * 2 - 1;
        const horizontal = Math.sqrt(1 - vertical * vertical);
        const magnitude = (ambient ? 0.65 : 1.35) + Math.random() * 1.8;
        origin.toArray(cloud.positions, i * 3);
        speed.set([
          horizontal * Math.cos(angle) * magnitude,
          vertical * magnitude + (ambient ? 0.9 : 0.18),
          horizontal * Math.sin(angle) * magnitude,
        ], i * 3);
        life[i] = duration[i] = 0.38 + Math.random() * 0.72;
      }
    },
    update(dt) {
      if (active === 0) return;
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        cloud.opacity[i] = Math.max(0, life[i] / duration[i]) ** 1.45;
        if (life[i] <= 0) active--;
        for (let j = 0; j < 3; j++) cloud.positions[i * 3 + j] += speed[i * 3 + j] * dt;
        speed[i * 3 + 1] -= 1.55 * dt;
      }
      cloud.geometry.attributes.position.needsUpdate = true;
      cloud.geometry.attributes.opacity.needsUpdate = true;
    },
  };
}
