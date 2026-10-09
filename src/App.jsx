import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DISPLAY_CONFIG } from './config.js';

const DISPLAY_STATE = {
  LOADING: 'LOADING',
  IDLE: 'IDLE',
};

const GIF_SOURCE = '/images/clientbeer.webp';

const ASSETS = {
  background: '/images/kirin-background.png',
  opening: '/images/kirin-opening-cutout.png',
  mbor: '/images/mbor-final.png',
  finalLogo: '/images/malaysia-top-selling-kirin-draught-beer.png',
};
const PHASE = { OPENING: 'OPENING', PLAYING: 'PLAYING', FINISHING: 'FINISHING', ENDING: 'ENDING' };

const easeOutCubic = (progress) => 1 - ((1 - progress) ** 3);

const getStepSurfaceY = (step, minY, maxY, totalSteps) => {
  const progress = totalSteps > 0 ? step / totalSteps : 1;
  return minY + ((maxY - minY) * progress);
};

function App() {
  const beerBodyRef = useRef(null);
  const foamSurfaceRef = useRef(null);
  const currentStepRef = useRef(0);
  const visualBeerClipYRef = useRef(DISPLAY_CONFIG.surface.hiddenY);
  const visualFoamYRef = useRef(DISPLAY_CONFIG.surface.hiddenY);
  const surfaceAnimationFrameRef = useRef(0);
  const cursorTimerRef = useRef(0);
  const endingTimerRef = useRef(0);
  const phaseRef = useRef(PHASE.OPENING);
  const readyRef = useRef({ body: false, foam: false, background: false, opening: false, mbor: false, finalLogo: false });

  const [loadError, setLoadError] = useState(false);
  const [displayState, setDisplayState] = useState(DISPLAY_STATE.LOADING);
  const [currentStep, setCurrentStep] = useState(0);
  const [visualBeerClipY, setVisualBeerClipY] = useState(DISPLAY_CONFIG.surface.hiddenY);
  const [visualFoamY, setVisualFoamY] = useState(DISPLAY_CONFIG.surface.hiddenY);
  const [debugMode, setDebugMode] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [phase, setPhase] = useState(PHASE.OPENING);
  const endingActive = phase === PHASE.ENDING;
  const [calibration, setCalibration] = useState({
    minSurfaceY: DISPLAY_CONFIG.surface.minY,
    maxSurfaceY: DISPLAY_CONFIG.surface.maxY,
    fillAnimationMs: DISPLAY_CONFIG.surface.animationMs,
    foamSourceOffsetY: DISPLAY_CONFIG.foam.sourceOffsetY,
    foamBandHeight: DISPLAY_CONFIG.foam.bandHeight,
    foamBandOffsetY: DISPLAY_CONFIG.foam.bandOffsetY,
  });

  const isReady = !loadError && displayState !== DISPLAY_STATE.LOADING;
  const cancelSurfaceAnimation = useCallback(() => {
    window.cancelAnimationFrame(surfaceAnimationFrameRef.current);
    surfaceAnimationFrameRef.current = 0;
  }, []);

  const changePhase = useCallback((nextPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const animateSurfaceTo = useCallback((targetBeerClipY, targetFoamY, onComplete) => {
    cancelSurfaceAnimation();

    const startBeerClipY = visualBeerClipYRef.current;
    const startFoamY = visualFoamYRef.current;
    const beerClipDistance = targetBeerClipY - startBeerClipY;
    const foamDistance = targetFoamY - startFoamY;
    const animationDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0 : calibration.fillAnimationMs;

    if (
      (Math.abs(beerClipDistance) < 0.0001 && Math.abs(foamDistance) < 0.0001)
      || animationDuration <= 0
    ) {
      visualBeerClipYRef.current = targetBeerClipY;
      visualFoamYRef.current = targetFoamY;
      setVisualBeerClipY(targetBeerClipY);
      setVisualFoamY(targetFoamY);
      surfaceAnimationFrameRef.current = window.requestAnimationFrame(() => {
        surfaceAnimationFrameRef.current = 0;
        onComplete?.();
      });
      return;
    }

    const startTime = performance.now();

    const animateFrame = () => {
      const progress = Math.min(1, Math.max(0, (performance.now() - startTime) / animationDuration));
      const easedProgress = easeOutCubic(progress);
      const currentBeerClipY = startBeerClipY + (beerClipDistance * easedProgress);
      const currentFoamY = startFoamY + (foamDistance * easedProgress);

      visualBeerClipYRef.current = currentBeerClipY;
      visualFoamYRef.current = currentFoamY;
      setVisualBeerClipY(currentBeerClipY);
      setVisualFoamY(currentFoamY);

      if (progress < 1) {
        surfaceAnimationFrameRef.current = window.requestAnimationFrame(animateFrame);
        return;
      }

      surfaceAnimationFrameRef.current = 0;
      visualBeerClipYRef.current = targetBeerClipY;
      visualFoamYRef.current = targetFoamY;
      setVisualBeerClipY(targetBeerClipY);
      setVisualFoamY(targetFoamY);
      onComplete?.();
    };

    surfaceAnimationFrameRef.current = window.requestAnimationFrame(animateFrame);
  }, [calibration.fillAnimationMs, cancelSurfaceAnimation]);

  const raiseBeer = useCallback(() => {
    if (!isReady) return;
    if (phaseRef.current === PHASE.OPENING) {
      changePhase(PHASE.PLAYING);
      animateSurfaceTo(calibration.minSurfaceY, calibration.minSurfaceY);
      return;
    }
    if (phaseRef.current !== PHASE.PLAYING) return;

    const targetStep = Math.min(DISPLAY_CONFIG.surface.totalSteps, currentStepRef.current + 1);
    const targetSurfaceY = getStepSurfaceY(
      targetStep, calibration.minSurfaceY, calibration.maxSurfaceY, DISPLAY_CONFIG.surface.totalSteps,
    );
    // Fill behind the translucent foam so the paper stays covered at 100%.
    const targetBodyY = getStepSurfaceY(
      targetStep, calibration.minSurfaceY, Math.min(0, calibration.maxSurfaceY), DISPLAY_CONFIG.surface.totalSteps,
    );
    currentStepRef.current = targetStep;
    setCurrentStep(targetStep);
    const isFull = targetStep === DISPLAY_CONFIG.surface.totalSteps;
    if (isFull) changePhase(PHASE.FINISHING);
    animateSurfaceTo(targetBodyY, targetSurfaceY, isFull ? () => {
      endingTimerRef.current = window.setTimeout(() => {
        endingTimerRef.current = 0;
        changePhase(PHASE.ENDING);
      }, DISPLAY_CONFIG.ending.fullHoldMs);
    } : undefined);
  }, [animateSurfaceTo, calibration.minSurfaceY, calibration.maxSurfaceY, changePhase, isReady]);

  const resetBeer = useCallback(() => {
    window.clearTimeout(endingTimerRef.current);
    endingTimerRef.current = 0;
    cancelSurfaceAnimation();
    changePhase(PHASE.OPENING);
    currentStepRef.current = 0;
    setCurrentStep(0);
    visualBeerClipYRef.current = DISPLAY_CONFIG.surface.hiddenY;
    visualFoamYRef.current = DISPLAY_CONFIG.surface.hiddenY;
    setVisualBeerClipY(DISPLAY_CONFIG.surface.hiddenY);
    setVisualFoamY(DISPLAY_CONFIG.surface.hiddenY);
  }, [cancelSurfaceAnimation, changePhase]);

  const markReady = useCallback((layer) => {
    readyRef.current[layer] = true;

    if (Object.values(readyRef.current).every(Boolean)) {
      setDisplayState((current) =>
        current === DISPLAY_STATE.LOADING ? DISPLAY_STATE.IDLE : current,
      );
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return;

      if (event.code === 'KeyP') {
        event.preventDefault();
        setDebugMode((visible) => !visible);
        return;
      }

      if (event.code === 'KeyA') {
        event.preventDefault();
        raiseBeer();
        return;
      }

      if (event.code === 'KeyR') {
        event.preventDefault();
        resetBeer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [raiseBeer, resetBeer]);

  useEffect(() => {
    const revealCursor = (event) => {
      if (event.pointerType === 'touch') return;

      setCursorHidden(false);
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => {
        if (!debugMode) setCursorHidden(true);
      }, 1800);
    };

    window.addEventListener('pointermove', revealCursor, { passive: true });
    return () => {
      window.removeEventListener('pointermove', revealCursor);
      window.clearTimeout(cursorTimerRef.current);
    };
  }, [debugMode]);

  useEffect(() => () => {
    window.clearTimeout(endingTimerRef.current);
    cancelSurfaceAnimation();
  }, [cancelSurfaceAnimation]);

  const updateCalibration = (key, value) => {
    setCalibration((current) => ({ ...current, [key]: Number(value) }));
  };

  const displayStyle = {
    '--body-clip-top': `${visualBeerClipY * 100}%`,
    '--foam-y': `${visualFoamY * 100}%`,
    '--foam-band-height': `${calibration.foamBandHeight}dvh`,
    '--foam-band-offset-y': `${calibration.foamBandOffsetY}dvh`,
    '--foam-source-offset-y': `${calibration.foamSourceOffsetY}dvh`,
    '--ending-duration-ms': `${DISPLAY_CONFIG.ending.durationMs}ms`,
  };

  return (
    <main
      className={`beer-display ${isReady ? 'is-ready' : 'is-loading'} ${
        cursorHidden && !debugMode ? 'is-cursor-hidden' : ''
      }`}
      style={displayStyle}
      data-state={isReady ? phase : displayState}
      data-hits={currentStep}
      data-beer-clip-y={visualBeerClipY}
      data-foam-y={visualFoamY}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button === 0 || event.pointerType === 'touch') raiseBeer();
      }}
    >
      <img className="scene-background" src={ASSETS.background} alt="" draggable="false"
        onLoad={() => markReady('background')} onError={() => setLoadError(true)} />
      <div className="beer-body-viewport" aria-hidden="true">
        <img ref={beerBodyRef} className="beer-body-image" src={GIF_SOURCE}
          alt="" draggable="false" onLoad={() => markReady('body')}
          onError={() => setLoadError(true)} />
      </div>
      <div className="foam-band" aria-hidden="true">
        <div className="foam-motion">
          <img ref={foamSurfaceRef} className="foam-image" src={GIF_SOURCE}
            alt="" draggable="false" onLoad={() => markReady('foam')}
            onError={() => setLoadError(true)} />
        </div>
      </div>
      {!isReady && (
        <div className="loading-status" role={loadError ? 'alert' : 'status'}>
          {loadError ? 'Unable to load artwork. Please refresh to retry.' : 'Loading…'}
        </div>
      )}

      <div className={`opening-overlay ${phase === PHASE.OPENING ? 'is-active' : ''}`} aria-hidden={phase !== PHASE.OPENING}>
        <img className="opening-art" src={ASSETS.opening} alt="Kirin Oktober Fest" draggable="false"
          onLoad={() => markReady('opening')} onError={() => setLoadError(true)} />
      </div>

      <div className={`progress-overlay ${phase === PHASE.PLAYING || phase === PHASE.FINISHING ? 'is-active' : ''}`}
        role="progressbar" aria-label="Beer filling progress" aria-valuemin={0}
        aria-valuemax={DISPLAY_CONFIG.surface.totalSteps} aria-valuenow={currentStep}
        aria-hidden={phase !== PHASE.PLAYING && phase !== PHASE.FINISHING}>
        <svg className="progress-number" viewBox="0 0 420 170" aria-hidden="true">
          <defs>
            <linearGradient id="progress-silver" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" /><stop offset="0.55" stopColor="#f5f5f5" />
              <stop offset="1" stopColor="#c5c5c5" />
            </linearGradient>
          </defs>
          <text className="progress-shadow" x="210" y="129">{Math.floor(currentStep / DISPLAY_CONFIG.surface.totalSteps * 100)}%</text>
          <text className="progress-face" x="210" y="120">{Math.floor(currentStep / DISPLAY_CONFIG.surface.totalSteps * 100)}%</text>
        </svg>
      </div>

      <div className={`ending-overlay ${endingActive ? 'is-active' : ''}`} aria-hidden={!endingActive}>
        <div className="ending-layout">
          <img className="ending-mbor" src={ASSETS.mbor} alt="The Malaysia Book of Records" draggable="false"
            onLoad={() => markReady('mbor')} onError={() => setLoadError(true)} />
          <img className="ending-final-logo" src={ASSETS.finalLogo}
            alt="Malaysia’s Top-Selling Kirin Draught Beer" draggable="false"
            onLoad={() => markReady('finalLogo')} onError={() => setLoadError(true)} />
        </div>
      </div>

      {debugMode && (
        <aside
          className="debug-panel"
          aria-label="Foam calibration"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header className="debug-panel__header">
            <strong>Foam calibration</strong>
            <span>{currentStep}/{DISPLAY_CONFIG.surface.totalSteps}</span>
          </header>

          <DebugSlider label="MIN_SURFACE_Y" value={calibration.minSurfaceY} min={0.85} max={1.1} step={0.005} onChange={(value) => updateCalibration('minSurfaceY', value)} />
          <DebugSlider label="MAX_SURFACE_Y" value={calibration.maxSurfaceY} min={-0.1} max={0.2} step={0.005} onChange={(value) => updateCalibration('maxSurfaceY', value)} />
          <DebugSlider label="FILL_ANIMATION_MS" value={calibration.fillAnimationMs} min={250} max={800} step={10} suffix="ms" onChange={(value) => updateCalibration('fillAnimationMs', value)} />
          <DebugSlider label="FOAM_SOURCE_OFFSET_Y" value={calibration.foamSourceOffsetY} min={-35} max={0} step={0.1} suffix="vh" onChange={(value) => updateCalibration('foamSourceOffsetY', value)} />
          <DebugSlider label="FOAM_BAND_HEIGHT" value={calibration.foamBandHeight} min={10} max={40} step={0.1} suffix="vh" onChange={(value) => updateCalibration('foamBandHeight', value)} />
          <DebugSlider label="FOAM_BAND_OFFSET_Y" value={calibration.foamBandOffsetY} min={-20} max={10} step={0.1} suffix="vh" onChange={(value) => updateCalibration('foamBandOffsetY', value)} />
        </aside>
      )}
    </main>
  );
}

function DebugSlider({ label, value, min, max, step, suffix = '', onChange }) {
  return (
    <label className="debug-control">
      <span>
        <span>{label}</span>
        <output>{value}{suffix}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default App;
