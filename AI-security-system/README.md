# Hướng Dẫn Test Nhanh Dự Án AI Security System

Dự án đã chuẩn bị sẵn 2 file âm thanh mẫu (.mp3) và script test nhận diện âm thanh nguy hiểm bằng AI (mô hình Google YAMNet).

---

## Bước 1: Mở Terminal tại thư mục AI-security-system

```powershell
cd AI-security-system
```

---

## Bước 2: Chạy Test Với 2 File MP3 Có Sẵn

### 1. Test File 1: Tiếng nổ (dragon-studio-nuclear-explosion-386181.mp3)

Chạy lệnh trong Terminal:
```powershell
.\venv\Scripts\python yamnet_audio_classification/test_file.py dragon-studio-nuclear-explosion-386181.mp3
```

* **Kết quả kỳ vọng:** 
  * AI nhận diện `Explosion` (Tiếng nổ) đạt độ tin cậy **> 83%**.
  * Hiển thị: `[ALERT] DANGER DETECTED!`
  * Loa máy tính tự động hú còi báo động `alarm.WAV`.

---

### 2. Test File 2: Tiếng khóc (pataponai-hatapon-crying-344088.mp3)

Chạy lệnh trong Terminal:
```powershell
.\venv\Scripts\python yamnet_audio_classification/test_file.py pataponai-hatapon-crying-344088.mp3
```

* **Kết quả kỳ vọng:** 
  * AI nhận diện `Crying, sobbing` (Tiếng khóc lóc) đạt độ tin cậy **> 99%**.
  * Hiển thị: `[ALERT] DANGER DETECTED!`
  * Loa máy tính tự động hú còi báo động `alarm.WAV`.

---

## Chạy Nhận Diện Realtime (Tùy Chọn)

* **Nhận diện âm thanh Realtime qua Microphone:**
  ```powershell
  .\venv\Scripts\python yamnet_audio_classification/audio_detect.py
  ```

* **Nhận diện vũ khí (Súng/Dao) qua Webcam:**
  ```powershell
  .\venv\Scripts\python yolov8_image_classification/image_detect.py
  ```
