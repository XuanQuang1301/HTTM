import os
import csv
import io
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
import soundfile as sf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YAMNET_MODEL_DIR = os.path.join(BASE_DIR, 'yamnet_audio_classification', 'yamnet_model')

class AudioEngine:
    def __init__(self):
        print("[INFO] Loading YAMNet Feature Extractor...")
        self.model = hub.load(YAMNET_MODEL_DIR)

        # 6 Target English Labels & Action/Priority specs
        # 0: Scream / Cry for help
        # 1: Explosion / Gunshot
        # 2: Glass Breaking
        # 3: Fire Alarm / Siren
        # 4: Impact / Crash
        # 5: Normal Background
        self.categories = [
            {
                "id": "01_Scream_Cry",
                "name": "Scream / Cry for help",
                "vietnamese": "Tiếng la hét, tiếng người kêu cứu, bạo lực",
                "action": "Kích hoạt còi hú tại chỗ, gửi cảnh báo SOS",
                "priority": "Khẩn cấp",
                "is_danger": True,
                "enabled": True
            },
            {
                "id": "02_Explosion_Gunshot",
                "name": "Explosion / Gunshot",
                "vietnamese": "Tiếng nổ bình gas, nổ chập điện, tiếng súng",
                "action": "Rung chuông toàn hệ thống, cảnh báo cấp cao nhất",
                "priority": "Tối khẩn",
                "is_danger": True,
                "enabled": True
            },
            {
                "id": "03_Glass_Breaking",
                "name": "Glass Breaking",
                "vietnamese": "Tiếng đập phá, vỡ kính đột nhập",
                "action": "Còi cảnh báo tại điểm, báo nghi vấn xâm nhập",
                "priority": "Cao",
                "is_danger": True,
                "enabled": True
            },
            {
                "id": "04_Fire_Alarm_Siren",
                "name": "Fire Alarm / Siren",
                "vietnamese": "Còi báo cháy, chuông cảnh báo sự cố",
                "action": "Gửi thông báo sơ tán, cảnh báo cháy",
                "priority": "Khẩn cấp",
                "is_danger": True,
                "enabled": True
            },
            {
                "id": "05_Impact_Crash",
                "name": "Impact / Crash",
                "vietnamese": "Va quẹt xe, ngã đổ vật nặng, va chạm",
                "action": "Yêu cầu bảo vệ kiểm tra, lưu trích đoạn âm thanh",
                "priority": "Trung bình",
                "is_danger": True,
                "enabled": True
            },
            {
                "id": "06_Normal_Background",
                "name": "Normal Background",
                "vietnamese": "Tiếng nói chuyện, sinh hoạt, mưa rơi, giao thông",
                "action": "Hệ thống bình thường, bỏ qua báo động giả",
                "priority": "Bình thường",
                "is_danger": False,
                "enabled": True
            }
        ]

        self.threshold = 0.50  # Ngưỡng kích hoạt an toàn mặc định 50% (tránh báo động giả từ tạp âm)
        self.alarm_sound_enabled = True
        self.email_alert_enabled = True

        # Load Custom Trained 6-Class Model
        # Priority: custom_sound_classifier_02.keras (mới nhất) -> custom_sound_classifier_01.keras -> custom_sound_classifier.keras
        self.custom_model_path = os.path.join(BASE_DIR, 'backend', 'custom_sound_classifier_02.keras')
        if not os.path.exists(self.custom_model_path):
            self.custom_model_path = os.path.join(BASE_DIR, 'custom_sound_classifier_02.keras')
        if not os.path.exists(self.custom_model_path):
            print(f"[WARNING] Chưa tìm thấy '{self.custom_model_path}', tạm thời tìm bản dự phòng (01)...")
            self.custom_model_path = os.path.join(BASE_DIR, 'backend', 'custom_sound_classifier_01.keras')
        if not os.path.exists(self.custom_model_path):
            self.custom_model_path = os.path.join(BASE_DIR, 'custom_sound_classifier_01.keras')
        if not os.path.exists(self.custom_model_path):
            self.custom_model_path = os.path.join(BASE_DIR, 'backend', 'custom_sound_classifier.keras')
        self.custom_classifier = None
        if os.path.exists(self.custom_model_path):
            try:
                print(f"[INFO] Loading Custom 6-Class Classifier from '{self.custom_model_path}'...")
                self.custom_classifier = tf.keras.models.load_model(self.custom_model_path)
                print("[INFO] Successfully loaded Custom 6-Class Classifier!")
            except Exception as e:
                print(f"[ERROR] Không thể load mô hình custom 6 nhãn: {e}")
        else:
            print(f"[WARNING] Không tìm thấy file mô hình custom tại {self.custom_model_path}")

    def get_settings(self):
        return {
            "categories": self.categories,
            "threshold": self.threshold,
            "alarm_sound_enabled": self.alarm_sound_enabled,
            "email_alert_enabled": self.email_alert_enabled
        }

    def update_settings(self, new_settings):
        if "threshold" in new_settings:
            try:
                self.threshold = float(new_settings["threshold"])
            except (ValueError, TypeError):
                pass
        if "alarm_sound_enabled" in new_settings:
            self.alarm_sound_enabled = bool(new_settings["alarm_sound_enabled"])
        if "email_alert_enabled" in new_settings:
            self.email_alert_enabled = bool(new_settings["email_alert_enabled"])
        if "categories" in new_settings and isinstance(new_settings["categories"], list):
            for cat in new_settings["categories"]:
                for existing in self.categories:
                    if existing["id"] == cat.get("id"):
                        existing["enabled"] = bool(cat.get("enabled", True))
        print(f"[CONFIG UPDATED] Active categories: {[c['id'] for c in self.categories if c['enabled']]}, Threshold: {self.threshold}")
        return self.get_settings()

    def load_audio_16k_mono(self, filepath):
        """Loads audio file and converts to 16kHz mono float32 array."""
        data, samplerate = sf.read(filepath, dtype='float32')
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if samplerate != 16000:
            num_target_samples = int(len(data) * 16000 / samplerate)
            data = np.interp(
                np.linspace(0, len(data), num_target_samples),
                np.arange(len(data)),
                data
            ).astype(np.float32)
        return data

    def load_audio_from_bytes(self, audio_bytes):
        """Loads audio from raw bytes (WAV, OGG, FLAC) and converts to 16kHz mono float32 array."""
        data, samplerate = sf.read(io.BytesIO(audio_bytes), dtype='float32')
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if samplerate != 16000:
            num_target_samples = int(len(data) * 16000 / samplerate)
            data = np.interp(
                np.linspace(0, len(data), num_target_samples),
                np.arange(len(data)),
                data
            ).astype(np.float32)
        return data

    def predict_bytes(self, audio_bytes):
        try:
            waveform = self.load_audio_from_bytes(audio_bytes)
            if len(waveform) < 100:
                return {"error": "Audio buffer too short", "top5": [], "is_danger": False}
            return self.predict_pcm_waveform(waveform)
        except Exception as e:
            print(f"[ERROR] AudioEngine.predict_bytes failed: {e}")
            return {"error": str(e), "top5": [], "is_danger": False}

    def predict_file(self, audio_filepath):
        if not os.path.exists(audio_filepath):
            return {"error": f"File '{audio_filepath}' does not exist"}

        waveform = self.load_audio_16k_mono(audio_filepath)
        return self.predict_pcm_waveform(waveform)

    def predict_pcm_waveform(self, waveform_array):
        """Inference on 1D float32 waveform numpy array sampled at 16kHz using Custom 6-Class Model."""
        # 1. Kiểm tra năng lượng âm thanh (RMS - Root Mean Square)
        # Nếu âm thanh quá nhỏ (im lặng, tiếng thở, gõ phím rất nhẹ) -> Gán thẳng là Normal Background
        rms = np.sqrt(np.mean(waveform_array**2)) if len(waveform_array) > 0 else 0.0
        if rms < 0.008:
            all_predictions = []
            for cat in self.categories:
                conf = 98.0 if cat["id"] == "06_Normal_Background" else 0.4
                all_predictions.append({
                    "id": cat["id"],
                    "label": cat["name"],
                    "vietnamese": cat["vietnamese"],
                    "action": cat["action"],
                    "priority": cat["priority"],
                    "is_danger_category": cat["is_danger"],
                    "enabled": cat["enabled"],
                    "confidence": conf
                })
            # Sắp xếp để Normal Background lên đầu
            all_predictions.sort(key=lambda x: x["confidence"], reverse=True)
            return {
                "top5": all_predictions[:5],
                "all_classes": all_predictions,
                "is_danger": False,
                "event": "Normal Background",
                "confidence": 98.0,
                "action": "Hệ thống bình thường, bỏ qua báo động giả",
                "priority": "Bình thường",
                "top_prediction": all_predictions[0]
            }

        # 2. Trích xuất Embeddings qua YAMNet
        scores, embeddings, spectrogram = self.model(waveform_array)

        # 3. Suy luận bằng Custom 6-Class Model
        if self.custom_classifier is not None:
            # embeddings shape: (N_frames, 1024)
            preds = self.custom_classifier.predict(embeddings, verbose=0) # shape: (N_frames, 6)
            # Lấy xác suất trung bình trên các khung thời gian
            avg_probs = np.mean(preds, axis=0) # shape: (6,)

            # Sắp xếp các nhãn theo xác suất giảm dần
            sorted_indices = np.argsort(avg_probs)[::-1]
            all_predictions = []
            for idx in sorted_indices:
                cat = self.categories[idx]
                conf = float(round(avg_probs[idx] * 100, 2))
                all_predictions.append({
                    "id": cat["id"],
                    "label": cat["name"],
                    "vietnamese": cat["vietnamese"],
                    "action": cat["action"],
                    "priority": cat["priority"],
                    "is_danger_category": cat["is_danger"],
                    "enabled": cat["enabled"],
                    "confidence": conf
                })

            top_pred = all_predictions[0]

            # QUY TẮC BÁO ĐỘNG CHUẨN XÁC:
            # - Chỉ báo động khi nhãn XÁC SUẤT CAO NHẤT (Top 1) là nhãn nguy hiểm
            # - Nhãn đó đang được BẬT (enabled == True)
            # - Xác suất Top 1 >= ngưỡng cài đặt (threshold)
            danger_detected = False
            if top_pred["is_danger_category"] and top_pred["enabled"] and (top_pred["confidence"] / 100.0 >= self.threshold):
                danger_detected = True

            return {
                "top5": all_predictions[:5],
                "all_classes": all_predictions,
                "is_danger": danger_detected,
                "event": top_pred["label"] if danger_detected else "Normal Background",
                "confidence": top_pred["confidence"],
                "action": top_pred["action"],
                "priority": top_pred["priority"],
                "top_prediction": top_pred
            }

        # Fallback nếu model custom chưa load được
        return {
            "top5": [],
            "is_danger": False,
            "event": "Custom classifier not loaded",
            "confidence": 0.0
        }
