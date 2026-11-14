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
    sizes[i] = 0.68 + Math.random() ** 3.2 * 2.05;
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
      void main() {
        vec3 p = position;
        float beat = sin(clock * 1.65 + phase);
        float energy = pow(0.5 + 0.5*sin(clock*2.6 - p.y*2.4 + sin(p.x*2.5 + p.z*1.7)), 9.0);
        ${motion}
        vec4 view = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp((size + heartMode * (.27 + .23 * energy)) * pixels * (7.8 / -view.z) * (1.04 + beat * .16), 1.0, 120.0);
        hue = tint * mix(vec3(1.0), vec3(.62,.85,1.16), heartMode);
        strength = opacity * (.66 + .34*beat) * clamp(9.8 / -view.z, .55, 1.3) * (1.0 + heartMode * (.33 + .63 * energy));
      }`,
    fragmentShader: `
      uniform float sharpness;
      varying vec3 hue;
      varying float strength;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float r = dot(q,q);
        if (r > 1.0) discard;
        float light = mix(exp(-3.7*r), exp(-5.6*r), sharpness) * (1.0 - smoothstep(.7,1.0,r));
        gl_FragColor = vec4(hue * 2.0, light * strength);
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
  // Implicit volumetric heart. Sample a near-surface shell and a smaller solid interior.
  let state = 139531;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < opacity.length;) {
    const x = (random() * 2 - 1) * 1.32;
    const y = random() * 2.56 - 1.12;
    const z = (random() * 2 - 1) * 1.06;
    // Rotate the conventional z-up implicit heart into y-up coordinates.
    const a = x * x + 2.25 * z * z + y * y - 1;
    const field = a ** 3 - x * x * y ** 3 - 0.1125 * z * z * y ** 3;
    if (field > 0 || (field < -0.075 && random() < 0.78)) continue;
    positions.set([x * 1.58, (y - 0.115) * 1.42 + 0.24, z * 1.94], i * 3);
    opacity[i] *= field < -0.075 ? 0.69 : 1;
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
