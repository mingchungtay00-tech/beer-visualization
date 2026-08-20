import * as THREE from 'three';
import vertexShader from '../shaders/beerVolume.vert?raw';
import fragmentShader from '../shaders/videoBurst.frag?raw';

export class VideoBurstMaterial extends THREE.ShaderMaterial {
  declare uniforms: {
    uVideoTexture: { value: THREE.Texture };
    uReady: { value: number };
    uOpacity: { value: number };
    uTime: { value: number };
    uSurfaceY: { value: number };
    uLevel: { value: number };
    uWaveAmplitude: { value: number };
  };

  constructor(videoTexture: THREE.Texture) {
    super({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uVideoTexture: { value: videoTexture },
        uReady: { value: 0 },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uSurfaceY: { value: 0 },
        uLevel: { value: 0 },
        uWaveAmplitude: { value: 0 },
      },
    });
  }
}
