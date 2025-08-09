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
import { usePageVisibility } from "./hooks/usePageVisibility";

type BlinkState = "UNKNOWN" | "OPEN" | "CLOSING" | "CLOSED" | "OPENING";

export interface BlinkResult {
  ratioL: number;
  ratioR: number;
  /** 좌/우 평균 EAR 유사치 */
  avgRatio: number;
  state: BlinkState;
  blinks: number;
  lastBlinkAt: number | null;

  /** 현재 동작 임계값(히스테리시스 반영) */
  CLOSE_T: number;
  OPEN_T: number;

  /** 캘리브레이션용 현재 윈도우 통계 */
  windowMin: number;
  windowMax: number;

  /** 임계값이 마지막으로 갱신된 시각(ms) */
  lastCalibratedAt: number | null;
}

/** 유클리드 거리 */
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

/**
 * MediaPipe FaceMesh 인덱스 (정면 기준)
 * 좌안: 가로(33-133), 세로(159-145)
 * 우안: 가로(362-263), 세로(386-374)
 * - 참고: 좌표는 정규화([0..1])
 */
const LEFT = { L: 33, R: 133, T: 159, B: 145 };
const RIGHT = { L: 362, R: 263, T: 386, B: 374 };

/** EAR 유사치: 세로/가로 (값이 작아지면 감김) */
function eyeOpenRatio(lm: { x: number; y: number }[], eye: typeof LEFT) {
  const w = dist(lm[eye.L], lm[eye.R]) + 1e-6;
  const h = dist(lm[eye.T], lm[eye.B]);
  return h / w;
}

/** 이동평균(간단 저역통과) - 더 빠른 반응을 위해 알파값 증가 */
function smooth(prev: number, next: number, alpha = 0.4) {
  return prev * (1 - alpha) + next * alpha;
}

