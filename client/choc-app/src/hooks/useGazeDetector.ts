import {
  useEffect,
  useMemo,
  useRef,
  useState,
  RefObject,
  useCallback,
} from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

export type GazeDirection = "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER" | "NO_FACE" | "EYES_CLOSED";

// ========================================
// 시선 감지 임계값 설정
// ========================================
/**
 * 시선 방향 분류를 위한 기본 임계값
 *
 * 🎯 tau_x, tau_y 조정 가이드:
 * - 0.1~0.2: 매우 민감 (약간의 눈동자 움직임도 감지)
 * - 0.2~0.3: 민감 (적당한 눈동자 움직임 감지) ← 현재 설정
 * - 0.3~0.4: 보통 (일반적인 눈동자 움직임 감지)
 * - 0.5~0.7: 둔감 (명확한 눈동자 움직임 필요)
 * - 0.8~1.0: 매우 둔감 (큰 눈동자 움직임 필요)
 *
 * 📏 좌표계 설명:
 * - px, py는 정규화된 홍채 위치 (-2.0 ~ +2.0)
 * - 음수: LEFT, UP / 양수: RIGHT, DOWN
 * - CENTER: abs(px) < tau_x AND abs(py) < tau_y
 */
const DEFAULT_GAZE_THRESHOLDS = {
  tau_x: 0.25,  // 좌우 방향 임계값 - 적당한 민감도로 조정
  tau_y: 0.20,  // 상하 방향 임계값 - 적당한 민감도로 조정
  ema: 0.4,     // EMA 필터 강도 - 안정성을 위해 조금 높임
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
  /** 눈이 열려있는 정도 (0~1, 0.18 이하면 감은 것으로 판단) */
  eyeOpenness: number;
  /** 시선 방향 분류 임계값 */
  thresholds: { tau_x: number; tau_y: number };
  /** 캘리브레이션 오프셋 */
  calibrationOffset: { x: number; y: number };
  /** 캘리브레이션된 시각 */
  lastCalibratedAt: number | null;
  /** EMA 필터 준비 여부 */
  isReady: boolean;
}

export interface UseGazeDetectorReturn extends GazeResult {
  calibrate: () => void;
  reset: () => void;
}

/** MediaPipe FaceMesh 랜드마크 인덱스 */
const LEFT_EYE = { inner: 133, outer: 33, top: 159, bottom: 145 };
const RIGHT_EYE = { inner: 362, outer: 263, top: 386, bottom: 374 };
const LEFT_IRIS = [474, 475, 476, 477];
const RIGHT_IRIS = [469, 470, 471, 472];

/** 랜드마크 좌표 추출 (정규화된 좌표를 픽셀 좌표로 변환) */
function getLandmarkXY(landmarks: { x: number; y: number }[], index: number, width: number, height: number) {
  const p = landmarks[index];
  return { x: p.x * width, y: p.y * height };
}

/** 눈 박스 계산 */
function getEyeBox(landmarks: { x: number; y: number }[], eye: typeof LEFT_EYE, width: number, height: number) {
  const inner = getLandmarkXY(landmarks, eye.inner, width, height);
  const outer = getLandmarkXY(landmarks, eye.outer, width, height);
  const top = getLandmarkXY(landmarks, eye.top, width, height);
  const bottom = getLandmarkXY(landmarks, eye.bottom, width, height);

  const cx = 0.5 * (inner.x + outer.x);
  const cy = 0.5 * (top.y + bottom.y);
  const w = Math.max(1e-6, Math.abs(inner.x - outer.x));
  const h = Math.max(1e-6, Math.abs(top.y - bottom.y));

  return { cx, cy, w, h };
}

/** 홍채 중심점 계산 */
function getIrisCentroid(landmarks: { x: number; y: number }[], indices: number[], width: number, height: number) {
  const points = indices.map(i => getLandmarkXY(landmarks, i, width, height));
  const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x: avgX, y: avgY };
}

/** 시선 방향 분류 */
function classifyGaze(
  px: number,
  py: number,
  tau_x: number = DEFAULT_GAZE_THRESHOLDS.tau_x,
  tau_y: number = DEFAULT_GAZE_THRESHOLDS.tau_y
): GazeDirection {
  const ax = Math.abs(px);
  const ay = Math.abs(py);

  // 중앙 영역 판정: 좌우/상하 모두 임계값 이내면 CENTER
  if (ax < tau_x && ay < tau_y) return "CENTER";

  // 좌우 vs 상하 중 더 큰 변화량을 가진 방향으로 분류
  if (ax >= ay) return px < 0 ? "LEFT" : "RIGHT";
  return py < 0 ? "UP" : "DOWN";
}

/** EMA 스무딩 */
function smooth(prev: number, next: number, alpha: number = 0.5) {
  return alpha * next + (1 - alpha) * prev;
}

