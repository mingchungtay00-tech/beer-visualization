import * as THREE from 'three';
import vertexShader from '../shaders/beerVolume.vert?raw';
import fragmentShader from '../shaders/glassOverlay.frag?raw';

export class GlassOverlayMaterial extends THREE.ShaderMaterial {
  declare uniforms: {
    uResolution: { value: THREE.Vector2 };
    uTime: { value: number };
    uFillTopY: { value: number };
    uLevel: { value: number };
    uWaveAmplitude: { value: number };
    uHit: { value: number };
  };

  constructor() {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uFillTopY: { value: 0 },
        uLevel: { value: 0 },
        uWaveAmplitude: { value: 0 },
        uHit: { value: 0 },
      },
    });
  }
}
