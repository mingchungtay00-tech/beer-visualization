import * as THREE from 'three';
import { BeerController, type BeerFrameState } from './BeerController';
import { BeerMedia } from './media/BeerMedia';
import { VideoBeerMaterial } from './materials/VideoBeerMaterial';
import { VideoFoamMaterial } from './materials/VideoFoamMaterial';
import { VideoBurstMaterial } from './materials/VideoBurstMaterial';
import { GlassOverlayMaterial } from './materials/GlassOverlayMaterial';

const HIT_AMOUNT = 0.01;
const VICTORY_LEVEL = 0.999;

export class BeerScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly clock = new THREE.Clock();
  private readonly controller = new BeerController();
  private readonly media = new BeerMedia();
  private readonly beerMaterial = new VideoBeerMaterial(this.media.bodyTexture, this.media.bodyPoster);
  private readonly foamMaterial = new VideoFoamMaterial(this.media.foamTexture, this.media.foamPoster);
  private readonly burstMaterial = new VideoBurstMaterial(this.media.burstTexture);
  private readonly glassMaterial = new GlassOverlayMaterial();
  private readonly quad = new THREE.PlaneGeometry(2, 2);
  private readonly debugOverlay = this.createDebugOverlay();
  private readonly victoryOverlay = this.createVictoryOverlay();
  private readonly stage = this.readStage();
  private readonly usesPointerEvents: boolean;
  private frameId = 0;
  private victoryPending = false;
  private victoryActive = false;

  constructor(private readonly container: HTMLElement) {
    const canvas = document.createElement('canvas');
    this.canvas = canvas;
    this.usesPointerEvents = 'PointerEvent' in window;
    const context = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });

    if (!context) {
      throw new Error('WebGL2 is required for the beer visualization.');
    }

    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x010000, 1);
    this.container.appendChild(canvas);

    this.createScene();
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.handleKeyDown);
    if (this.usesPointerEvents) {
      this.canvas.addEventListener('pointerup', this.handlePointerUp, { passive: false });
    } else {
      this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    }
    this.exposeControllerApi();
  }

  start(): void {
    this.clock.start();
    this.render();
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.usesPointerEvents) {
      this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    } else {
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }
    this.debugOverlay?.remove();
    this.victoryOverlay.remove();
    this.media.dispose();
    this.beerMaterial.dispose();
    this.foamMaterial.dispose();
    this.burstMaterial.dispose();
    this.glassMaterial.dispose();
    this.quad.dispose();
    this.renderer.dispose();
  }

  private createScene(): void {
    const beer = new THREE.Mesh(this.quad, this.beerMaterial);
    beer.renderOrder = 0;
    this.scene.add(beer);

    const burst = new THREE.Mesh(this.quad, this.burstMaterial);
    burst.renderOrder = 1;
    burst.visible = this.stage >= 3;
    this.scene.add(burst);

    const foam = new THREE.Mesh(this.quad, this.foamMaterial);
    foam.renderOrder = 2;
    this.scene.add(foam);

    const glass = new THREE.Mesh(this.quad, this.glassMaterial);
    glass.renderOrder = 3;
    glass.visible = this.stage >= 2;
    this.scene.add(glass);
  }

  private readonly resize = (): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    const resolution = new THREE.Vector2(width * dpr, height * dpr);
    this.beerMaterial.uniforms.uResolution.value.copy(resolution);
    this.foamMaterial.uniforms.uResolution.value.copy(resolution);
    this.glassMaterial.uniforms.uResolution.value.copy(resolution);
  };

  private readonly render = (): void => {
    const deltaTime = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;
    const state = this.controller.update(deltaTime);
    this.media.update(elapsed, state.currentLevel, state.impact);

    if (this.victoryPending && state.currentLevel >= 0.985) {
      this.showVictory();
    }

    this.beerMaterial.uniforms.uVideoReady.value = this.media.bodyReady;
    this.beerMaterial.uniforms.uTime.value = elapsed;
    this.beerMaterial.uniforms.uSurfaceY.value = state.surfaceY;
    this.beerMaterial.uniforms.uLevel.value = state.currentLevel;
    this.beerMaterial.uniforms.uWaveAmplitude.value = state.waveAmplitude;
    this.beerMaterial.uniforms.uHit.value = state.impact;

    this.foamMaterial.uniforms.uVideoReady.value = this.media.foamReady;
    this.foamMaterial.uniforms.uTime.value = elapsed;
    this.foamMaterial.uniforms.uSurfaceY.value = state.surfaceY;
    this.foamMaterial.uniforms.uFillTopY.value = state.fillTopY;
    this.foamMaterial.uniforms.uLevel.value = state.currentLevel;
    this.foamMaterial.uniforms.uWaveAmplitude.value = state.waveAmplitude;
    this.foamMaterial.uniforms.uHit.value = state.impact;

    this.glassMaterial.uniforms.uTime.value = elapsed;
    this.glassMaterial.uniforms.uFillTopY.value = state.fillTopY;
    this.glassMaterial.uniforms.uLevel.value = state.currentLevel;
    this.glassMaterial.uniforms.uWaveAmplitude.value = state.waveAmplitude;
    this.glassMaterial.uniforms.uHit.value = state.impact;

    this.burstMaterial.uniforms.uReady.value = this.media.burstReady;
    this.burstMaterial.uniforms.uOpacity.value = this.media.burstOpacity;
    this.burstMaterial.uniforms.uTime.value = elapsed;
    this.burstMaterial.uniforms.uSurfaceY.value = state.surfaceY;
    this.burstMaterial.uniforms.uLevel.value = state.currentLevel;
    this.burstMaterial.uniforms.uWaveAmplitude.value = state.waveAmplitude;

    this.updateDebugOverlay(state);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  };

  private hitBeer(amount: number): void {
    this.media.resumePlayback();
    const before = this.controller.targetLevel;
    this.controller.hitBeer(amount);
    const cappedPositiveHit = amount > 0 && before >= 0.999;
    if (before !== this.controller.targetLevel || cappedPositiveHit) {
      this.media.triggerBurst(this.clock.elapsedTime);
    }

    if (amount > 0 && before < VICTORY_LEVEL && this.controller.targetLevel >= VICTORY_LEVEL) {
      this.victoryPending = true;
    } else if (amount < 0 && this.controller.targetLevel < VICTORY_LEVEL) {
      this.hideVictory();
    }
  }

  private resetBeer(): void {
    this.hideVictory();
    this.controller.reset();
  }

  private readStage(): number {
    const params = new URLSearchParams(window.location.search);
    const stage = Number(params.get('stage') ?? '6');
    return THREE.MathUtils.clamp(Number.isFinite(stage) ? stage : 6, 1, 6);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;

    const key = event.key.toLowerCase();
    if (key === 'a') {
      this.hitBeer(HIT_AMOUNT);
    } else if (key === 'r') {
      this.resetBeer();
    } else if (key === 'z') {
      this.hitBeer(-HIT_AMOUNT);
    } else if (key === 'd') {
      if (!this.debugOverlay) return;
      this.debugOverlay.hidden = !this.debugOverlay.hidden;
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    this.hitBeer(HIT_AMOUNT);
  };

  private readonly handleTouchEnd = (event: TouchEvent): void => {
    if (event.changedTouches.length === 0) return;
    event.preventDefault();
    this.hitBeer(HIT_AMOUNT);
  };

  private exposeControllerApi(): void {
    const apiTarget = window as typeof window & {
      setBeerLevel?: (percent: number) => void;
      addBeer?: (amount: number) => void;
      hitBeer?: (amount?: number) => void;
    };

    apiTarget.setBeerLevel = (percent: number) => {
      this.controller.setBeerLevel(percent);
      if (this.controller.targetLevel >= VICTORY_LEVEL) {
        this.victoryPending = true;
      } else {
        this.hideVictory();
      }
    };
    apiTarget.addBeer = (amount: number) => {
      const before = this.controller.targetLevel;
      this.controller.addBeer(amount);
      if (before < VICTORY_LEVEL && this.controller.targetLevel >= VICTORY_LEVEL) {
        this.victoryPending = true;
      } else if (this.controller.targetLevel < VICTORY_LEVEL) {
        this.hideVictory();
      }
    };
    apiTarget.hitBeer = (amount = HIT_AMOUNT) => this.hitBeer(amount);
  }

  private createVictoryOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'victory-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const light = document.createElement('div');
    light.className = 'victory-light';

    const content = document.createElement('div');
    content.className = 'victory-content';

    const badgeWrap = document.createElement('div');
    badgeWrap.className = 'victory-badge-wrap';
    const badge = document.createElement('img');
    badge.className = 'victory-badge';
    badge.src = '/assets/victory/kirin-sales-badge-transparent.png';
    badge.alt = 'Most Kirin Beer Sold in a year';
    badge.draggable = false;
    badgeWrap.appendChild(badge);
    content.appendChild(badgeWrap);

    overlay.append(light, content);
    document.body.appendChild(overlay);
    return overlay;
  }

  private showVictory(): void {
    if (this.victoryActive) return;
    this.victoryPending = false;
    this.victoryActive = true;
    this.victoryOverlay.classList.remove('is-active');
    void this.victoryOverlay.offsetWidth;
    this.victoryOverlay.classList.add('is-active');
    this.victoryOverlay.setAttribute('aria-hidden', 'false');
  }

  private hideVictory(): void {
    this.victoryPending = false;
    this.victoryActive = false;
    this.victoryOverlay.classList.remove('is-active');
    this.victoryOverlay.setAttribute('aria-hidden', 'true');
  }

  private createDebugOverlay(): HTMLDivElement | null {
    if (!import.meta.env.DEV) return null;

    const overlay = document.createElement('div');
    overlay.hidden = new URLSearchParams(window.location.search).get('debug') !== '1';
    overlay.style.cssText = [
      'position:fixed',
      'left:8px',
      'top:8px',
      'z-index:10',
      'padding:5px 7px',
      'font:11px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace',
      'color:rgba(255,244,204,0.92)',
      'background:rgba(0,0,0,0.42)',
      'pointer-events:none',
      'white-space:pre',
    ].join(';');
    document.body.appendChild(overlay);
    return overlay;
  }

  private updateDebugOverlay(state: BeerFrameState): void {
    if (!this.debugOverlay || this.debugOverlay.hidden) return;

    this.debugOverlay.textContent = [
      `Current: ${(THREE.MathUtils.clamp(state.currentLevel, 0, 1) * 100).toFixed(1)}%`,
      `Target:  ${(state.targetLevel * 100).toFixed(1)}%`,
      `Hits:    ${Math.round(state.targetLevel * 100)}/100`,
      `Velocity: ${state.velocity.toFixed(3)}`,
      `Impact:   ${state.impact.toFixed(3)}`,
      `Media:    ${this.media.bodyReady}/${this.media.foamReady}/${this.media.burstReady}`,
    ].join('\n');
  }
}
