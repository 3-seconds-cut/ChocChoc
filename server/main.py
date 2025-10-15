# server/main.py
import time
import contextlib
import asyncio
import pandas as pd
import queue
import base64
import os
import openai
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class UserStatus(BaseModel):
    id: str
    name: str
    meta: Optional[Dict] = None

class HonorStatus(BaseModel):
    user_id: str
    title: Optional[str] = None
    color: Optional[str] = None

class BlinkSession(BaseModel):
    id: str
    events: List[str]
    startedAt: str
    endedAt: str

DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
class ApiKeyRequest(BaseModel):
    api_key: str
    user_id: Optional[str] = None

class RegisterUserRequest(BaseModel):
    id: str
    name: str
    meta: Optional[Dict] = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# in-memory stores (single-user assumption is fine)
data_store: Dict[str, Dict] = {}
user_store: Dict[str, Dict] = {}
api_key_store: Dict[str, str] = {}
history_store: Dict[str, List[Dict]] = {}
honor_store: Dict[str, Dict] = {}
for user_name, name in zip(
    ['판교 개발자 영진', '노모어피자 치즈크러스트', '애플 디톡스', '야근조아', '퇴근덕후', '김연진사생팬'],
    ['increase', 'decrease', 'stable', 'month', 'week', 'first']
):
    user_store[name] = {"id": name, "name": user_name, "meta": {}}
    honor_store[name] = {"user_id": name, "title": "기본 사용자", "color": "#000000"}
    history_store[name] = (user_name, pd.read_csv(f'data/blink_data_{name}.csv', index_col=0))

@app.post("/register-user")
async def register_user(req: RegisterUserRequest):
    uid = str(req.id)
    if uid in user_store:
        return {"ok": True, "created": False, "user": user_store[uid]}
    user = {
        "id": uid,
        "name": req.name,
        "meta": req.meta or {},
        "created_at": datetime.utcnow().isoformat(),
    }
    user_store[uid] = user
    history_store[uid] = (req.name, pd.DataFrame(columns=["ID", "TIMESTAMP"]))
    honor_store.setdefault(uid, {"user_id": uid, "title": "눈물 가뭄", "color": "#888888"}) # ensure default honor if not present
    return {"ok": True, "created": True, "user": user}

def exists_api_key(user_id: str) -> bool:
    return user_id in api_key_store and bool(api_key_store.get(user_id))

@app.get("/has-apikey")
async def has_apikey(user_id: str = Query("1")):
    return {"has_api_key": bool(exists_api_key(user_id))}

is_valid_api_key = False

@app.post("/register-apikey")
async def register_apikey(req: ApiKeyRequest):
    import main
    from genai import set_api_key
    main.is_valid_api_key = set_api_key(req.api_key)
    if not is_valid_api_key:
        print("유효하지 않은 API Key")
        raise HTTPException(status_code=400, detail="Invalid API Key")
    api_key_store[str(req.user_id or "1")] = req.api_key
    print("OPENAI_API_KEY 환경변수에 저장됨")
    return {"message": "API Key registered"}

@app.post("/clear-apikey")
async def clear_apikey(user_id: str = Query("1")):
    if exists_api_key(user_id):
        api_key_store.pop(user_id, None)
        return {"message": "API Key cleared"}
    else:
        raise HTTPException(status_code=400, detail="No API Key to clear")

async def cleanup_loop():
    """1시간 이상 된 항목 정리 루프 (백그라운드 태스크)"""
    while True:
        now = time.time()
        to_delete = [k for k, v in data_store.items() if now - v["timestamp"] > 3600]
        for k in to_delete:
            data_store.pop(k, None)
        await asyncio.sleep(3600)

@app.on_event("startup")
async def on_startup():
    if DEBUG_MODE:
        print("DEBUG 모드 활성화: 디버그 전용 로직 실행")
        # 디버그용 데이터 초기화
        app.state.debug_data = {"example": "This is debug mode"}
    else:
        print("DEBUG 모드 비활성화: 일반 로직 실행")
        # 프로덕션용 데이터 초기화
        app.state.debug_data = {"example": "This is production mode"}

    asyncio.create_task(cleanup_loop())

@app.post("/blink-data/")
async def receive_blink_data(data: BlinkSession):
    ts = time.time()
    print("=== blink-data 수신 ===")
    print(f"id: {data.id}")
    print(f"events: {data.events}")
    print(f"startedAt: {data.startedAt}")
    print(f"endedAt: {data.endedAt}")
    print("======================")
    data_store[data.id] = {"payload": data.dict(), "timestamp": ts}
    return {"message": "Data received and processed successfully", "id": data.id, "timestamp": ts}
    
    if not req.api_key or not req.user_id:
        raise HTTPException(status_code=400, detail="api_key and user_id required")
    api_key_store[str(req.user_id)] = req.api_key
    return {"ok": True, "user_id": req.user_id}

@app.post("/get-user-status")
async def get_user_status(user_id: str = Query("1")):
    user = user_store.get(str(user_id))
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    return {"payload": user, "timestamp": datetime.utcnow().isoformat()}

@app.post("/get-user-honor")
async def get_user_honor(user_id: str = Query("1")):
    honor = honor_store.get(str(user_id))
    if not honor:
        honor = {"user_id": str(user_id), "title": "눈물의 여왕", "color": "#FF5000"}
        honor_store[str(user_id)] = honor
    return honor

@app.post("/blink-session")
async def receive_blink_session(data: BlinkSession):
    # 기존 로직 재사용
    return await receive_blink_data(data)

