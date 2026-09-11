import os
import io
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from backend.audio_engine import AudioEngine

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = FastAPI(
    title="AI Security System API",
    description="FastAPI Backend for YAMNet Audio Classification",
    version="1.0.0"
)

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Audio Engine
audio_engine = AudioEngine()

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "AI Security System Backend is running"}

@app.get("/api/sample-files")
def get_sample_files():
    samples = [
        {
            "id": "explosion",
            "name": "Tiếng Nổ (Explosion MP3)",
            "filename": "dragon-studio-nuclear-explosion-386181.mp3",
            "description": "File mẫu âm thanh nổ hạt nhân / cháy nổ"
        },
        {
            "id": "crying",
            "name": "Tiếng Khóc Lóc (Crying MP3)",
            "filename": "pataponai-hatapon-crying-344088.mp3",
            "description": "File mẫu âm thanh trẻ em/người khóc lóc kêu cứu"
        }
    ]
    return {"samples": samples}

@app.post("/api/predict/sample/{filename}")
def predict_sample_file(filename: str):
    allowed_files = ["dragon-studio-nuclear-explosion-386181.mp3", "pataponai-hatapon-crying-344088.mp3"]
    if filename not in allowed_files:
        raise HTTPException(status_code=404, detail="Sample file not found")
        
    filepath = os.path.join(BASE_DIR, filename)
    result = audio_engine.predict_file(filepath)
    return result

@app.post("/api/predict/upload")
async def predict_uploaded_file(file: UploadFile = File(...)):
    if not file.filename.endswith(('.mp3', '.wav', '.ogg', '.flac', '.m4a')):
        raise HTTPException(status_code=400, detail="Unsupported audio file format")

    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = audio_engine.predict_file(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return result

@app.get("/api/alarm-sound")
def get_alarm_sound():
    alarm_path = os.path.join(BASE_DIR, "assets", "alarm.WAV")
    if os.path.exists(alarm_path):
        return FileResponse(alarm_path, media_type="audio/wav")
    raise HTTPException(status_code=404, detail="Alarm sound file not found")

@app.post("/api/predict/stream-chunk")
async def predict_stream_chunk(file: UploadFile = File(...)):
    content = await file.read()
    result = audio_engine.predict_bytes(content)
    if result.get("error"):
        print(f"[STREAM CHUNK WARNING] {result['error']}")
    return result

@app.websocket("/ws/audio-stream")
async def websocket_audio_stream(websocket: WebSocket):
    await websocket.accept()
    print("[INFO] Client connected to Audio Stream WebSocket")
    try:
        while True:
            data = await websocket.receive_bytes()
            try:
                waveform = np.frombuffer(data, dtype=np.float32)
                if len(waveform) > 100:
                    result = audio_engine.predict_pcm_waveform(waveform)
                else:
                    result = audio_engine.predict_bytes(data)
                await websocket.send_json(result)
            except Exception as ex:
                result = audio_engine.predict_bytes(data)
                await websocket.send_json(result)
    except WebSocketDisconnect:
        print("[INFO] Client disconnected from Audio Stream WebSocket")
    except Exception as e:
        print(f"[ERROR] WebSocket error: {e}")