export function useBlinkDetector(videoRef: RefObject<HTMLVideoElement>) {
  // 초기 고정 임계값 (첫 10초만 사용)
  const INIT_CLOSE_T = 0.35;
  const INIT_OPEN_T = 0.35;

  // 캘리브레이션 설정
  const INIT_FIXED_MS = 5_000; // 5초
  const CAL_WINDOW_MS = 10_000; // 10초
  const [res, setRes] = useState<BlinkResult>({
    ratioL: 0,
    ratioR: 0,
    avgRatio: 0,
    state: "UNKNOWN",
    blinks: 0,
    lastBlinkAt: null,
    CLOSE_T: INIT_CLOSE_T,
    OPEN_T: INIT_OPEN_T,
    windowMin: Number.POSITIVE_INFINITY,
    windowMax: Number.NEGATIVE_INFINITY,
    lastCalibratedAt: null,
  });

  const camRef = useRef<Camera | null>(null);
  const meshRef = useRef<FaceMesh | null>(null);
  const rafRef = useRef<number | null>(null);

  // 스무딩된 비율
  const rLRef = useRef(0);
  const rRRef = useRef(0);

  // 상태 관리
  const stateRef = useRef<BlinkState>("UNKNOWN");
  const blinksRef = useRef(0);
  const lastBlinkAtRef = useRef<number | null>(null);

  // 상태 지속시간 추적
  const stateStartTimeRef = useRef<number>(0);
  const consecutiveFramesRef = useRef<number>(0);
  const lastDetectedRatioRef = useRef<number>(0);

  // 동적으로 바뀌는 임계값(히스테리시스 포함)
  const closeTRef = useRef<number>(INIT_CLOSE_T);
  const openTRef = useRef<number>(INIT_OPEN_T);

  // 캘리브레이션 윈도우
  const windowStartRef = useRef<number>(0);
  const winMinRef = useRef<number>(Number.POSITIVE_INFINITY);
  const winMaxRef = useRef<number>(Number.NEGATIVE_INFINITY);
  const lastCalibratedAtRef = useRef<number | null>(null);

  // 최초 10초 동안은 고정 임계값 사용
  const startedAtRef = useRef<number>(Date.now());

  // 기타 파라미터 (기존 유지)
  const MIN_STATE_DURATION = 30; // ms
  const MIN_CONSECUTIVE_FRAMES = 1;
  const NO_FACE_TIMEOUT = 3000; // ms

  // 페이지 가시성 감지
  const { isVisible } = usePageVisibility();

  // 마지막 프레임 업데이트 시간
  const lastUpdateTimeRef = useRef<number>(0);

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
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });
      meshRef.current = fm;
    },
    []
  );

  // videoRef.current가 변경될 때마다 실행되는 콜백
  const handleVideoRefChange = useCallback(() => {
    if (!videoRef.current) {
      console.log(
        "videoRef.current is null, skipping blink detector initialization"
      );
      return () => {};
    }

    let cancelled = false;
    const videoEl = videoRef.current;

    (async () => {
      if (cancelled) return;

      // 상태 초기화
      stateRef.current = "UNKNOWN";
      stateStartTimeRef.current = Date.now();
      consecutiveFramesRef.current = 0;
      rLRef.current = 0;
      rRRef.current = 0;

      // 캘리브레이션 초기화
      startedAtRef.current = Date.now();
      windowStartRef.current = startedAtRef.current;
      winMinRef.current = Number.POSITIVE_INFINITY;
      winMaxRef.current = Number.NEGATIVE_INFINITY;
      closeTRef.current = INIT_CLOSE_T;
      openTRef.current = INIT_OPEN_T;
      lastCalibratedAtRef.current = null;

      // FaceMesh 초기화
      const mesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      meshRef.current = mesh;

      // 설정
      await mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // 결과 처리
      meshRef.current.onResults(
        (results: { multiFaceLandmarks?: { x: number; y: number }[][] }) => {
          if (cancelled) return;

          const lm = results.multiFaceLandmarks?.[0];
          const now = Date.now();

          // 얼굴이 감지되지 않은 경우
          if (!lm) {
            // 일정 시간 후 상태 리셋
            if (now - stateStartTimeRef.current > NO_FACE_TIMEOUT) {
              stateRef.current = "UNKNOWN";
              rLRef.current = 0;
              rRRef.current = 0;
              consecutiveFramesRef.current = 0;
            }

            setRes((prev) => ({
              ...prev,
              ratioL: rLRef.current,
              ratioR: rRRef.current,
              avgRatio:
                rLRef.current === 0 && rRRef.current === 0
                  ? 0
                  : (rLRef.current + rRRef.current) / 2,
              state: stateRef.current,
              blinks: blinksRef.current,
              lastBlinkAt: lastBlinkAtRef.current,
              CLOSE_T: closeTRef.current,
              OPEN_T: openTRef.current,
              windowMin: winMinRef.current,
              windowMax: winMaxRef.current,
              lastCalibratedAt: lastCalibratedAtRef.current,
            }));
            return;
          }

          // EAR 계산 및 스무딩
          const rawL = eyeOpenRatio(lm, LEFT);
          const rawR = eyeOpenRatio(lm, RIGHT);

          // 초기값이 0이면 바로 설정 (스무딩 없이)
          if (rLRef.current === 0) rLRef.current = rawL;
          if (rRRef.current === 0) rRRef.current = rawR;

          rLRef.current = smooth(rLRef.current, rawL);
          rRRef.current = smooth(rRRef.current, rawR);

          // 평균 EAR 계산
          const avgRatio = (rLRef.current + rRRef.current) / 2;
          const currentState = stateRef.current;
          let newState = currentState;

          // ===== 캘리브레이션 윈도우 업데이트 =====
          // 윈도우 내 min/max 갱신
          if (avgRatio < winMinRef.current) winMinRef.current = avgRatio;
          if (avgRatio > winMaxRef.current) winMaxRef.current = avgRatio;

          const elapsedSinceStart = now - startedAtRef.current;
          const elapsedInWindow = now - windowStartRef.current;

          // 첫 5초는 초기 임계값 고정 사용
          const inInitialFixedPhase = elapsedSinceStart < INIT_FIXED_MS;

          // 윈도우가 끝났다면 임계값 갱신(초기 10초 이후부터)
          if (!inInitialFixedPhase && elapsedInWindow >= CAL_WINDOW_MS) {
            const min = winMinRef.current;
            const max = winMaxRef.current;

            if (isFinite(min) && isFinite(max) && max > min) {
              const avg = (min + max) / 2;
              closeTRef.current = avg;
              openTRef.current = avg;
              lastCalibratedAtRef.current = now;
            }

            // 다음 윈도우로 리셋
            windowStartRef.current = now;
            winMinRef.current = Number.POSITIVE_INFINITY;
            winMaxRef.current = Number.NEGATIVE_INFINITY;
          }

          // ===== 상태 전환 로직 =====
          const timeSinceStateChange = now - stateStartTimeRef.current;

          // 연속 프레임 검사를 더 관대하게 - 비율이 크게 변하지 않으면 연속으로 간주
          const ratioDiff = Math.abs(avgRatio - lastDetectedRatioRef.current);
          if (ratioDiff < 0.02) {
            consecutiveFramesRef.current += 1;
          } else {
            consecutiveFramesRef.current = 1;
          }
          lastDetectedRatioRef.current = avgRatio;

          // 상태 변경 조건 확인 (최소 지속시간과 연속 프레임 조건)
          const canChangeState =
            timeSinceStateChange >= MIN_STATE_DURATION &&
            consecutiveFramesRef.current >= MIN_CONSECUTIVE_FRAMES;

          // 현재 사용 임계값
          const CLOSE_T = closeTRef.current;
          const OPEN_T = openTRef.current;

          switch (currentState) {
            case "UNKNOWN":
              if (avgRatio > OPEN_T) {
                newState = "OPEN";
              } else if (avgRatio < CLOSE_T) {
                newState = "CLOSED";
              }
              break;

            case "OPEN":
              if (canChangeState && avgRatio < CLOSE_T) {
                newState = "CLOSED";
              }
              break;

            case "CLOSED":
              if (canChangeState && avgRatio > OPEN_T) {
                newState = "OPEN";
                // 완전한 깜빡임 사이클 완료
                blinksRef.current += 1;
                lastBlinkAtRef.current = now;
              }
              break;
          }

          // 상태가 변경된 경우
          if (newState !== currentState) {
            stateRef.current = newState;
            stateStartTimeRef.current = now;
            consecutiveFramesRef.current = 0;
          }

          setRes({
            ratioL: rLRef.current,
            ratioR: rRRef.current,
            avgRatio,
            state: newState,
            blinks: blinksRef.current,
            lastBlinkAt: lastBlinkAtRef.current,
            CLOSE_T: closeTRef.current,
            OPEN_T: openTRef.current,
            windowMin: winMinRef.current,
            windowMax: winMaxRef.current,
            lastCalibratedAt: lastCalibratedAtRef.current,
          });
        }
      );

      // 카메라 프레임 → FaceMesh로 보내기
      camRef.current = new Camera(videoEl, {
        onFrame: async () => {
          if (!meshRef.current || cancelled) return;

          // 백그라운드에서는 프레임 처리 빈도 줄이기
          if (!isVisible) {
            // 백그라운드에서는 500ms마다 한 번씩만 처리
            const now = Date.now();
            if (now - lastUpdateTimeRef.current < 500) {
              return;
            }
            lastUpdateTimeRef.current = now;
          }

          await meshRef.current.send({ image: videoEl });
        },
        width: 1280,
        height: 720,
      });

      if (!cancelled) camRef.current.start();
    })();

    return () => {
      cancelled = true;
      const rafId = rafRef.current;
      camRef.current?.stop();
      camRef.current = null;
      meshRef.current?.close();
      meshRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [initMesh, videoRef, isVisible]);

  useEffect(() => {
    const cleanup = handleVideoRefChange();
    return cleanup;
  }, [handleVideoRefChange]);

  return res;
}
