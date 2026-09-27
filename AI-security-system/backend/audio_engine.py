import os
import csv
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
import soundfile as sf

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
YAMNET_MODEL_DIR = os.path.join(BASE_DIR, 'yamnet_audio_classification', 'yamnet_model')

class AudioEngine:
    def __init__(self):
        print("[INFO] Loading YAMNet model for Backend API...")
        self.model = hub.load(YAMNET_MODEL_DIR)
        
        # Load Class Labels
        labels_path = tf.keras.utils.get_file(
            'yamnet_class_map.csv',
            'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv'
        )
        self.class_names = []
        with open(labels_path, newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                self.class_names.append(row['display_name'])
                
        # Danger Categories Configuration
        self.categories = [
            {
                "id": "01_Scream_Cry",
                "name": "Tiếng La Hét / Kêu Cứu (Scream / Cry)",
                "description": "Bao gồm tiếng khóc lóc, kêu cứu, la hét khẩn cấp",
                "enabled": True,
                "keywords": ["crying", "sobbing", "screaming", "scream", "shout", "yell", "wail", "groan"]
            },
            {
                "id": "02_Explosion_Gunshot",
                "name": "Tiếng Nổ / Tiếng Súng (Explosion / Gunshot)",
                "description": "Bao gồm tiếng nổ bình gas, chập điện, pháo nổ, tiếng súng",
                "enabled": True,
                "keywords": ["explosion", "boom", "bang", "burst", "fireworks", "artillery", "gunshot", "gunfire", "cap gun"]
            },
            {
                "id": "03_Glass_Breaking",
                "name": "Tiếng Vỡ Kính / Đập Phá (Glass Breaking)",
                "description": "Bao gồm tiếng kính vỡ, đột nhập đập phá",
                "enabled": True,
                "keywords": ["glass", "shatter", "breaking glass", "glass breaking"]
            },
            {
                "id": "04_Fire_Alarm_Siren",
                "name": "Còi Báo Cháy / Còi Báo Động (Fire Alarm / Siren)",
                "description": "Bao gồm tiếng còi báo cháy, chuông cảnh báo sự cố",
                "enabled": True,
                "keywords": ["alarm", "siren", "fire alarm", "smoke detector"]
            },
            {
                "id": "05_Impact_Crash",
                "name": "Tiếng Va Đập / Tai Nạn (Impact / Crash)",
                "description": "Bao gồm tiếng va quẹt xe, ngã đổ vật nặng, va chạm kết cấu",
                "enabled": True,
                "keywords": ["impact", "crash", "thump", "thud", "collision", "smash"]
            }
        ]
        self.threshold = 0.25 # Ngưỡng mặc định 25%
        self.alarm_sound_enabled = True
        self.email_alert_enabled = True

        # Load Custom Trained Classifier (if available)
        self.custom_model_path = os.path.join(BASE_DIR, 'custom_sound_classifier.keras')
        self.custom_classifier = None
        self.custom_label_names = [
            "Tiếng La Hét / Kêu Cứu (Scream/Cry)",
            "Tiếng Nổ / Tiếng Súng (Explosion/Gunshot)",
            "Tiếng Vỡ Kính / Đập Phá (Glass Breaking)",
            "Còi Báo Cháy / Báo Động (Fire Alarm/Siren)",
            "Tiếng Va Đập / Tai Nạn (Impact/Crash)",
            "Âm Thanh Nền Bình Thường (Normal Background)"
        ]
        self.custom_cat_ids = [
            "01_Scream_Cry",
            "02_Explosion_Gunshot",
            "03_Glass_Breaking",
            "04_Fire_Alarm_Siren",
            "05_Impact_Crash",
            "06_Normal_Background"
        ]
        
        if os.path.exists(self.custom_model_path):
            try:
                print(f"[INFO] Loading Custom Trained Classifier from '{self.custom_model_path}'...")
                self.custom_classifier = tf.keras.models.load_model(self.custom_model_path)
                print("[INFO] Successfully loaded Custom 6-Class Model!")
            except Exception as e:
                print(f"[CẢNH BÁO] Không thể load mô hình custom: {e}")


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

    def get_active_keywords(self):
        active_kws = []
        for cat in self.categories:
            if cat.get("enabled", True):
                active_kws.extend(cat.get("keywords", []))
        return active_kws

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
        import io
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
        scores, embeddings, spectrogram = self.model(waveform)
        
        max_scores = np.max(scores.numpy(), axis=0)
        top5_idx = np.argsort(max_scores)[-5:][::-1]
        
        top5_predictions = []
        for idx in top5_idx:
            top5_predictions.append({
                "label": self.class_names[idx],
                "confidence": float(round(max_scores[idx] * 100, 2))
            })

        # Check for danger events based on active keywords & threshold
        active_keywords = self.get_active_keywords()
        danger_detected = False
        detected_events = []

        for pred in top5_predictions:
            label_lower = pred["label"].lower()
            conf_fraction = pred["confidence"] / 100.0
            for keyword in active_keywords:
                if keyword in label_lower and conf_fraction >= self.threshold:
                    danger_detected = True
                    detected_events.append(pred)

        primary_danger_event = detected_events[0]["label"] if detected_events else None
        primary_confidence = detected_events[0]["confidence"] if detected_events else 0.0

        return {
            "top5": top5_predictions,
            "is_danger": danger_detected,
            "event": primary_danger_event,
            "confidence": primary_confidence,
            "detected_events": detected_events
        }

    def predict_pcm_waveform(self, waveform_array):
        """Inference on 1D float32 waveform numpy array sampled at 16kHz."""
        scores, embeddings, spectrogram = self.model(waveform_array)
        max_scores = np.max(scores.numpy(), axis=0)
        top5_idx = np.argsort(max_scores)[-5:][::-1]
        
        top5_predictions = []
        for idx in top5_idx:
            top5_predictions.append({
                "label": self.class_names[idx],
                "confidence": float(round(max_scores[idx] * 100, 2))
            })

        active_keywords = self.get_active_keywords()
        danger_detected = False
        detected_events = []
        for pred in top5_predictions:
            label_lower = pred["label"].lower()
            conf_fraction = pred["confidence"] / 100.0
            for keyword in active_keywords:
                if keyword in label_lower and conf_fraction >= self.threshold:
                    danger_detected = True
                    detected_events.append(pred)

        primary_danger_event = detected_events[0]["label"] if detected_events else None
        primary_confidence = detected_events[0]["confidence"] if detected_events else 0.0

        return {
            "top5": top5_predictions,
            "is_danger": danger_detected,
            "event": primary_danger_event,
            "confidence": primary_confidence
        }

