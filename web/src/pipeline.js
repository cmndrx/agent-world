// Post-processing pipeline with quality presets.
//
//   high:    MSAA + GTAO ambient occlusion + bloom + tilt-shift + outline + grade
//   medium:  MSAA + bloom + outline + grade
//   low:     plain render + grade
// "auto" starts high and steps down if the frame rate can't keep up.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const PRESETS = {
  // maxPixels caps the render size (dynamic resolution), so Retina screens don't render 4× the pixels.
  high: { dpr: 2, maxPixels: 3.7e6, msaa: 4, ao: true, bloom: true, tilt: true, outline: true, shadow: 2048 },
  medium: { dpr: 1.5, maxPixels: 2.4e6, msaa: 4, ao: false, bloom: true, tilt: false, outline: true, shadow: 1536 },
  low: { dpr: 1, maxPixels: 1.4e6, msaa: 0, ao: false, bloom: false, tilt: false, outline: false, shadow: 1024 },
};

/** Final color grade in display space: gentle saturation lift, warmth, and a soft vignette. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.15 },
    contrast: { value: 1.08 },
    vignette: { value: 0.32 },
    tint: { value: new THREE.Color(1.02, 1.0, 0.97) },
    look: { value: 0 }, // photo-mode filter: 0 natural, 1 warm, 2 cool, 3 mono, 4 film
    grain: { value: 0 },
    seed: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation, contrast, vignette, look, grain, seed;
    uniform vec3 tint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb = (c.rgb - 0.5) * contrast + 0.5;
      c.rgb *= tint;
      if (look > 0.5 && look < 1.5) { c.rgb *= vec3(1.08, 1.0, 0.86); c.rgb = mix(vec3(l), c.rgb, 1.08); }
      else if (look > 1.5 && look < 2.5) { c.rgb *= vec3(0.9, 1.0, 1.12); }
      else if (look > 2.5 && look < 3.5) { float m = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = (vec3(m) - 0.5) * 1.12 + 0.5; c.rgb *= vec3(1.02, 1.0, 0.96); }
      else if (look > 3.5) {
        vec3 sep = vec3(dot(c.rgb, vec3(0.393, 0.769, 0.189)), dot(c.rgb, vec3(0.349, 0.686, 0.168)), dot(c.rgb, vec3(0.272, 0.534, 0.131)));
        c.rgb = mix(c.rgb, sep, 0.28) * 0.9 + 0.055;
      }
      c.rgb += (hash(gl_FragCoord.xy) - 0.5) * grain;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - vignette * smoothstep(0.35, 0.85, length(d * vec2(1.1, 1.0)));
      gl_FragColor = c;
    }
  `,
};

export class Pipeline {
  constructor(renderer, scene, camera, env) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.env = env;
    this.setting = 'auto';
    this.level = 'high';
    this.size = new THREE.Vector2(1, 1);
    this.outlined = [];
    this.fps = { frames: 0, time: 0, slowStreak: 0 };
  }

  setQuality(setting) {
    this.setting = setting;
    this.level = setting === 'auto' ? 'high' : setting;
    this.fps.slowStreak = 0;
    this.build();
  }

  build() {
    const p = PRESETS[this.level];
    const { x: w, y: h } = this.size;
    const dpr = Math.max(0.75, Math.min(devicePixelRatio, p.dpr, Math.sqrt(p.maxPixels / Math.max(1, w * h))));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.env.setShadowQuality(p.shadow, 34);

    this.composer?.dispose();
    const rt = new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType, samples: p.msaa });
    const composer = new EffectComposer(this.renderer, rt);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(this.scene, this.camera));

    this.ao = null;
    if (p.ao) {
      const ao = new GTAOPass(this.scene, this.camera, w, h);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.9;
      ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 10 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
      composer.addPass(ao);
      this.ao = ao;
    }

    this.outlinePass = null;
    if (p.outline) {
      const outline = new OutlinePass(new THREE.Vector2(w, h), this.scene, this.camera);
      Object.assign(outline, { edgeStrength: 4, edgeGlow: 0.4, edgeThickness: 1.4, pulsePeriod: 0 });
      outline.visibleEdgeColor.set('#ffffff');
      outline.hiddenEdgeColor.set('#7aa7ff');
      outline.selectedObjects = this.outlined;
      composer.addPass(outline);
      this.outlinePass = outline;
    }

    // High threshold: only emissive things (plumbobs, lamps, screens) bloom, not sunlit surfaces.
    if (p.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.45, 1.6));

    this.tilt = null;
    if (p.tilt) {
      const hBlur = new ShaderPass(HorizontalTiltShiftShader);
      const vBlur = new ShaderPass(VerticalTiltShiftShader);
      hBlur.uniforms.r.value = vBlur.uniforms.r.value = 0.5;
      composer.addPass(hBlur);
      composer.addPass(vBlur);
      this.tilt = { hBlur, vBlur, px: w * dpr, py: h * dpr };
      this.setTiltStrength(this.tiltStrength ?? 0);
    }

    composer.addPass(new OutputPass());
    // Ambient occlusion is soft and low-frequency: computing it at half resolution looks the same and
    // costs about a quarter (it's upsampled when blended).
    if (this.ao) this.ao.setSize(Math.round((w * dpr) / 2), Math.round((h * dpr) / 2));
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.composer = composer;
    this.setLook(this.lookState || {});
  }

  setSize(w, h) {
    this.size.set(w, h);
    this.build();
  }

  /** Miniature-diorama blur: 0 (none) … 1 (strong). Scaled by how far the camera is. */
  setTiltStrength(k) {
    this.tiltStrength = k;
    if (!this.tilt) return;
    const t = this.tilt;
    const px = 4.5 * k;
    t.hBlur.uniforms.h.value = px / t.px;
    t.vBlur.uniforms.v.value = px / t.py;
    t.hBlur.enabled = t.vBlur.enabled = k > 0.02;
  }

  /** Photo-mode look: { look: 0–4, vignette: 0–1 }. Applied in the final grade, so photos match the screen. */
  setLook({ look = 0, vignette = 0.32 } = {}) {
    this.lookState = { look, vignette };
    if (!this.grade) return;
    const u = this.grade.uniforms;
    u.look.value = look;
    u.vignette.value = vignette;
    u.grain.value = look === 4 ? 0.045 : 0;
  }

  setOutlined(objects) {
    this.outlined = objects;
    if (this.outlinePass) {
      this.outlinePass.selectedObjects = objects;
      this.outlinePass.enabled = objects.length > 0; // skip the pass entirely when nothing is outlined
    }
  }

  render(dt) {
    if (this.grade) {
      const u = this.grade.uniforms;
      u.seed.value = (u.seed.value + 0.6180339) % 1;
      // Time-of-day color grade from the environment (warm mornings and golden hour, cool nights).
      const g = this.env.grade;
      if (g) {
        u.tint.value.copy(g.tint);
        u.saturation.value = g.saturation;
        u.contrast.value = g.contrast;
      }
    }
    this.composer.render(dt);
    this.adapt(dt);
  }

  /** In auto mode, step quality down if we're consistently under ~40 fps. */
  adapt(dt) {
    if (this.setting !== 'auto' || this.level === 'low') return;
    const f = this.fps;
    f.frames++;
    f.time += dt;
    if (f.time < 2) return;
    const fps = f.frames / f.time;
    f.frames = 0;
    f.time = 0;
    f.slowStreak = fps < 40 ? f.slowStreak + 1 : 0;
    if (f.slowStreak >= 2) {
      this.level = this.level === 'high' ? 'medium' : 'low';
      f.slowStreak = 0;
      this.build();
      this.onDowngrade?.(this.level);
    }
  }
}
