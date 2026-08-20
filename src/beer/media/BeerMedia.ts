import * as THREE from 'three';

const MEDIA_ROOT = '/assets/beer-video/processed';
const MEDIA_VERSION = '20260819h';

function mediaUrl(name: string): string {
  return MEDIA_ROOT + '/' + name + '?v=' + MEDIA_VERSION;
}

function createVideo(src: string, loop: boolean): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = src;
  video.loop = loop;
  video.muted = true;
  video.autoplay = loop;
  video.preload = 'auto';
  video.playsInline = true;
  video.controls = false;
  video.disablePictureInPicture = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.style.display = 'none';
  document.body.appendChild(video);
  video.load();
  return video;
}

function createVideoTexture(video: HTMLVideoElement): THREE.VideoTexture {
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function loadPoster(path: string): THREE.Texture {
  const texture = new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class BeerMedia {
  readonly bodyVideo = createVideo(mediaUrl('body-d-carbonation-v1.mp4'), true);
  readonly foamVideo = createVideo(mediaUrl('foam-d-v1.mp4'), true);
  readonly burstVideo = createVideo(mediaUrl('hit-burst-packed.mp4'), false);

  readonly bodyTexture = createVideoTexture(this.bodyVideo);
  readonly foamTexture = createVideoTexture(this.foamVideo);
  readonly burstTexture = createVideoTexture(this.burstVideo);
  readonly bodyPoster = loadPoster(mediaUrl('body-d-carbonation-v1.webp'));
  readonly foamPoster = loadPoster(mediaUrl('foam-d-v1.webp'));

  bodyReady = 0;
  foamReady = 0;
  burstReady = 0;
  burstOpacity = 0;

  private burstStartedAt = -Infinity;

  constructor() {
    this.bodyVideo.addEventListener('loadeddata', () => { this.bodyReady = 1; });
    this.foamVideo.addEventListener('loadeddata', () => { this.foamReady = 1; });
    this.burstVideo.addEventListener('loadeddata', () => { this.burstReady = 1; });
    this.bodyReady = Number(this.bodyVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    this.foamReady = Number(this.foamVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    this.burstReady = Number(this.burstVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    this.startLoops();
  }

  update(elapsed: number, level: number, impact: number): void {
    this.bodyVideo.playbackRate = THREE.MathUtils.clamp(1 + impact * 0.42, 0.5, 1.7);
    this.foamVideo.playbackRate = THREE.MathUtils.clamp(1 + impact * 0.18, 0.5, 1.35);

    if (level > 0.002) this.startLoops();

    const burstAge = elapsed - this.burstStartedAt;
    const fadeIn = THREE.MathUtils.smoothstep(burstAge, 0, 0.12);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(burstAge, 0.72, 1.45);
    this.burstOpacity = this.burstReady * Math.max(0, fadeIn * fadeOut);
  }

  triggerBurst(elapsed: number): void {
    this.burstStartedAt = elapsed;
    if (this.burstVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
      this.burstVideo.currentTime = 0;
    }
    this.burstVideo.playbackRate = 1;
    void this.burstVideo.play().catch(() => undefined);

  }

  resumePlayback(): void {
    this.startLoops();
  }

  dispose(): void {
    for (const video of [this.bodyVideo, this.foamVideo, this.burstVideo]) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    }

    this.bodyTexture.dispose();
    this.foamTexture.dispose();
    this.burstTexture.dispose();
    this.bodyPoster.dispose();
    this.foamPoster.dispose();
  }

  private startLoops(): void {
    void this.bodyVideo.play().catch(() => undefined);
    void this.foamVideo.play().catch(() => undefined);
  }
}
