# drill_generator.py
import random, time, argparse
import cv2, mediapipe as mp, numpy as np

LEFT_EYE  = dict(inner=133, outer=33,  top=159, bottom=145)
RIGHT_EYE = dict(inner=362, outer=263, top=386, bottom=374)
LEFT_IRIS  = [474, 475, 476, 477]
RIGHT_IRIS = [469, 470, 471, 472]

class DirectionHold:
    def __init__(self, target_dir: str, hold_sec: float = 3.0, max_jitter_sec: float = 0.0):
        self.target = target_dir.upper()
        self.hold_sec = float(hold_sec)
        self.max_jitter_sec = float(max_jitter_sec)
        self._accum = 0.0; self._jitter = 0.0; self._t_last = None
    def reset(self):
        self._accum = 0.0; self._jitter = 0.0; self._t_last = None
    def update(self, current_dir: str, now: float | None = None):
        now = time.monotonic() if now is None else now
        if self._t_last is None:
            self._t_last = now
            return False, self.hold_sec
        dt = max(0.0, now - self._t_last)
        self._t_last = now
        if (current_dir or "").upper() == self.target:
            self._accum += dt; self._jitter = 0.0
        else:
            self._jitter += dt
            if self._jitter > self.max_jitter_sec:
                self._accum = 0.0; self._jitter = 0.0
        return (self._accum >= self.hold_sec), max(0.0, self.hold_sec - self._accum)

def _lm_xy(lm, i, W, H): p=lm[i]; return p.x*W, p.y*H
def _eye_box(lm, eye, W, H):
    x_in,y_in=_lm_xy(lm,eye["inner"],W,H); x_out,y_out=_lm_xy(lm,eye["outer"],W,H)
    x_top,y_top=_lm_xy(lm,eye["top"],W,H); x_bot,y_bot=_lm_xy(lm,eye["bottom"],W,H)
    cx=0.5*(x_in+x_out); cy=0.5*(y_top+y_bot)
    w=max(1e-6,abs(x_in-x_out)); h=max(1e-6,abs(y_top-y_bot))
    return cx,cy,w,h
def _iris_centroid(lm, idxs, W, H):
    xs,ys=[],[]
    for i in idxs: x,y=_lm_xy(lm,i,W,H); xs.append(x); ys.append(y)
    return float(np.mean(xs)), float(np.mean(ys))
def _classify(px, py, tau_x=0.25, tau_y=0.20):
    ax,ay=abs(px),abs(py)
    if ax<tau_x and ay<tau_y: return "CENTER"
    if ax>=ay: return "LEFT" if px<0 else "RIGHT"
    return "UP" if py<0 else "DOWN"

def gaze_drill_generator(
    k: int = 5,
    src: str = "0",
    mirror: bool = True,
    tau_x: float = 0.25,
    tau_y: float = 0.20,
    hold_sec: float = 3.0,
    jitter_sec: float = 0.15,
    ema: float = 0.5,
):
    """
    매번 '남은(현재 목표) 방향'을 yield 하고, 모든 목표를 성공하면 종료되는 제너레이터.
    사용 예:
        for target in gaze_drill_generator():
            print("현재 목표:", target)  # 모두 성공하면 루프가 자연스럽게 끝남
    """
    src0 = 0 if src == "0" else src
    cap = cv2.VideoCapture(src0)
    if not cap.isOpened():
        raise RuntimeError(f"비디오 소스를 열 수 없습니다: {src}")

    directions = random.choices(["LEFT","RIGHT","UP","DOWN"], k=k)
    print(f"[Sequence] {directions}")

    mp_face_mesh = mp.solutions.face_mesh
    mesh = mp_face_mesh.FaceMesh(
        static_image_mode=False, max_num_faces=1,
        refine_landmarks=True, min_detection_confidence=0.5, min_tracking_confidence=0.5
    )

    idx = 0
    target = directions[idx]
    hold = DirectionHold(target, hold_sec=hold_sec, max_jitter_sec=jitter_sec)

    # 첫 목표를 바로 알리기 위해 yield
    yield target

    ema_px = ema_py = 0.0; ema_ready = False
    off_x = off_y = 0.0
    EYE_OPEN_THRESH = 0.18

    while True:
        ok, frame = cap.read()
        if not ok: break
        if mirror: frame = cv2.flip(frame, 1)
        H, W = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        res = mesh.process(rgb)

        direction = "NO_FACE"
        if res.multi_face_landmarks:
            lms = res.multi_face_landmarks[0].landmark
            l_cx,l_cy,l_w,l_h = _eye_box(lms, LEFT_EYE,  W, H)
            r_cx,r_cy,r_w,r_h = _eye_box(lms, RIGHT_EYE, W, H)
            l_open = (l_h/l_w) if l_w>0 else 0.0
            r_open = (r_h/r_w) if r_w>0 else 0.0
            eye_open = 0.5*(l_open+r_open)

            l_ix,l_iy = _iris_centroid(lms, LEFT_IRIS,  W, H)
            r_ix,r_iy = _iris_centroid(lms, RIGHT_IRIS, W, H)

            l_px = (l_ix-l_cx)/(0.5*l_w); l_py = (l_iy-l_cy)/(0.5*l_h)
            r_px = (r_ix-r_cx)/(0.5*r_w); r_py = (r_iy-r_cy)/(0.5*r_h)
            px = float(np.clip(0.5*(l_px+r_px), -2.0, 2.0))
            py = float(np.clip(0.5*(l_py+r_py), -2.0, 2.0))

            a = float(np.clip(ema, 0.0, 1.0))
            if not ema_ready: ema_px,ema_py,ema_ready = px,py,True
            else:
                ema_px = a*px + (1-a)*ema_px
                ema_py = a*py + (1-a)*ema_py

            px_cal = ema_px - off_x; py_cal = ema_py - off_y
            if eye_open < EYE_OPEN_THRESH: direction = "EYES_CLOSED"
            else: direction = _classify(px_cal, py_cal, tau_x, tau_y)

        # 진행: 목표 유지 성공 여부 확인
        success, remain = hold.update(direction)
        # 간단한 오버레이 (원하면 주석 처리)
        cv2.putText(frame, f"Target={target} Remain={remain:4.1f}s dir={direction}",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0,255,255), 2)
        cv2.imshow("Gaze Drill (generator)", frame)
        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), ord('Q')): break
        elif key in (ord('c'), ord('C')) and ema_ready:
            off_x, off_y = ema_px, ema_py
            print(f"[Calibrated] off_x={off_x:+.3f}, off_y={off_y:+.3f}")
        elif key in (ord('r'), ord('R')):
            off_x=off_y=0.0; ema_ready=False
            print("[Reset] calibration & EMA reset")

        if success:
            print(f"[OK] {target} 유지 {hold.hold_sec}s 완료.")
            idx += 1
            if idx >= len(directions):
                break
            target = directions[idx]
            hold = DirectionHold(target, hold_sec=hold.hold_sec, max_jitter_sec=hold.max_jitter_sec)
            # 다음 목표를 '남은 방향'으로 즉시 전달
            yield target

    cap.release()
    cv2.destroyAllWindows()
