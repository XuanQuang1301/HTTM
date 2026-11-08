import React, { useState, useEffect, useRef } from 'react';
import alarmSound from './assets/alarm.wav';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'admin'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [saveToast, setSaveToast] = useState('');
  
  // Admin Configuration State
  const [adminSettings, setAdminSettings] = useState({
    categories: [
      {
        id: "01_Scream_Cry",
        name: "Scream / Cry for help",
        vietnamese: "Tiếng la hét, tiếng người kêu cứu, bạo lực",
        action: "Kích hoạt còi hú tại chỗ, gửi cảnh báo SOS",
        priority: "Khẩn cấp",
        is_danger: true,
        enabled: true
      },
      {
        id: "02_Explosion_Gunshot",
        name: "Explosion / Gunshot",
        vietnamese: "Tiếng nổ bình gas, nổ chập điện, tiếng súng",
        action: "Rung chuông toàn hệ thống, cảnh báo cấp cao nhất",
        priority: "Tối khẩn",
        is_danger: true,
        enabled: true
      },
      {
        id: "03_Glass_Breaking",
        name: "Glass Breaking",
        vietnamese: "Tiếng đập phá, vỡ kính đột nhập",
        action: "Còi cảnh báo tại điểm, báo nghi vấn xâm nhập",
        priority: "Cao",
        is_danger: true,
        enabled: true
      },
      {
        id: "04_Fire_Alarm_Siren",
        name: "Fire Alarm / Siren",
        vietnamese: "Còi báo cháy, chuông cảnh báo sự cố",
        action: "Gửi thông báo sơ tán, cảnh báo cháy",
        priority: "Khẩn cấp",
        is_danger: true,
        enabled: true
      },
      {
        id: "05_Impact_Crash",
        name: "Impact / Crash",
        vietnamese: "Va quẹt xe, ngã đổ vật nặng, va chạm",
        action: "Yêu cầu bảo vệ kiểm tra, lưu trích đoạn âm thanh",
        priority: "Trung bình",
        is_danger: true,
        enabled: true
      },
      {
        id: "06_Normal_Background",
        name: "Normal Background",
        vietnamese: "Tiếng nói chuyện, sinh hoạt, mưa rơi, giao thông",
        action: "Hệ thống bình thường, bỏ qua báo động giả",
        priority: "Bình thường",
        is_danger: false,
        enabled: true
      }
    ],
    threshold: 0.50,
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
  const lastAlertTimeRef = useRef(0);
  const lastAlertEventRef = useRef(null);

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
  const isStartingMicRef = useRef(false);
  const isListeningRef = useRef(false);

  const stopMicrophone = () => {
    isListeningRef.current = false;
    setIsListening(false);

    if (audioProcessorRef.current) {
      try {
        audioProcessorRef.current.onaudioprocess = null;
        audioProcessorRef.current.disconnect();
      } catch (e) {}
      audioProcessorRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach(t => {
          t.stop();
          t.enabled = false;
        });
      } catch (e) {}
      micStreamRef.current = null;
    }
  };

  const sendMicChunkToBackend = async (blob) => {
    if (!isListeningRef.current) return;

    const formData = new FormData();
    formData.append('file', blob, 'mic_chunk.wav');

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict/stream-chunk`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) return;
      if (!isListeningRef.current) return;

      const data = await res.json();
      if (!isListeningRef.current) return;

      if (data.top5 && data.top5.length > 0) {
        setPredictions(data.top5);
        if (data.is_danger) {
          setIsDanger(true);
          setDangerEvent(data.event);
          setDangerConfidence(data.confidence);

          // Chỉ ghi log cảnh báo khi sự kiện mới hoặc cách lần ghi log trước ít nhất 3 giây (tránh spam)
          const now = Date.now();
          if (!lastAlertTimeRef.current || (now - lastAlertTimeRef.current > 3000) || lastAlertEventRef.current !== data.event) {
            lastAlertTimeRef.current = now;
            lastAlertEventRef.current = data.event;
            addLog(`[ALERT-MIC] CẢNH BÁO NGUY HIỂM: ${data.event} (${data.confidence}%)`, 'danger');
          }

          if (alarmAudioRef.current && !alarmMuted && adminSettings.alarm_sound_enabled) {
            alarmAudioRef.current.play().catch(e => console.error("Audio play blocked:", e));
          }
        }
        // Lưu ý: Không tự động setIsDanger(false). Chuông sẽ tiếp tục kêu và banner cảnh báo giữ nguyên
        // cho đến khi người dùng bấm nút "Dừng Cảnh Báo Ngay".
      }
    } catch (err) {
      console.error("Mic predict error:", err);
    }
  };

  const startMicrophone = async (isAuto = false) => {
    // Khóa tránh gọi nhiều stream microphone đồng thời (race condition)
    if (isStartingMicRef.current || micStreamRef.current) return;
    isStartingMicRef.current = true;

    if (alarmAudioRef.current) {
      alarmAudioRef.current.play().then(() => {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
      }).catch(() => {});
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Nếu người dùng đã chủ động tắt mic trong lúc chờ xin quyền getUserMedia
      if (isAuto && localStorage.getItem('mic_auto_listen') === 'false') {
        stream.getTracks().forEach(t => {
          t.stop();
          t.enabled = false;
        });
        return;
      }

      // Đảm bảo stream cũ đã dừng triệt để nếu còn sót
      if (micStreamRef.current) {
        try {
          micStreamRef.current.getTracks().forEach(t => {
            t.stop();
            t.enabled = false;
          });
        } catch (e) {}
      }

      micStreamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      audioProcessorRef.current = processor;

      let sampleBuffer = [];

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return;

        const inputChannel = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputChannel.length; i++) {
          sampleBuffer.push(inputChannel[i]);
        }

        // Tích lũy 1.0 giây âm thanh để AI nhận diện chuẩn xác nhất (thay vì 0.75s)
        if (sampleBuffer.length >= audioContext.sampleRate * 1.0) {
          const rawPCM = new Float32Array(sampleBuffer);
          sampleBuffer = [];

          if (!isListeningRef.current) return;

          // Tính năng lượng âm thanh RMS
          let sumSquares = 0;
          for (let i = 0; i < rawPCM.length; i++) {
            sumSquares += rawPCM[i] * rawPCM[i];
          }
          const rms = Math.sqrt(sumSquares / rawPCM.length);

          // Nếu tiếng ồn quá nhỏ (yên tĩnh, gõ phím rất nhẹ) -> Bỏ qua không kích hoạt thêm báo động mới
          if (rms < 0.008) {
            setPredictions([
              { label: 'Normal Background', confidence: 98.5 },
              { label: 'Scream / Cry for help', confidence: 0.5 },
              { label: 'Impact / Crash', confidence: 0.4 },
              { label: 'Glass Breaking', confidence: 0.3 },
              { label: 'Fire Alarm / Siren', confidence: 0.3 }
            ]);
            return;
          }

          const pcm16k = resampleBuffer(rawPCM, audioContext.sampleRate, 16000);
          const wavBlob = encodeWAV(pcm16k, 16000);

          sendMicChunkToBackend(wavBlob);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      isListeningRef.current = true;
      setIsListening(true);
      if (isAuto) {
        addLog('[MIC] Đã tự động kích hoạt Microphone thời gian thực (WAV PCM 16kHz)', 'safe');
      } else {
        addLog('[MIC] Đã bật Microphone - Đang lắng nghe thời gian thực (WAV PCM 16kHz)...', 'safe');
      }

    } catch (err) {
      isListeningRef.current = false;
      setIsListening(false);
      if (!isAuto) {
        alert(`Không thể truy cập Microphone: ${err.message}. Hãy cấp quyền micro trên trình duyệt!`);
      } else {
        console.warn('[MIC] Tự động bật mic đang chờ cấp quyền hoặc tương tác:', err.message);
      }
    } finally {
      isStartingMicRef.current = false;
    }
  };

  const toggleMicrophone = async () => {
    if (isListening || micStreamRef.current) {
      localStorage.setItem('mic_auto_listen', 'false');
      stopMicrophone();
      addLog('[MIC] Đã tắt Microphone nhận diện', 'info');
    } else {
      localStorage.setItem('mic_auto_listen', 'true');
      await startMicrophone(false);
    }
  };

  useEffect(() => {
    // Tự động bật mic khi load/reload trang nếu người dùng chưa chủ động tắt
    const shouldAutoStart = localStorage.getItem('mic_auto_listen') !== 'false';
    if (shouldAutoStart) {
      startMicrophone(true);
    }

    const handleFirstInteraction = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      stopMicrophone();
    };
  }, []);

  const getProgressColor = (confidence, label) => {
    const matchedCat = adminSettings.categories.find(c => c.name === label || c.id === label);
    const isDangerCat = matchedCat ? (matchedCat.is_danger && matchedCat.enabled) : (label !== 'Normal Background');

    if (isDangerCat && (confidence / 100) >= adminSettings.threshold) {
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
            {activeCategoryCount}/{adminSettings.categories.length} Nhãn
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
                    Thu Âm Qua Microphone
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

            </div>

            {/* COLUMN 2: TOP 5 PREDICTIONS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="clean-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Top 5 Dự Đoán AI (YAMNet)</h3>
                  {isListening && (
                    <span style={{ fontSize: '12px', color: '#16a34a' }}>
                      Đang nghe Mic...
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
                Đang bật {activeCategoryCount}/{adminSettings.categories.length} Nhãn
              </span>
            </div>

            {/* 6 COMPACT CATEGORY ROWS */}
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
                    borderColor: cat.enabled ? (cat.is_danger ? '#bfdbfe' : '#bbf7d0') : '#e2e8f0',
                    background: cat.enabled ? (cat.is_danger ? '#eff6ff' : '#f0fdf4') : '#f8fafc',
                    gap: '10px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', fontSize: '13px', color: cat.enabled ? '#1e3a8a' : '#334155' }}>
                        {cat.name}
                      </span>
                      {cat.priority && (
                        <span 
                          style={{ 
                            fontSize: '10px', 
                            padding: '1px 6px', 
                            borderRadius: '4px',
                            fontWeight: '600',
                            background: cat.priority === 'Tối khẩn' ? '#fee2e2' : cat.priority === 'Khẩn cấp' ? '#ffedd5' : cat.priority === 'Cao' ? '#fef3c7' : cat.priority === 'Trung bình' ? '#e0f2fe' : '#f1f5f9',
                            color: cat.priority === 'Tối khẩn' ? '#dc2626' : cat.priority === 'Khẩn cấp' ? '#ea580c' : cat.priority === 'Cao' ? '#d97706' : cat.priority === 'Trung bình' ? '#0284c7' : '#64748b'
                          }}
                        >
                          {cat.priority}
                        </span>
                      )}
                      <span className={`badge ${cat.enabled ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                        {cat.enabled ? 'Bật' : 'Tắt'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#475569', marginTop: '2px', lineHeight: '1.3' }}>
                      {cat.vietnamese || cat.description}
                    </p>
                    {cat.action && (
                      <p style={{ fontSize: '11px', color: '#0369a1', marginTop: '1px', fontStyle: 'italic' }}>
                        ↳ Phản ứng: {cat.action}
                      </p>
                    )}
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

