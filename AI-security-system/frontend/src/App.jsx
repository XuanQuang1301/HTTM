import React, { useState, useEffect, useRef } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function App() {
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [loading, setLoading] = useState(false);
  
  // Detection Results State
  const [predictions, setPredictions] = useState([
    { label: 'Silence', confidence: 100.0 },
    { label: 'Ambient Noise', confidence: 0.0 },
    { label: 'Speech', confidence: 0.0 },
    { label: 'Music', confidence: 0.0 },
    { label: 'Other', confidence: 0.0 }
  ]);
  const [isDanger, setIsDanger] = useState(false);
  const [dangerEvent, setDangerEvent] = useState(null);
  const [dangerConfidence, setDangerConfidence] = useState(0.0);
  
  // Alarm Audio & Mute State
  const [alarmMuted, setAlarmMuted] = useState(false);
  const alarmAudioRef = useRef(null);

  // Mic Realtime Stream State
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);
  const micIntervalRef = useRef(null);

  // Alert Logs
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), event: 'Hệ thống an ninh đã sẵn sàng', type: 'info' }
  ]);

  // Check Backend Health
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  // Play / Stop Alarm Sound
  useEffect(() => {
    if (isDanger && !alarmMuted) {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current.play().catch(() => {});
      }
    } else {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
      }
    }
  }, [isDanger, alarmMuted]);

  const addLog = (eventText, type = 'danger') => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setLogs(prev => [
      { id: Date.now(), time: timeStr, event: eventText, type },
      ...prev.slice(0, 19)
    ]);
  };

  // Stop / Reset Alert Button
  const handleStopAlert = () => {
    setIsDanger(false);
    setDangerEvent(null);
    setDangerConfidence(0);
    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
    }
    addLog('[STOP] Đã dừng và tắt còi cảnh báo', 'info');
  };

  // 1. Test Sample Audio File
  const handleTestSample = async (filename, sampleName) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/predict/sample/${filename}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.top5) {
        setPredictions(data.top5);
        setIsDanger(data.is_danger);
        setDangerEvent(data.event);
        setDangerConfidence(data.confidence);

        if (data.is_danger) {
          addLog(`[ALERT] Phát hiện nguy hiểm: ${data.event} (${data.confidence}%)`, 'danger');
        } else {
          addLog(`[SAFE] File ${sampleName} - An toàn`, 'safe');
        }
      }
    } catch (err) {
      addLog(`Lỗi kết nối Backend: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

  // 2. Custom File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.top5) {
        setPredictions(data.top5);
        setIsDanger(data.is_danger);
        setDangerEvent(data.event);
        setDangerConfidence(data.confidence);

        if (data.is_danger) {
          addLog(`[ALERT] Phát hiện nguy hiểm từ file upload: ${data.event} (${data.confidence}%)`, 'danger');
        } else {
          addLog(`[SAFE] File ${file.name} - An toàn`, 'safe');
        }
      }
    } catch (err) {
      addLog(`Lỗi upload file: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  };

// Helper to encode float32 PCM array to 16kHz 16-bit Mono WAV Blob
function encodeWAV(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  view.setUint32(8, 0x57415645, false); // 'WAVE'
  /* format chunk identifier */
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate */
  view.setUint32(28, sampleRate * 2, true);
  /* block align */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  view.setUint32(36, 0x64617461, false); // 'data'
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

function resampleBuffer(inputData, inputSampleRate, targetSampleRate = 16000) {
  if (inputSampleRate === targetSampleRate) return inputData;
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.round(inputData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = Math.round(i * ratio);
    result[i] = inputData[origIndex] || 0;
  }
  return result;
}

  // 3. Microphone Realtime Listening Handler (Web Audio API PCM -> WAV 16kHz)
  const audioContextRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioProcessorRef = useRef(null);

  const stopMicrophone = () => {
    if (audioProcessorRef.current) {
      try { audioProcessorRef.current.disconnect(); } catch (e) {}
      audioProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      try { micStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
      micStreamRef.current = null;
    }
    setIsListening(false);
  };

  const sendMicChunkToBackend = async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'mic_chunk.wav');

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict/stream-chunk`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        console.error("Mic predict error HTTP:", res.status);
        return;
      }
      const data = await res.json();
      if (data.top5 && data.top5.length > 0) {
        setPredictions(data.top5);
        if (data.is_danger) {
          setIsDanger(true);
          setDangerEvent(data.event);
          setDangerConfidence(data.confidence);
          addLog(`[ALERT-MIC] CẢNH BÁO NGUY HIỂM: ${data.event} (${data.confidence}%)`, 'danger');

          // Trigger alarm audio immediately
          if (alarmAudioRef.current && !alarmMuted) {
            alarmAudioRef.current.currentTime = 0;
            alarmAudioRef.current.play().catch(e => console.error("Audio play blocked:", e));
          }
        }
      }
    } catch (err) {
      console.error("Mic predict error:", err);
    }
  };

  const toggleMicrophone = async () => {
    if (isListening) {
      stopMicrophone();
      addLog('[MIC] Đã tắt Microphone nhận diện', 'info');
      return;
    }

    // Pre-unlock audio element playback permissions on user click
    if (alarmAudioRef.current) {
      alarmAudioRef.current.play().then(() => {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
      }).catch(() => {});
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      let sampleBuffer = [];

      processor.onaudioprocess = (e) => {
        const inputChannel = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputChannel.length; i++) {
          sampleBuffer.push(inputChannel[i]);
        }

        // Send a ~0.75s chunk to backend for fast realtime response
        if (sampleBuffer.length >= audioContext.sampleRate * 0.75) {
          const rawPCM = new Float32Array(sampleBuffer);
          sampleBuffer = []; // reset buffer

          const pcm16k = resampleBuffer(rawPCM, audioContext.sampleRate, 16000);
          const wavBlob = encodeWAV(pcm16k, 16000);

          sendMicChunkToBackend(wavBlob);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      addLog('[MIC] Đã bật Microphone - Đang lắng nghe thời gian thực (WAV PCM 16kHz)...', 'safe');

    } catch (err) {
      alert(`Không thể truy cập Microphone: ${err.message}. Hãy cấp quyền micro trên trình duyệt!`);
    }
  };

  // Clean up mic on unmount
  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, []);

  // Progress bar color helper
  const getProgressColor = (confidence, label) => {
    const suspiciousKeywords = [
      "explosion", "boom", "bang", "burst", "fireworks", "artillery", "gunshot", "gunfire", "cap gun", "thump", "thud",
      "crying", "sobbing", "screaming", "scream", "shout", "yell", "wail", "groan",
      "alarm", "siren"
    ];
    const isSuspicious = suspiciousKeywords.some(kw => label.toLowerCase().includes(kw));

    if (isSuspicious && confidence > 25) {
      return '#dc2626'; // Red
    }
    if (confidence > 70) {
      return '#2563eb'; // Blue
    }
    return '#16a34a'; // Green
  };

  const handleClearLogs = () => {
    setLogs([
      { id: Date.now(), time: new Date().toLocaleTimeString(), event: 'Hệ thống an ninh đã sẵn sàng', type: 'info' }
    ]);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1380px', margin: '0 auto' }}>
      {/* Alarm Audio Component */}
      <audio ref={alarmAudioRef} src={`${API_BASE_URL}/api/alarm-sound`} loop />

      {/* HEADER BAR */}
      <header className="clean-card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>AI Security System Dashboard</h1>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Phân loại âm thanh bằng Google YAMNet AI</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* STOP ALERT BUTTON IN HEADER */}
          {isDanger && (
            <button onClick={handleStopAlert} className="btn-stop-alert">
              <span>Dừng Cảnh Báo</span>
            </button>
          )}

          {/* Mute/Unmute Audio */}
          <button onClick={() => setAlarmMuted(!alarmMuted)} className="btn-compact btn-outline">
            <span>{alarmMuted ? 'Còi: Tắt' : 'Còi: Bật'}</span>
          </button>

          {/* Backend Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', background: '#f1f5f9', padding: '5px 10px', borderRadius: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendStatus === 'online' ? '#16a34a' : '#dc2626' }}></span>
            <span>{backendStatus === 'online' ? 'Backend OK' : 'Backend Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* ALERT BANNER (If Danger Detected) */}
      {isDanger && (
        <div className="alert-banner-light" style={{ padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>
              [CẢNH BÁO] NGUY HIỂM: {dangerEvent} ({dangerConfidence}%)
            </span>
            <p style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '1px' }}>
              Phát hiện âm thanh bất thường vượt quá ngưỡng an toàn.
            </p>
          </div>

          {/* Action button inside Banner */}
          <button onClick={handleStopAlert} className="btn-stop-alert">
            Dừng Cảnh Báo Ngay
          </button>
        </div>
      )}

      {/* MAIN CONTENT 3-COLUMN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
        
        {/* COLUMN 1 (LEFT): BỘ CÔNG CỤ (CONTROLS & INPUTS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Card 1: Realtime Microphone Toggle */}
          <div className="clean-card" style={{ padding: '18px', background: isListening ? '#f0fdf4' : '#ffffff', borderColor: isListening ? '#86efac' : '#e2e8f0' }}>
            <div style={{ marginBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', color: isListening ? '#14532d' : '#0f172a' }}>
                1. Thu Âm Qua Microphone
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Bật tính năng này để máy tính tự lắng nghe âm thanh từ môi trường xung quanh (thời gian thực).
            </p>

            <button 
              onClick={toggleMicrophone}
              className={`btn-compact ${isListening ? 'btn-danger' : 'btn-primary'}`}
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            >
              {isListening ? (
                <span>Tắt Microphone (Đang nghe...)</span>
              ) : (
                <span>Bật Microphone Realtime</span>
              )}
            </button>
          </div>

          {/* Card 2: Compact Test Buttons */}
          <div className="clean-card" style={{ padding: '18px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600' }}>2. Test Với File MP3 Có Sẵn</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                disabled={loading}
                onClick={() => handleTestSample('dragon-studio-nuclear-explosion-386181.mp3', 'Tiếng nổ')} 
                className="btn-compact btn-danger"
                style={{ justifyContent: 'space-between' }}
              >
                <span>File 1: Tiếng Nổ (Explosion)</span>
              </button>

              <button 
                disabled={loading}
                onClick={() => handleTestSample('pataponai-hatapon-crying-344088.mp3', 'Tiếng khóc')} 
                className="btn-compact btn-primary"
                style={{ justifyContent: 'space-between' }}
              >
                <span>File 2: Tiếng Khóc (Crying)</span>
              </button>
            </div>
          </div>

          {/* Card 3: Custom File Upload */}
          <div className="clean-card" style={{ padding: '18px' }}>
            <div style={{ marginBottom: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600' }}>3. Upload File Âm Thanh</h3>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '8px', cursor: 'pointer', background: '#f8fafc', fontSize: '13px', color: '#475569' }}>
              <span>Chọn file audio từ máy...</span>
              <input type="file" accept="audio/*" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>

        </div>

        {/* COLUMN 2 (CENTER): DỰ ĐOÁN AI (TOP 5 PREDICTIONS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="clean-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Top 5 Dự Đoán AI (YAMNet)</h3>
              </div>
              {(loading || isListening) && (
                <span style={{ fontSize: '12px', color: isListening ? '#16a34a' : '#2563eb' }}>
                  {isListening ? 'Đang nghe Mic...' : 'Đang xử lý...'}
                </span>
              )}
            </div>

            {/* PREDICTION LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {predictions.map((item, index) => (
                <div key={index}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '500', color: '#1e293b' }}>
                      {index + 1}. {item.label}
                    </span>
                    <span className="font-mono" style={{ fontWeight: '600', color: item.confidence > 50 ? '#2563eb' : '#64748b' }}>
                      {item.confidence.toFixed(2)}%
                    </span>
                  </div>
                  <div className="progress-bg">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${Math.max(item.confidence, 1)}%`,
                        backgroundColor: getProgressColor(item.confidence, item.label)
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* STATUS SUMMARY */}
            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
              <span>Trạng thái phân tích:</span>
              <span style={{ fontWeight: '600', color: isDanger ? '#dc2626' : '#16a34a' }}>
                {isDanger ? `Nguy hiểm (${dangerEvent})` : 'An toàn'}
              </span>
            </div>
          </div>

        </div>

        {/* COLUMN 3 (RIGHT): NHẬT KÝ SỰ KIỆN VÀ PHẢN HỒI (EXPANDED LOGS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="clean-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '450px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Nhật Ký Sự Kiện & Phản Hồi</h3>
              </div>
              <button onClick={handleClearLogs} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                Xóa nhật ký
              </button>
            </div>

            {/* EXPANDED SCROLLABLE LOG LIST */}
            <div style={{ flex: 1, maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {logs.map(log => (
                <div 
                  key={log.id} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '10px 12px', 
                    borderRadius: '8px', 
                    fontSize: '12px', 
                    background: log.type === 'danger' ? '#fef2f2' : log.type === 'safe' ? '#f0fdf4' : '#f8fafc', 
                    borderLeft: log.type === 'danger' ? '4px solid #dc2626' : log.type === 'safe' ? '4px solid #16a34a' : '4px solid #3b82f6',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600', color: log.type === 'danger' ? '#b91c1c' : log.type === 'safe' ? '#15803d' : '#1e40af' }}>
                      {log.type === 'danger' ? 'CẢNH BÁO' : log.type === 'safe' ? 'THÔNG TIN' : 'THÔNG BÁO'}
                    </span>
                    <span className="font-mono" style={{ color: '#94a3b8', fontSize: '11px' }}>{log.time}</span>
                  </div>
                  <span style={{ color: log.type === 'danger' ? '#7f1d1d' : '#334155', lineHeight: '1.4' }}>
                    {log.event}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
