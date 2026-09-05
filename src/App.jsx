import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VIDEO_CONFIG } from './config.js';

const DISPLAY_STATE = {
  LOADING: 'LOADING',
  IDLE: 'IDLE',
  IMPACT: 'IMPACT',
};

const VIDEO_SOURCE = {
  body: '/videos/beer_body_loop_seamless_v3.mp4',
  foam: '/videos/foam_surface_loop(1).mp4',
  impact: '/videos/foam_impact(1).mp4',
};

const ENDING_LOGO_SOURCE = '/images/mbor.png';

const easeOutCubic = (progress) => 1 - ((1 - progress) ** 3);

const getStepSurfaceY = (step, minY, maxY, totalSteps) => {
  const progress = totalSteps > 0 ? step / totalSteps : 1;
  return minY + ((maxY - minY) * progress);
};

function App() {
  const beerBodyRef = useRef(null);
  const foamSurfaceRef = useRef(null);
  const foamImpactRef = useRef(null);
  const currentStepRef = useRef(0);
  const visualBeerClipYRef = useRef(VIDEO_CONFIG.surface.minY);
  const visualFoamYRef = useRef(VIDEO_CONFIG.surface.minY);
  const surfaceAnimationFrameRef = useRef(0);
  const impactSwitchFrameRef = useRef(0);
  const impactVideoFrameRef = useRef(0);
  const impactRevealTokenRef = useRef(0);
  const cursorTimerRef = useRef(0);
  const endingAnimationFrameRef = useRef(0);
  const readyRef = useRef({ body: false, foam: false, impact: false });

  const [displayState, setDisplayState] = useState(DISPLAY_STATE.LOADING);
  const [currentStep, setCurrentStep] = useState(0);
  const [visualBeerClipY, setVisualBeerClipY] = useState(VIDEO_CONFIG.surface.minY);
  const [visualFoamY, setVisualFoamY] = useState(VIDEO_CONFIG.surface.minY);
  const [debugMode, setDebugMode] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [endingActive, setEndingActive] = useState(false);
  const [calibration, setCalibration] = useState({
    minSurfaceY: VIDEO_CONFIG.surface.minY,
    maxSurfaceY: VIDEO_CONFIG.surface.maxY,
    fillAnimationMs: VIDEO_CONFIG.surface.animationMs,
    foamSourceOffsetYNormal: VIDEO_CONFIG.foam.sourceOffsetYNormal,
    foamSourceOffsetYFull: VIDEO_CONFIG.foam.sourceOffsetYFull,
    foamBandHeight: VIDEO_CONFIG.foam.bandHeight,
    foamBandOffsetY: VIDEO_CONFIG.foam.bandOffsetY,
    impactSourceOffsetY: VIDEO_CONFIG.impact.sourceOffsetY,
    impactStartTime: VIDEO_CONFIG.impact.startTime,
  });

  const isReady = displayState !== DISPLAY_STATE.LOADING;
  const isImpact = displayState === DISPLAY_STATE.IMPACT;

  const clearImpactTimers = useCallback(() => {
    impactRevealTokenRef.current += 1;
    window.cancelAnimationFrame(impactSwitchFrameRef.current);

    const impactVideo = foamImpactRef.current;
    if (
      impactVideoFrameRef.current
      && typeof impactVideo?.cancelVideoFrameCallback === 'function'
    ) {
      impactVideo.cancelVideoFrameCallback(impactVideoFrameRef.current);
    }

    impactVideoFrameRef.current = 0;
    impactSwitchFrameRef.current = 0;
  }, []);

  const returnToFoamLoop = useCallback((expectedTriggerId) => {
    if (
      expectedTriggerId !== undefined
      && expectedTriggerId !== impactRevealTokenRef.current
    ) return;

    clearImpactTimers();
    const switchTriggerId = impactRevealTokenRef.current;

    impactSwitchFrameRef.current = window.requestAnimationFrame(() => {
      if (impactRevealTokenRef.current !== switchTriggerId) return;

      setDisplayState(DISPLAY_STATE.IDLE);
      foamImpactRef.current?.pause();
      impactSwitchFrameRef.current = 0;
    });
  }, [clearImpactTimers]);

  const triggerImpact = useCallback(() => {
    const impactVideo = foamImpactRef.current;

    if (!isReady || !impactVideo) return;

    clearImpactTimers();
    impactVideo.pause();
    impactVideo.currentTime = calibration.impactStartTime;
    impactVideo.muted = true;
    const revealToken = impactRevealTokenRef.current;

    const revealImpact = () => {
      impactVideoFrameRef.current = 0;
      if (impactRevealTokenRef.current !== revealToken) return;

      impactSwitchFrameRef.current = window.requestAnimationFrame(() => {
        if (impactRevealTokenRef.current !== revealToken) return;

        setDisplayState(DISPLAY_STATE.IMPACT);
        impactSwitchFrameRef.current = 0;
      });
    };

    impactVideo.play().then(() => {
      if (impactRevealTokenRef.current !== revealToken) return;

      if (typeof impactVideo.requestVideoFrameCallback === 'function') {
        impactVideoFrameRef.current = impactVideo.requestVideoFrameCallback(revealImpact);
        return;
      }

      revealImpact();
    }).catch(() => returnToFoamLoop(revealToken));
  }, [
    calibration.impactStartTime,
    clearImpactTimers,
    isReady,
    returnToFoamLoop,
  ]);

  const handleImpactEnded = useCallback((event) => {
    if (!event.currentTarget.ended) return;
    returnToFoamLoop(impactRevealTokenRef.current);
  }, [returnToFoamLoop]);

  const cancelSurfaceAnimation = useCallback(() => {
    window.cancelAnimationFrame(surfaceAnimationFrameRef.current);
    surfaceAnimationFrameRef.current = 0;
  }, []);

  const clearEndingAnimation = useCallback(() => {
    window.cancelAnimationFrame(endingAnimationFrameRef.current);
    endingAnimationFrameRef.current = 0;
    setEndingActive(false);
  }, []);

  const triggerEndingAnimation = useCallback(() => {
    clearEndingAnimation();

    endingAnimationFrameRef.current = window.requestAnimationFrame(() => {
      endingAnimationFrameRef.current = 0;
      setEndingActive(true);
    });
  }, [clearEndingAnimation]);

  const animateSurfaceTo = useCallback((targetBeerClipY, targetFoamY, onComplete) => {
    cancelSurfaceAnimation();

    const startBeerClipY = visualBeerClipYRef.current;
    const startFoamY = visualFoamYRef.current;
    const beerClipDistance = targetBeerClipY - startBeerClipY;
    const foamDistance = targetFoamY - startFoamY;
    const animationDuration = calibration.fillAnimationMs;

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

    const animateFrame = (currentTime) => {
      const progress = Math.min(1, (currentTime - startTime) / animationDuration);
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

    const previousStep = currentStepRef.current;
    const targetStep = Math.min(
      VIDEO_CONFIG.surface.totalSteps,
      previousStep + 1,
    );
    const targetSurfaceY = getStepSurfaceY(
      targetStep,
      calibration.minSurfaceY,
      calibration.maxSurfaceY,
      VIDEO_CONFIG.surface.totalSteps,
    );

    currentStepRef.current = targetStep;
    setCurrentStep(targetStep);
    animateSurfaceTo(targetSurfaceY, targetSurfaceY);
    triggerImpact();

    if (
      previousStep < VIDEO_CONFIG.surface.totalSteps
      && targetStep === VIDEO_CONFIG.surface.totalSteps
    ) {
      triggerEndingAnimation();
    }
  }, [
    calibration.maxSurfaceY,
    calibration.minSurfaceY,
    animateSurfaceTo,
    isReady,
    triggerEndingAnimation,
    triggerImpact,
  ]);

  const resetBeer = useCallback(() => {
    if (!isReady) return;

    clearEndingAnimation();
    clearImpactTimers();
    cancelSurfaceAnimation();
    const impactVideo = foamImpactRef.current;
    impactVideo?.pause();
    if (impactVideo) impactVideo.currentTime = calibration.impactStartTime;

    setDisplayState(DISPLAY_STATE.IDLE);
    currentStepRef.current = 0;
    setCurrentStep(0);
    animateSurfaceTo(calibration.minSurfaceY, calibration.minSurfaceY);
    foamSurfaceRef.current?.play().catch(() => {});
  }, [
    animateSurfaceTo,
    calibration.impactStartTime,
    calibration.minSurfaceY,
    cancelSurfaceAnimation,
    clearEndingAnimation,
    clearImpactTimers,
    isReady,
  ]);

  const markReady = useCallback((layer) => {
    readyRef.current[layer] = true;

    if (readyRef.current.body && readyRef.current.foam) {
      beerBodyRef.current?.play().catch(() => {});
      foamSurfaceRef.current?.play().catch(() => {});
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
    window.cancelAnimationFrame(endingAnimationFrameRef.current);
    clearImpactTimers();
    cancelSurfaceAnimation();
  }, [cancelSurfaceAnimation, clearImpactTimers]);

  const updateCalibration = (key, value) => {
    setCalibration((current) => ({ ...current, [key]: Number(value) }));
  };

  const surfaceRange = calibration.maxSurfaceY - calibration.minSurfaceY;
  const overallProgress = surfaceRange === 0
    ? 1
    : Math.min(1, Math.max(
      0,
      (visualBeerClipY - calibration.minSurfaceY) / surfaceRange,
    ));
  const fullCropProgress = Math.min(1, Math.max(0, (overallProgress - 0.75) / 0.25));
  const activeFoamSourceOffsetY = (
    calibration.foamSourceOffsetYNormal
    + (
      (calibration.foamSourceOffsetYFull - calibration.foamSourceOffsetYNormal)
      * fullCropProgress
    )
  );
  const fullCropOffsetDelta = (
    calibration.foamSourceOffsetYFull - calibration.foamSourceOffsetYNormal
  );
  const activeImpactSourceOffsetY = (
    calibration.impactSourceOffsetY + (fullCropOffsetDelta * fullCropProgress)
  );

  const displayStyle = {
    '--body-clip-top': `${visualBeerClipY * 100}%`,
    '--foam-y': `${visualFoamY * 100}%`,
    '--foam-band-height': `${calibration.foamBandHeight}px`,
    '--foam-band-offset-y': `${calibration.foamBandOffsetY}px`,
    '--foam-source-offset-y': `${activeFoamSourceOffsetY}px`,
    '--impact-source-offset-y': `${activeImpactSourceOffsetY}px`,
    '--ending-duration-ms': `${VIDEO_CONFIG.ending.durationMs}ms`,
  };

  return (
    <main
      className={`beer-display ${isReady ? 'is-ready' : 'is-loading'} ${
        cursorHidden && !debugMode ? 'is-cursor-hidden' : ''
      }`}
      style={displayStyle}
      data-state={displayState}
      data-beer-clip-y={visualBeerClipY}
      data-foam-y={visualFoamY}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button === 0 || event.pointerType === 'touch') raiseBeer();
      }}
    >
      <div className="beer-body-viewport" aria-hidden="true">
        <video
          ref={beerBodyRef}
          className="beer-body-video"
          src={VIDEO_SOURCE.body}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          tabIndex="-1"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onLoadedData={() => markReady('body')}
          onCanPlay={() => markReady('body')}
        />
      </div>

      <div className="foam-band" aria-hidden="true">
        <video
          ref={foamSurfaceRef}
          className={`foam-video foam-surface-video ${isImpact ? '' : 'is-visible'}`}
          src={VIDEO_SOURCE.foam}
          autoPlay
          muted
          playsInline
          loop
          preload="auto"
          tabIndex="-1"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onLoadedData={() => markReady('foam')}
          onCanPlay={() => markReady('foam')}
        />

        <video
          ref={foamImpactRef}
          className={`foam-video foam-impact-video ${isImpact ? 'is-visible' : ''}`}
          src={VIDEO_SOURCE.impact}
          muted
          playsInline
          preload="auto"
          tabIndex="-1"
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onLoadedData={() => markReady('impact')}
          onCanPlay={() => markReady('impact')}
          onEnded={handleImpactEnded}
        />
      </div>

      <div
        className={`ending-overlay ${endingActive ? 'is-active' : ''}`}
        aria-hidden="true"
      >
        <img
          className="ending-logo"
          src={ENDING_LOGO_SOURCE}
          alt=""
          draggable="false"
        />
      </div>

      {debugMode && (
        <aside
          className="debug-panel"
          aria-label="Foam calibration"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header className="debug-panel__header">
            <strong>Foam calibration</strong>
            <span>{currentStep}/{VIDEO_CONFIG.surface.totalSteps}</span>
          </header>

          <DebugSlider label="MIN_SURFACE_Y" value={calibration.minSurfaceY} min={0.85} max={0.97} step={0.005} onChange={(value) => updateCalibration('minSurfaceY', value)} />
          <DebugSlider label="MAX_SURFACE_Y" value={calibration.maxSurfaceY} min={-0.1} max={0.1} step={0.005} onChange={(value) => updateCalibration('maxSurfaceY', value)} />
          <DebugSlider label="FILL_ANIMATION_MS" value={calibration.fillAnimationMs} min={250} max={800} step={10} suffix="ms" onChange={(value) => updateCalibration('fillAnimationMs', value)} />
          <DebugSlider label="IMPACT_START_TIME" value={calibration.impactStartTime} min={0.2} max={0.8} step={0.05} suffix="s" onChange={(value) => updateCalibration('impactStartTime', value)} />
          <DebugSlider label="FOAM_SOURCE_OFFSET_Y_NORMAL" value={calibration.foamSourceOffsetYNormal} min={-900} max={900} step={1} suffix="px" onChange={(value) => updateCalibration('foamSourceOffsetYNormal', value)} />
          <DebugSlider label="FOAM_SOURCE_OFFSET_Y_FULL" value={calibration.foamSourceOffsetYFull} min={-900} max={900} step={1} suffix="px" onChange={(value) => updateCalibration('foamSourceOffsetYFull', value)} />
          <DebugSlider label="FOAM_BAND_HEIGHT" value={calibration.foamBandHeight} min={260} max={1600} step={1} suffix="px" onChange={(value) => updateCalibration('foamBandHeight', value)} />
          <DebugSlider label="FOAM_BAND_OFFSET_Y" value={calibration.foamBandOffsetY} min={-300} max={300} step={1} suffix="px" onChange={(value) => updateCalibration('foamBandOffsetY', value)} />
          <DebugSlider label="IMPACT_SOURCE_OFFSET_Y" value={calibration.impactSourceOffsetY} min={-900} max={900} step={1} suffix="px" onChange={(value) => updateCalibration('impactSourceOffsetY', value)} />
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
