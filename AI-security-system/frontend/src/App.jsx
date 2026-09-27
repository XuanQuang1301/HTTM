import React, { useState, useEffect, useRef } from 'react';
import alarmSound from './assets/alarm.wav';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'admin'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [loading, setLoading] = useState(false);
  const [saveToast, setSaveToast] = useState('');
  
  // Admin Configuration State
  const [adminSettings, setAdminSettings] = useState({
    categories: [
      {
        id: "01_Scream_Cry",
        name: "Tiếng La Hét / Kêu Cứu (Scream / Cry)",
        description: "Bao gồm tiếng khóc lóc, kêu cứu, la hét khẩn cấp",
        enabled: true,
        keywords: ["crying", "sobbing", "screaming", "scream", "shout", "yell", "wail", "groan"]
      },
      {
        id: "02_Explosion_Gunshot",
        name: "Tiếng Nổ / Tiếng Súng (Explosion / Gunshot)",
        description: "Bao gồm tiếng nổ bình gas, chập điện, pháo nổ, tiếng súng",
        enabled: true,
        keywords: ["explosion", "boom", "bang", "burst", "fireworks", "artillery", "gunshot", "gunfire", "cap gun"]
      },
      {
        id: "03_Glass_Breaking",
        name: "Tiếng Vỡ Kính / Đập Phá (Glass Breaking)",
        description: "Bao gồm tiếng kính vỡ, đột nhập đập phá cửa",
        enabled: true,
        keywords: ["glass", "shatter", "breaking glass", "glass breaking"]
      },
      {
        id: "04_Fire_Alarm_Siren",
        name: "Còi Báo Cháy / Còi Báo Động (Fire Alarm / Siren)",
        description: "Bao gồm tiếng còi báo cháy, chuông cảnh báo sự cố",
        enabled: true,
        keywords: ["alarm", "siren", "fire alarm", "smoke detector"]
      },
      {
        id: "05_Impact_Crash",
        name: "Tiếng Va Đập / Tai Nạn (Impact / Crash)",
        description: "Bao gồm tiếng va quẹt xe, ngã đổ vật nặng, va chạm kết cấu",
        enabled: true,
        keywords: ["impact", "crash", "thump", "thud", "collision", "smash"]
      }
    ],
    threshold: 0.25,
    alarm_sound_enabled: true,
    email_alert_enabled: true
  });

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
  const sampleAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const synthOscRef = useRef(null);
  const synthGainRef = useRef(null);

  // Mic Realtime Stream State
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef(null);

  // Alert Logs
  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), event: 'Hệ thống an ninh đã sẵn sàng', type: 'info' }
  ]);

  // Global Audio Unlocker for modern browser Autoplay Policy
  const unlockAudio = () => {
    if (alarmAudioRef.current) {
      const audio = alarmAudioRef.current;
      const originalVolume = audio.volume;
      audio.volume = 0.01;
      const promise = audio.play();
      if (promise !== undefined) {
        promise.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume || 1.0;
        }).catch((err) => {
          console.warn("[AUDIO] Unlock attempt:", err);
          audio.volume = originalVolume || 1.0;
        });
      }
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    const handleGesture = () => {
      unlockAudio();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('pointerdown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('pointerdown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('pointerdown', handleGesture);
    };
  }, []);

  // Web Audio API Synthesizer Emergency Siren Fallback
  const startSirenSynth = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (synthOscRef.current) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      for (let i = 0; i < 100; i++) {
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 440, now + i * 0.3);
      }
      gain.gain.setValueAtTime(0.3, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      synthOscRef.current = osc;
      synthGainRef.current = gain;
    } catch (err) {
      console.error("[AUDIO] Siren synth error:", err);
    }
  };

  const stopSirenSynth = () => {
    if (synthOscRef.current) {
      try {
        synthOscRef.current.stop();
        synthOscRef.current.disconnect();
      } catch (e) {}
      synthOscRef.current = null;
      synthGainRef.current = null;
    }
  };

  const playAlarmSound = () => {
    if (alarmMuted || !adminSettings.alarm_sound_enabled) return;
    if (alarmAudioRef.current) {
      alarmAudioRef.current.currentTime = 0;
      alarmAudioRef.current.play().then(() => {
        console.log("[AUDIO] Alarm sound playing successfully");
      }).catch((err) => {
        console.warn("[AUDIO] HTML5 audio blocked or failed, starting Web Audio siren fallback:", err);
        startSirenSynth();
      });
    } else {
      startSirenSynth();
    }
  };

  const stopAlarmSound = () => {
    if (alarmAudioRef.current) {
      try { alarmAudioRef.current.pause(); } catch (e) {}
    }
    stopSirenSynth();
  };

  // Check Backend Health & Fetch Admin Settings
  useEffect(() => {
    checkHealth();
    fetchAdminSettings();
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

  const fetchAdminSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setAdminSettings(data);
      }
    } catch (err) {
      console.warn("Lỗi đọc cấu hình từ Backend:", err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminSettings)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setAdminSettings(data.settings);
        }
        setSaveToast('Đã lưu cấu hình phân loại nhãn âm thanh thành công!');
        addLog('[ADMIN] Đã lưu và cập nhật cấu hình nhãn nguy hiểm thành công', 'info');
        setTimeout(() => setSaveToast(''), 3500);
      } else {
        alert('Lỗi lưu cấu hình!');
      }
    } catch (err) {
      alert(`Không thể lưu cấu hình: ${err.message}`);
    }
  };

  const handleToggleCategory = (catId) => {
    setAdminSettings(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === catId ? { ...cat, enabled: !cat.enabled } : cat
      )
    }));
  };

  // Play / Stop Alarm Sound
  useEffect(() => {
    if (isDanger && !alarmMuted) {
      playAlarmSound();
    } else {
      stopAlarmSound();
    }
  }, [isDanger, alarmMuted, adminSettings.alarm_sound_enabled]);

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
    stopAlarmSound();
    if (sampleAudioRef.current) {
      try { sampleAudioRef.current.pause(); } catch (e) {}
    }
    addLog('[STOP] Đã dừng và tắt còi cảnh báo', 'info');
  };

  // Test Alarm Sound Button
  const handleTestAlarmSound = () => {
    unlockAudio();
    playAlarmSound();
    addLog('[TEST] Đang phát thử âm thanh còi báo động (3 giây)...', 'info');
    setTimeout(() => {
      if (!isDanger) {
        stopAlarmSound();
      }
    }, 3000);
  };

  // 1. Test Sample Audio File
  const handleTestSample = async (filename, sampleName) => {
    unlockAudio();
    setLoading(true);

    if (sampleAudioRef.current) {
      sampleAudioRef.current.src = `${API_BASE_URL}/api/sample-files/${filename}`;
      sampleAudioRef.current.currentTime = 0;
      sampleAudioRef.current.play().catch(e => console.warn("Sample audio play blocked:", e));
    }

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

    unlockAudio();
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

  // Helper PCM Audio Encoder
  function encodeWAV(samples, sampleRate = 16000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + samples.length * 2, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // 'data'
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

  // 3. Microphone Realtime Listening Handler
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
      if (!res.ok) return;
      const data = await res.json();
      if (data.top5 && data.top5.length > 0) {
        setPredictions(data.top5);
        if (data.is_danger) {
          setIsDanger(true);
          setDangerEvent(data.event);
          setDangerConfidence(data.confidence);
          addLog(`[ALERT-MIC] CẢNH BÁO NGUY HIỂM: ${data.event} (${data.confidence}%)`, 'danger');

          if (alarmAudioRef.current && !alarmMuted && adminSettings.alarm_sound_enabled) {
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

        if (sampleBuffer.length >= audioContext.sampleRate * 0.75) {
          const rawPCM = new Float32Array(sampleBuffer);
          sampleBuffer = [];

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

  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, []);

  const getProgressColor = (confidence, label) => {
    const activeKws = [];
    adminSettings.categories.forEach(c => {
      if (c.enabled) activeKws.push(...c.keywords);
    });

    const isSuspicious = activeKws.some(kw => label.toLowerCase().includes(kw));

    if (isSuspicious && (confidence / 100) >= adminSettings.threshold) {
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

  const activeCategoryCount = adminSettings.categories.filter(c => c.enabled).length;

  return (
    <div style={{ padding: '20px', maxWidth: '1380px', margin: '0 auto' }}>
      {/* Alarm & Sample Audio Elements */}
      <audio ref={alarmAudioRef} src={alarmSound} preload="auto" loop />
      <audio ref={sampleAudioRef} preload="auto" />

      {/* HEADER BAR */}
      <header className="clean-card" style={{ padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Hệ Thống An Ninh Phát Hiện Âm Thanh AI</h1>
          <p style={{ fontSize: '12px', color: '#64748b' }}>Phân loại âm thanh thời gian thực với Google YAMNet AI</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isDanger && (
            <button onClick={handleStopAlert} className="btn-stop-alert">
              <span>Dừng Cảnh Báo</span>
            </button>
          )}

          <button onClick={handleTestAlarmSound} className="btn-compact btn-outline" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }} title="Phát thử còi báo động 3s">
            <span>Thử Còi Báo</span>
          </button>

          <button onClick={() => setAlarmMuted(!alarmMuted)} className="btn-compact btn-outline">
            <span>{alarmMuted ? 'Còi: Tắt' : 'Còi: Bật'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', background: '#f1f5f9', padding: '5px 10px', borderRadius: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: backendStatus === 'online' ? '#16a34a' : '#dc2626' }}></span>
            <span>{backendStatus === 'online' ? 'Backend OK' : 'Backend Disconnected'}</span>
          </div>
        </div>
      </header>


      {/* NAVIGATION TABS */}
      <nav className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard Giám Sát Realtime
        </button>
        <button 
          className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('admin');
            fetchAdminSettings();
          }}
        >
          Trang Quản Trị Nhãn Cảnh Báo
          <span className="badge badge-muted" style={{ marginLeft: '4px' }}>
            {activeCategoryCount}/5 Nhãn
          </span>
        </button>
      </nav>

      {/* SAVE TOAST NOTIFICATION */}
      {saveToast && (
        <div style={{ padding: '12px 18px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', color: '#15803d', fontSize: '13px', fontWeight: '500', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{saveToast}</span>
          <button onClick={() => setSaveToast('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', fontWeight: '700' }}>✕</button>
        </div>
      )}

      {/* TAB 1: DASHBOARD MONITORING VIEW */}
      {activeTab === 'dashboard' && (
        <>
          {/* ALERT BANNER */}
          {isDanger && (
            <div className="alert-banner-light" style={{ padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>
                  [CẢNH BÁO NGUY HIỂM] PHÁT HIỆN: {dangerEvent} ({dangerConfidence}%)
                </span>
                <p style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '1px' }}>
                  Âm thanh thuộc nhóm nhãn nguy hiểm vượt quá ngưỡng an toàn ({Math.round(adminSettings.threshold * 100)}%).
                </p>
              </div>

              <button onClick={handleStopAlert} className="btn-stop-alert">
                Dừng Cảnh Báo Ngay
              </button>
            </div>
          )}

          {/* 3-COLUMN LAYOUT */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'start' }}>
            
            {/* COLUMN 1: CONTROLS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

              <div className="clean-card" style={{ padding: '18px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600' }}>2. Test Với File MP3 Mẫu</h3>
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

            {/* COLUMN 2: TOP 5 PREDICTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="clean-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Top 5 Dự Đoán AI (YAMNet)</h3>
                  {(loading || isListening) && (
                    <span style={{ fontSize: '12px', color: isListening ? '#16a34a' : '#2563eb' }}>
                      {isListening ? 'Đang nghe Mic...' : 'Đang xử lý...'}
                    </span>
                  )}
                </div>

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

                <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                  <span>Trạng thái hệ thống:</span>
                  <span style={{ fontWeight: '600', color: isDanger ? '#dc2626' : '#16a34a' }}>
                    {isDanger ? `Nguy hiểm (${dangerEvent})` : 'An toàn'}
                  </span>
                </div>
              </div>
            </div>

            {/* COLUMN 3: EVENT LOGS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="clean-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '450px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Nhật Ký Sự Kiện & Phản Hồi</h3>
                  <button onClick={handleClearLogs} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                    Xóa nhật ký
                  </button>
                </div>

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
        </>
      )}

      {/* TAB 2: ADMIN CONFIGURATION VIEW (SINGLE-SCREEN COMPACT GRID) */}
      {activeTab === 'admin' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
          
          {/* LEFT COLUMN: 5 DANGER LABEL CATEGORIES */}
          <div className="clean-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Danh Mục Nhãn Báo Động Nguy Hiểm</h3>
                <p style={{ fontSize: '11px', color: '#64748b' }}>Bật/tắt nhãn âm thanh hệ thống sẽ phát hiện là nguy hiểm</p>
              </div>
              <span className="badge badge-success" style={{ fontSize: '11px', padding: '3px 8px' }}>
                Đang bật {activeCategoryCount}/5
              </span>
            </div>

            {/* 5 COMPACT CATEGORY ROWS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {adminSettings.categories.map((cat) => (
                <div 
                  key={cat.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justify: 'space-between', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid',
                    borderColor: cat.enabled ? '#bfdbfe' : '#e2e8f0',
                    background: cat.enabled ? '#eff6ff' : '#f8fafc',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '600', fontSize: '13px', color: cat.enabled ? '#1e3a8a' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cat.name}
                      </span>
                      <span className={`badge ${cat.enabled ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {cat.enabled ? 'Bật' : 'Tắt'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                      {cat.description}
                    </p>
                  </div>

                  {/* TOGGLE SWITCH */}
                  <label className="switch" style={{ transform: 'scale(0.85)' }}>
                    <input 
                      type="checkbox" 
                      checked={cat.enabled} 
                      onChange={() => handleToggleCategory(cat.id)} 
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: THRESHOLD & ALERT OPTIONS & SAVE BAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* CARD 1: THRESHOLD SLIDER & PRESETS */}
            <div className="clean-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>Ngưỡng Độ Tin Cậy Nhận Diện</h3>
                  <p style={{ fontSize: '11px', color: '#64748b' }}>Mô hình kích hoạt báo động khi xác suất lớn hơn hoặc bằng ngưỡng</p>
                </div>
                <span className="font-mono" style={{ fontSize: '18px', fontWeight: '700', color: '#2563eb' }}>
                  {Math.round(adminSettings.threshold * 100)}%
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                <input 
                  type="range" 
                  min="0.10" 
                  max="0.80" 
                  step="0.05"
                  value={adminSettings.threshold}
                  onChange={(e) => setAdminSettings(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
                  style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer', height: '5px' }}
                />
              </div>

              {/* QUICK PRESET BUTTONS */}
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                {[
                  { label: 'Nhạy cao (10%)', val: 0.10 },
                  { label: 'Mặc định (25%)', val: 0.25 },
                  { label: 'Cân bằng (50%)', val: 0.50 },
                  { label: 'Khắt khe (80%)', val: 0.80 }
                ].map((preset) => (
                  <button 
                    key={preset.val}
                    onClick={() => setAdminSettings(prev => ({ ...prev, threshold: preset.val }))}
                    className="btn-compact btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px', background: adminSettings.threshold === preset.val ? '#dbeafe' : '#ffffff', borderColor: adminSettings.threshold === preset.val ? '#3b82f6' : '#cbd5e1', color: adminSettings.threshold === preset.val ? '#1d4ed8' : '#475569' }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CARD 2: ALERT ACTIONS TOGGLES */}
            <div className="clean-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Hình Thức Phản Ứng Báo Động
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Còi Hú Báo Động Tại Chỗ</span>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Phát âm thanh còi hú qua loa máy tính</p>
                  </div>
                  <label className="switch" style={{ transform: 'scale(0.85)' }}>
                    <input 
                      type="checkbox" 
                      checked={adminSettings.alarm_sound_enabled} 
                      onChange={(e) => setAdminSettings(prev => ({ ...prev, alarm_sound_enabled: e.target.checked }))} 
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Gửi Email / Notification</span>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Gửi cảnh báo khẩn tới quản trị viên</p>
                  </div>
                  <label className="switch" style={{ transform: 'scale(0.85)' }}>
                    <input 
                      type="checkbox" 
                      checked={adminSettings.email_alert_enabled} 
                      onChange={(e) => setAdminSettings(prev => ({ ...prev, email_alert_enabled: e.target.checked }))} 
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* CARD 3: ACTION BUTTONS */}
            <div className="clean-card" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <button 
                onClick={fetchAdminSettings} 
                className="btn-compact btn-outline" 
                style={{ fontSize: '12px', padding: '8px 14px' }}
              >
                Khôi Phục Ban Đầu
              </button>

              <button 
                onClick={handleSaveSettings} 
                className="btn-compact btn-primary" 
                style={{ fontSize: '13px', fontWeight: '600', padding: '8px 20px' }}
              >
                Lưu Cấu Hình Admin
              </button>
            </div>

          </div>

        </div>
      )}


    </div>
  );
}

