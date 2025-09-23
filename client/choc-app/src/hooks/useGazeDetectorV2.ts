// src/hooks/useGazeDetectorV2.ts
import { useEffect, useState, useRef, useCallback } from "react";
import type { BlinkResult } from "../useBlinkDetector";

export type GazeDirection = "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER" | "NO_FACE" | "EYES_CLOSED";

// 시선 감지 임계값 설정
const DEFAULT_GAZE_THRESHOLDS = {
  tau_x: 0.25,  // 좌우 방향 임계값
  tau_y: 0.20,  // 상하 방향 임계값
  ema: 0.4,     // EMA 필터 강도
  eyeOpenThreshold: 0.15, // 눈 열림 임계값
};

export interface GazeResult {
  /** 좌안 홍채 위치 (정규화된 좌표) */
  leftIrisPos: { x: number; y: number };
  /** 우안 홍채 위치 (정규화된 좌표) */
  rightIrisPos: { x: number; y: number };
  /** 평균 시선 위치 (px, py: -2.0 ~ 2.0) */
  gazePos: { px: number; py: number };
  /** 캘리브레이션된 시선 위치 */
  calibratedPos: { px: number; py: number };
  /** 현재 시선 방향 */
  direction: GazeDirection;
  /** 눈이 열려있는 정도 (0~1) */
  eyeOpenness: number;
  /** 현재 임계값 */
  thresholds: { tau_x: number; tau_y: number };
  /** 캘리브레이션 오프셋 */
  calibrationOffset: { x: number; y: number };
  /** 캘리브레이션 시각 */
  lastCalibratedAt: number | null;
  /** 시선 감지 준비 상태 */
  isReady: boolean;
}

// MediaPipe FaceMesh 인덱스
const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LEFT_IRIS = [474, 475, 476, 477];
const RIGHT_IRIS = [469, 470, 471, 472];

// 눈 박스 계산
function getEyeBox(landmarks: { x: number; y: number }[], eyeIndices: number[], videoWidth: number, videoHeight: number) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (const idx of eyeIndices) {
    const point = landmarks[idx];
    if (point) {
      const x = point.x * videoWidth;
      const y = point.y * videoHeight;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
  };
}

// 홍채 중심점 계산
function getIrisCentroid(landmarks: { x: number; y: number }[], irisIndices: number[], videoWidth: number, videoHeight: number) {
  let sumX = 0, sumY = 0;

  for (const idx of irisIndices) {
    const point = landmarks[idx];
    if (point) {
      sumX += point.x * videoWidth;
      sumY += point.y * videoHeight;
    }
  }

  return {
    x: sumX / irisIndices.length,
    y: sumY / irisIndices.length,
  };
}

// 시선 방향 분류
function classifyGaze(px: number, py: number, tau_x: number, tau_y: number): GazeDirection {
  if (Math.abs(px) < tau_x && Math.abs(py) < tau_y) {
    return "CENTER";
  }

  const absX = Math.abs(px);
  const absY = Math.abs(py);

  if (absX > absY) {
    return px > 0 ? "RIGHT" : "LEFT";
  } else {
    return py > 0 ? "DOWN" : "UP";
  }
}

