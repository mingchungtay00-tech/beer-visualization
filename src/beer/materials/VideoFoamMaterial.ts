import * as THREE from 'three';
import vertexShader from '../shaders/foam.vert?raw';
import fragmentShader from '../shaders/videoFoam.frag?raw';

export class VideoFoamMaterial extends THREE.ShaderMaterial {
  declare uniforms: {
    uResolution: { value: THREE.Vector2 };
    uVideoTexture: { value: THREE.Texture };
    uPosterTexture: { value: THREE.Texture };
    uVideoReady: { value: number };
    uTime: { value: number };
    uSurfaceY: { value: number };
    uFillTopY: { value: number };
    uLevel: { value: number };
    uWaveAmplitude: { value: number };
    uHit: { value: number };
  };

  constructor(videoTexture: THREE.Texture, posterTexture: THREE.Texture) {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uVideoTexture: { value: videoTexture },
        uPosterTexture: { value: posterTexture },
        uVideoReady: { value: 0 },
        uTime: { value: 0 },
        uSurfaceY: { value: 0 },
        uFillTopY: { value: 0 },
        uLevel: { value: 0 },
        uWaveAmplitude: { value: 0 },
        uHit: { value: 0 },
      },
    });
  }
}