@app.get("/processed-data/{request_id}")
async def send_processed_data(request_id: str):
    try:
        from genai import analyze_tablet_data, generate_report, update_honor
    except openai.OpenAIError as oe:
        print(f"OpenAI error during import: {oe}")
        raise oe
    except Exception as e:
        print(f"Error importing genai functions: {e}")
        analyze_tablet_data = None
        generate_report = None

    saved = data_store.get(request_id)
    if not saved:
        return {"message": "No data found for the given request ID"}

    if is_valid_api_key and analyze_tablet_data and generate_report:
        if history_store.get(request_id) is None:
            history_df = pd.DataFrame(columns=["ID", "TIMESTAMP"])
        else:
            _, history_df = history_store[request_id]

        user_info = user_store.get(request_id, {})
        user_name = user_info.get("name", "Unknown")

        preprocessed_data = pd.concat([history_df, pd.DataFrame({"TIMESTAMP": [time_str.split('.')[0] for time_str in saved['payload']['events']]})])

        report = generate_report(
            preprocessed_data, 
            user_info={
                'user_name': user_name,
                'joined_at': user_info.get('created_at', None),
            }, 
            debug=DEBUG_MODE
        )
        # Honor 업데이트
        honor = update_honor(
            preprocessed_data, report.pop('analyzed', None), user_name, honor_store
        )
        if honor:
            report["honor"] = honor

        # ✅ 이미지 바이트를 base64 문자열로 변환해서 JSON 직렬화 가능하게
        img_bytes = report.get("daily_line_plot")
        if isinstance(img_bytes, (bytes, bytearray)):
            report["daily_line_plot_b64"] = base64.b64encode(img_bytes).decode("ascii")
            del report["daily_line_plot"]

        return report
    else:
        return {"message": "Analysis functions are not available."}

# # ==== [VAD WS] 추가 시작 =========================================
# from fastapi import WebSocket, WebSocketDisconnect
# import numpy as np
# import asyncio
# import json

# # 네가 준 RealTimeSileroVAD가 별도 파일이면 다음처럼 시도:
# try:
#     from .vad import RealTimeSileroVAD, TARGET_SR, BLOCK_SAMPLES
# except Exception:
#     try:
#         from vad import RealTimeSileroVAD, TARGET_SR, BLOCK_SAMPLES
#     except Exception as e:
#         print("VAD import error:", e)
#         RealTimeSileroVAD = None
#         TARGET_SR = 16000
#         BLOCK_SAMPLES = 512

# @app.websocket("/vad-stream")
# async def vad_stream(ws: WebSocket):
#     await ws.accept()
#     if RealTimeSileroVAD is None:
#         await ws.send_json({"type":"error","message":"VAD not available on server"})
#         await ws.close()
#         return

#     # 클라가 보내는 512 float32(리틀엔디안) 프레임을 처리
#     # 이벤트(frame/speech_start/speech_end)는 JSON으로 push
#     loop = asyncio.get_running_loop()
#     ev_q: "queue.Queue[dict]" = queue.Queue()

#     def on_event(event: str, t_s: float, prob: float, chunk: np.ndarray):
#         ev_q.put({"type": event, "t_s": float(t_s), "prob": float(prob)})

#     vad = RealTimeSileroVAD(sample_rate=TARGET_SR, threshold=0.5, min_speech_frames=3, min_silence_frames=6, onnx=True)
#     vad.start(on_event)

#     send_task = asyncio.create_task(_ws_event_sender(ws, ev_q))

#     try:
#         # 첫 메시지가 설정 JSON일 수 있음(선택)
#         try:
#             msg = await ws.receive_text()
#             try:
#                 cfg = json.loads(msg)
#                 if isinstance(cfg, dict) and cfg.get("type") == "config":
#                     th = float(cfg.get("threshold", 0.5))
#                     msf = int(cfg.get("min_speech_frames", 3))
#                     mif = int(cfg.get("min_silence_frames", 6))
#                     # 간단 적용: 인스턴스 재생성 대신 내부 필드 업데이트
#                     vad.threshold = th
#                     vad.min_speech_frames = msf
#                     vad.min_silence_frames = mif
#             except Exception:
#                 # 텍스트지만 config 아님 → 무시
#                 pass
#         except Exception:
#             # 첫 프레임이 바이너리일 수도 있음 → 패스
#             pass

#         # 메인 수신 루프(바이너리 프레임)
#         while True:
#             data = await ws.receive_bytes()
#             # Float32 Little-Endian 가정
#             arr = np.frombuffer(data, dtype=np.float32)
#             if arr.ndim != 1:
#                 continue
#             if len(arr) != BLOCK_SAMPLES:
#                 # 틱사이즈가 다르면 드랍(클라가 512로 보내야 함)
#                 continue
#             vad.put(arr)
#     except WebSocketDisconnect:
#         pass
#     finally:
#         try:
#             vad.stop()
#         except Exception:
#             pass
#         send_task.cancel()
#         with contextlib.suppress(asyncio.CancelledError):
#             await send_task

# async def _ws_event_sender(ws: WebSocket, ev_q: "queue.Queue[dict]"):
#     # 쓰레드 큐 -> WS로 비동기 전송
#     try:
#         while True:
#             ev = await asyncio.to_thread(ev_q.get)
#             await ws.send_json(ev)
#     except asyncio.CancelledError:
#         # 정상 종료 경로
#         return
#     except Exception:
#         # 기타 에러는 조용히 무시(원하면 logging 추가)
#         return
# # ==== [VAD WS] 추가 끝 ===========================================