export function useGazeDetectorV2(
  blinkResult: BlinkResult,
  enabled: boolean = false
) {
  const { tau_x, tau_y, ema: emaAlpha, eyeOpenThreshold } = DEFAULT_GAZE_THRESHOLDS;

  const [result, setResult] = useState<GazeResult>({
    leftIrisPos: { x: 0, y: 0 },
    rightIrisPos: { x: 0, y: 0 },
    gazePos: { px: 0, py: 0 },
    calibratedPos: { px: 0, py: 0 },
    direction: "NO_FACE",
    eyeOpenness: 0,
    thresholds: { tau_x, tau_y },
    calibrationOffset: { x: 0, y: 0 },
    lastCalibratedAt: null,
    isReady: false,
  });

  // EMA 필터 상태
  const emaPxRef = useRef(0);
  const emaPyRef = useRef(0);
  const emaReadyRef = useRef(false);

  // 캘리브레이션 오프셋
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);
  const lastCalibratedAtRef = useRef<number | null>(null);

  // 최종 결과 상태 추적 (불필요한 렌더링 방지)
  const lastResultRef = useRef<GazeResult | null>(null);

  function safeSetResult(next: GazeResult) {
    const prev = lastResultRef.current;
    if (prev &&
        Math.abs(prev.gazePos.px - next.gazePos.px) < 1e-4 &&
        Math.abs(prev.gazePos.py - next.gazePos.py) < 1e-4 &&
        Math.abs(prev.calibratedPos.px - next.calibratedPos.px) < 1e-4 &&
        Math.abs(prev.calibratedPos.py - next.calibratedPos.py) < 1e-4 &&
        prev.direction === next.direction &&
        Math.abs(prev.eyeOpenness - next.eyeOpenness) < 1e-4 &&
        prev.isReady === next.isReady &&
        prev.lastCalibratedAt === next.lastCalibratedAt) {
      return; // 변화 없으면 렌더 스킵
    }
    lastResultRef.current = next;
    setResult(next);
  }

  // 캘리브레이션 함수
  const calibrate = useCallback(() => {
    if (emaReadyRef.current) {
      offsetXRef.current = emaPxRef.current;
      offsetYRef.current = emaPyRef.current;
      lastCalibratedAtRef.current = Date.now();
      console.log(`[Gaze] Calibrated offset_x=${offsetXRef.current.toFixed(3)}, offset_y=${offsetYRef.current.toFixed(3)}`);
    } else {
      console.log("[Gaze] Cannot calibrate - EMA not ready");
    }
  }, []);

  // 리셋 함수
  const reset = useCallback(() => {
    offsetXRef.current = 0;
    offsetYRef.current = 0;
    emaReadyRef.current = false;
    emaPxRef.current = 0;
    emaPyRef.current = 0;
    lastCalibratedAtRef.current = null;
    console.log("[Gaze] Reset calibration & EMA");
  }, []);

  // 블링크 결과의 랜드마크 데이터 처리
  useEffect(() => {
    console.log("[GazeV2] Effect called", {
      enabled,
      hasLandmarks: !!blinkResult.landmarks,
      landmarksCount: blinkResult.landmarks?.length || 0,
      videoSize: blinkResult.videoSize,
      blinkState: blinkResult.state
    });

    if (!enabled) {
      console.log("[GazeV2] Disabled");
      return;
    }

    const landmarks = blinkResult.landmarks;
    const videoSize = blinkResult.videoSize;

    // 얼굴이 감지되지 않은 경우
    if (!landmarks) {
      console.log("[Gaze] No landmarks from BlinkDetector");
      safeSetResult({
        leftIrisPos: { x: 0, y: 0 },
        rightIrisPos: { x: 0, y: 0 },
        gazePos: { px: 0, py: 0 },
        calibratedPos: { px: 0, py: 0 },
        direction: "NO_FACE",
        eyeOpenness: 0,
        thresholds: { tau_x, tau_y },
        calibrationOffset: { x: offsetXRef.current, y: offsetYRef.current },
        lastCalibratedAt: lastCalibratedAtRef.current,
        isReady: emaReadyRef.current,
      });
      return;
    }

    if (!videoSize || videoSize.width === 0 || videoSize.height === 0) {
      console.log("[Gaze] Invalid video size:", videoSize);
      return;
    }

    console.log("[Gaze] Processing landmarks, video size:", videoSize);

    const videoWidth = videoSize.width;
    const videoHeight = videoSize.height;

    // 좌우 눈 박스 계산
    const leftBox = getEyeBox(landmarks, LEFT_EYE, videoWidth, videoHeight);
    const rightBox = getEyeBox(landmarks, RIGHT_EYE, videoWidth, videoHeight);

    // 눈 열림 정도 계산
    const leftOpen = leftBox.h / leftBox.w;
    const rightOpen = rightBox.h / rightBox.w;
    const eyeOpenness = 0.5 * (leftOpen + rightOpen);

    // 눈이 감혀있으면 감지 중단
    if (eyeOpenness < eyeOpenThreshold) {
      console.log("[Gaze] Eyes closed, openness:", eyeOpenness);
      safeSetResult({
        leftIrisPos: { x: 0, y: 0 },
        rightIrisPos: { x: 0, y: 0 },
        gazePos: { px: emaPxRef.current, py: emaPyRef.current },
        calibratedPos: { px: emaPxRef.current - offsetXRef.current, py: emaPyRef.current - offsetYRef.current },
        direction: "EYES_CLOSED",
        eyeOpenness,
        thresholds: { tau_x, tau_y },
        calibrationOffset: { x: offsetXRef.current, y: offsetYRef.current },
        lastCalibratedAt: lastCalibratedAtRef.current,
        isReady: emaReadyRef.current,
      });
      return;
    }

    // 홍채 중심점 계산
    const leftIris = getIrisCentroid(landmarks, LEFT_IRIS, videoWidth, videoHeight);
    const rightIris = getIrisCentroid(landmarks, RIGHT_IRIS, videoWidth, videoHeight);

    // 홍채의 눈 박스 내 상대 위치 계산 (-2.0 ~ +2.0)
    const leftPx = 2.0 * ((leftIris.x - leftBox.x) / leftBox.w - 0.5);
    const leftPy = 2.0 * ((leftIris.y - leftBox.y) / leftBox.h - 0.5);
    const rightPx = 2.0 * ((rightIris.x - rightBox.x) / rightBox.w - 0.5);
    const rightPy = 2.0 * ((rightIris.y - rightBox.y) / rightBox.h - 0.5);

    // 좌우 평균
    const rawPx = 0.5 * (leftPx + rightPx);
    const rawPy = 0.5 * (leftPy + rightPy);

    // EMA 필터 적용
    if (!emaReadyRef.current) {
      emaPxRef.current = rawPx;
      emaPyRef.current = rawPy;
      emaReadyRef.current = true;
      console.log("[Gaze] EMA initialized");
    } else {
      emaPxRef.current = emaAlpha * emaPxRef.current + (1 - emaAlpha) * rawPx;
      emaPyRef.current = emaAlpha * emaPyRef.current + (1 - emaAlpha) * rawPy;
    }

    // 캘리브레이션 적용
    const calibratedPx = emaPxRef.current - offsetXRef.current;
    const calibratedPy = emaPyRef.current - offsetYRef.current;

    // 방향 분류
    const direction = classifyGaze(calibratedPx, calibratedPy, tau_x, tau_y);

    console.log("[Gaze] Direction:", direction, "px:", calibratedPx.toFixed(3), "py:", calibratedPy.toFixed(3));

    safeSetResult({
      leftIrisPos: { x: leftIris.x / videoWidth, y: leftIris.y / videoHeight },
      rightIrisPos: { x: rightIris.x / videoWidth, y: rightIris.y / videoHeight },
      gazePos: { px: emaPxRef.current, py: emaPyRef.current },
      calibratedPos: { px: calibratedPx, py: calibratedPy },
      direction,
      eyeOpenness,
      thresholds: { tau_x, tau_y },
      calibrationOffset: { x: offsetXRef.current, y: offsetYRef.current },
      lastCalibratedAt: lastCalibratedAtRef.current,
      isReady: emaReadyRef.current,
    });

  }, [enabled, blinkResult, tau_x, tau_y, emaAlpha, eyeOpenThreshold]);

  // 키보드 이벤트 리스너 (캘리브레이션용)
  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === 'c') {
        calibrate();
      } else if (key === 'r') {
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [enabled, calibrate, reset]);

  return {
    ...result,
    calibrate,
    reset,
  };
}