export function useGazeDetector(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean = true,
  options?: {
    tau_x?: number;
    tau_y?: number;
    ema?: number;
    eyeOpenThreshold?: number;
  }
): UseGazeDetectorReturn {
  // 옵션이 제공되지 않으면 기본값 사용
  const tau_x = options?.tau_x ?? DEFAULT_GAZE_THRESHOLDS.tau_x;
  const tau_y = options?.tau_y ?? DEFAULT_GAZE_THRESHOLDS.tau_y;
  const emaAlpha = options?.ema ?? DEFAULT_GAZE_THRESHOLDS.ema;
  const eyeOpenThreshold = options?.eyeOpenThreshold ?? DEFAULT_GAZE_THRESHOLDS.eyeOpenThreshold;

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

  const camRef = useRef<Camera | null>(null);
  const meshRef = useRef<FaceMesh | null>(null);

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

  // FaceMesh 초기화
  const initMesh = useMemo(
    () => async () => {
      const fm = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      meshRef.current = fm;
    },
    []
  );

  // 캘리브레이션 함수
  const calibrate = useCallback(() => {
    if (emaReadyRef.current) {
      offsetXRef.current = emaPxRef.current;
      offsetYRef.current = emaPyRef.current;
      lastCalibratedAtRef.current = Date.now();
      console.log(`[Gaze Calibrated] offset_x=${offsetXRef.current.toFixed(3)}, offset_y=${offsetYRef.current.toFixed(3)}`);
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
    console.log("[Gaze Reset] calibration & EMA reset");
  }, []);

  // videoRef 변경 감지 및 초기화
  const handleVideoRefChange = useCallback(() => {
    if (!videoRef.current || !enabled) {
      return;
    }

    const videoEl = videoRef.current;
    let cancelled = false;

    // 상태 초기화
    reset();

    (async () => {
      await initMesh();
      if (!meshRef.current) {
        console.error("FaceMesh is not initialized for gaze detection");
        return;
      }

      meshRef.current.onResults((results: { multiFaceLandmarks?: { x: number; y: number }[][] }) => {
        if (cancelled) return;

        const landmarks = results.multiFaceLandmarks?.[0];

        // 얼굴이 감지되지 않은 경우
        if (!landmarks) {
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

        const videoWidth = videoEl.videoWidth || 1280;
        const videoHeight = videoEl.videoHeight || 720;

        // 좌우 눈 박스 계산
        const leftBox = getEyeBox(landmarks, LEFT_EYE, videoWidth, videoHeight);
        const rightBox = getEyeBox(landmarks, RIGHT_EYE, videoWidth, videoHeight);

        // 눈 열림 정도 계산
        const leftOpen = leftBox.h / leftBox.w;
        const rightOpen = rightBox.h / rightBox.w;
        const eyeOpenness = 0.5 * (leftOpen + rightOpen);

        // 눈이 감혀있으면 감지 중단
        if (eyeOpenness < eyeOpenThreshold) {
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

        // 정규화된 홍채 위치 계산 (px, py: -2.0 ~ 2.0)
        const leftPx = (leftIris.x - leftBox.cx) / (0.5 * leftBox.w);
        const leftPy = (leftIris.y - leftBox.cy) / (0.5 * leftBox.h);
        const rightPx = (rightIris.x - rightBox.cx) / (0.5 * rightBox.w);
        const rightPy = (rightIris.y - rightBox.cy) / (0.5 * rightBox.h);

        // 평균 위치 계산 및 클리핑
        const rawPx = Math.max(-2.0, Math.min(2.0, 0.5 * (leftPx + rightPx)));
        const rawPy = Math.max(-2.0, Math.min(2.0, 0.5 * (leftPy + rightPy)));

        // EMA 필터링
        if (!emaReadyRef.current) {
          emaPxRef.current = rawPx;
          emaPyRef.current = rawPy;
          emaReadyRef.current = true;
        } else {
          emaPxRef.current = smooth(emaPxRef.current, rawPx, emaAlpha);
          emaPyRef.current = smooth(emaPyRef.current, rawPy, emaAlpha);
        }

        // 캘리브레이션 적용
        const calibratedPx = emaPxRef.current - offsetXRef.current;
        const calibratedPy = emaPyRef.current - offsetYRef.current;

        // 방향 분류
        const direction = classifyGaze(calibratedPx, calibratedPy, tau_x, tau_y);

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
      });

      // 카메라 프레임 → FaceMesh로 보내기
      camRef.current = new Camera(videoEl, {
        onFrame: async () => {
          if (!meshRef.current) return;
          await meshRef.current.send({ image: videoEl });
        },
        width: 1280,
        height: 720,
      });

      if (!cancelled) camRef.current.start();
    })();

    return () => {
      cancelled = true;
      camRef.current?.stop();
      camRef.current = null;
      meshRef.current?.close();
      meshRef.current = null;
    };
  }, [initMesh, videoRef, enabled, tau_x, tau_y, emaAlpha, eyeOpenThreshold, reset]);

  useEffect(() => {
    if (enabled) {
      const cleanup = handleVideoRefChange();
      return cleanup;
    }
  }, [enabled, handleVideoRefChange]);

  // 키보드 이벤트 리스너 (캘리브레이션용)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!enabled) return;

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