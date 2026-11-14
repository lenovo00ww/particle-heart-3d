import './style.css';
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { heartParticles, floatingParticles, burstParticles, HEART_COUNTS } from './particles.js';
import { energyEffects, BASE_Y } from './energy.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const play = document.querySelector('#play');
const speed = document.querySelector('#speed');
const glow = document.querySelector('#glow');
const toggle = document.querySelector('#toggle');
const settings = document.querySelector('#settings');
const fullscreen = document.querySelector('#fullscreen');
const experience = document.querySelector('#experience');

function start() {
  const renderer = new T.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000);
  renderer.toneMapping = T.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Rotating 3D particle heart. Drag to rotate, or press Space to scatter sparks.');
  canvas.tabIndex = 0;
  stage.append(canvas);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(36, 1, .1, 65);
  const composer = new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .33, .46, .70);
  const renderPass = new RenderPass(scene, camera);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(outputPass);

  const handheld = matchMedia('(pointer: coarse)').matches || innerWidth < 650;
  let quality = handheld ? 1 : 2;
  const heart = heartParticles(!handheld);
  const floating = floatingParticles();
  const bursts = burstParticles();
  const energy = energyEffects();
  const clouds = [heart, floating, bursts, ...energy.clouds];
  const pivot = new T.Group();
  pivot.add(heart.points);
  scene.add(pivot, floating.points, bursts.points, energy.group);

  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  const listen = (target, event, fn) => target.addEventListener(event, fn, { signal: listeners.signal });
  let playing = !motionPreference.matches;
  let time = 0;
  let angle = -.13;
  let pitch = 0;
  let angularVelocity = 0;
  let pulse = 0;
  let nextSpark = 1.1;
  let lastBurst = -Infinity;
  let lastFrame = 0;
  let frameId = 0;
  let samplingFrames = 0;
  let samplingTime = 0;
  let effectUntil = 0;
  let pointer = null;
  let lost = false;
  let ended = false;
  const ray = new T.Raycaster();
  // Match the visible point cloud in world units while allowing finger-sized near misses.
  ray.params.Points.threshold = .095;
  const ndc = new T.Vector2();
  const shot = new T.Vector3();
  const center = new T.Vector3(0, .28, 0);
  const base = new T.Vector3(0, BASE_Y + .22, 0);

  function resize() {
    const width = stage.clientWidth || 1;
    const height = stage.clientHeight || 1;
    const aspect = width / height;
    // Fit the swept volume of the heart and the base into the measured stage.
    // The depth allowance keeps particles nearest the camera inside the frame.
    const verticalHalf = 2.44;
    const horizontalHalf = 2.28;
    const half = Math.max(verticalHalf, horizontalHalf / aspect);
    const viewDistance = half / Math.tan(T.MathUtils.degToRad(camera.fov / 2)) + 0.92;
    camera.aspect = aspect;
    camera.position.set(0, .83, viewDistance);
    camera.lookAt(0, -.14, 0);
    camera.updateProjectionMatrix();

    const pixelBudget = quality === 2 ? 3300000 : 2100000;
    const dpr = Math.min(devicePixelRatio || 1, [1, 1.35, 1.65][quality],
      Math.sqrt(pixelBudget / (width * height)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
    const bloomScale = [.48, .68, .86][quality];
    bloom.setSize(width * dpr * bloomScale, height * dpr * bloomScale);
    const density = Math.min(width / 390, height / 625, 1.38);
    for (const cloud of clouds) cloud.material.uniforms.pixels.value = dpr * density * camera.position.z / 7.8;
    heart.geometry.setDrawRange(0, HEART_COUNTS[quality]);
    schedule();
  }

  function updatePlay() {
    play.textContent = playing ? 'Pause' : 'Play';
  }

  function schedule() {
    if (!frameId && !lost && !ended && !document.hidden) frameId = requestAnimationFrame(frame);
  }

  function frame(now) {
    frameId = 0;
    const elapsed = lastFrame ? (now - lastFrame) / 1000 : 0;
    const dt = Math.min(.045, elapsed);
    lastFrame = now;
    const effectActive = now < effectUntil;
    if (playing) {
      if (!pointer) {
        angularVelocity = T.MathUtils.damp(angularVelocity, .43 * Number(speed.value), 3.4, dt);
        angle += angularVelocity * dt;
        pitch = T.MathUtils.damp(pitch, 0, 1.9, dt);
      }
      if (time >= nextSpark) {
        bursts.spawn(base, 25, true);
        nextSpark = time + 1.2 + Math.random() * 1.65;
      }
      if (elapsed > 0 && elapsed < .25 && quality > 0 && !pointer) {
        samplingFrames++;
        samplingTime += elapsed;
        if (samplingTime >= 4) {
          if (samplingFrames / samplingTime < 31) {
            quality--;
            resize();
          }
          samplingFrames = samplingTime = 0;
        }
      }
    }
    if (playing || effectActive) {
      time += dt;
      pulse *= Math.exp(-4.2 * dt);
      bursts.update(dt);
    } else if (effectUntil) {
      effectUntil = 0;
      pulse = 0;
      bursts.update(2);
    }
    pivot.rotation.set(pitch, angle, 0, 'YXZ');
    const glowValue = Number(glow.value);
    bloom.enabled = glowValue > 0;
    bloom.strength = glowValue * .43 + pulse * .18;
    for (const cloud of clouds) cloud.material.uniforms.clock.value = time;
    heart.material.uniforms.pulse.value = pulse;
    energy.update(time, glowValue);
    composer.render();
    if (playing || pointer || effectActive) schedule();
    else lastFrame = 0;
  }

  function burst(origin) {
    const now = performance.now();
    if (motionPreference.matches || now - lastBurst < 125) return;
    lastBurst = now;
    pulse = .88;
    effectUntil = now + 1300;
    bursts.spawn(origin, 150);
    schedule();
  }

  listen(canvas, 'pointerdown', event => {
    if (pointer || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
    angularVelocity = 0;
    schedule();
  });
  listen(canvas, 'pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (!pointer.moved && Math.hypot(dx, dy) < 7) return;
    pointer.moved = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    angle += dx * .009;
    pitch = T.MathUtils.clamp(pitch + dy * .006, -.62, .62);
    schedule();
  });
  listen(canvas, 'pointerup', event => {
    if (event.pointerId !== pointer?.id) return;
    const moved = pointer.moved || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= 7;
    pointer = null;
    if (moved) return;
    const rect = canvas.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(heart.points)[0];
    if (hit) burst(shot.copy(hit.point).lerp(center, .29));
  });
  for (const event of ['pointercancel', 'lostpointercapture']) {
    listen(canvas, event, e => { if (e.pointerId === pointer?.id) pointer = null; });
  }
  listen(canvas, 'keydown', event => {
    if (event.code !== 'Space' || event.repeat) return;
    event.preventDefault();
    burst(center);
  });

  listen(play, 'click', () => {
    playing = !playing;
    updatePlay();
    schedule();
  });
  listen(motionPreference, 'change', event => {
    if (event.matches) {
      playing = false;
      effectUntil = 0;
      pulse = 0;
      bursts.update(2);
    }
    updatePlay();
    schedule();
  });
  listen(glow, 'input', schedule);
  listen(toggle, 'click', () => {
    settings.hidden = !settings.hidden;
    toggle.textContent = settings.hidden ? 'Show controls' : 'Hide controls';
    toggle.setAttribute('aria-expanded', String(!settings.hidden));
  });
  fullscreen.hidden = !(document.fullscreenEnabled && experience.requestFullscreen);
  listen(fullscreen, 'click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await experience.requestFullscreen();
    } catch {
      fullscreen.hidden = true;
    }
  });
  listen(document, 'fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    resize();
  });
  const stageObserver = new ResizeObserver(resize);
  stageObserver.observe(stage);
  listen(window, 'resize', resize);
  listen(document, 'visibilitychange', () => {
    lastFrame = 0;
    samplingFrames = samplingTime = 0;
    if (document.hidden) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    } else schedule();
  });
  listen(canvas, 'webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frameId);
    frameId = 0;
    status.hidden = false;
    status.textContent = 'Graphics paused while WebGL reconnects.';
  });
  listen(canvas, 'webglcontextrestored', () => {
    lost = false;
    status.hidden = true;
    lastFrame = 0;
    resize();
  });
  function dispose() {
    ended = true;
    listeners.abort();
    stageObserver.disconnect();
    cancelAnimationFrame(frameId);
    scene.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    bloom.dispose();
    outputPass.dispose();
    composer.dispose();
    renderer.dispose();
  }
  listen(window, 'pagehide', event => { if (!event.persisted) dispose(); });
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  updatePlay();
  resize();
}

try {
  start();
} catch (error) {
  console.error(error);
  status.textContent = 'WebGL 2 is required to display the 3D heart.';
  status.hidden = false;
  document.querySelector('.dock').hidden = true;
}
