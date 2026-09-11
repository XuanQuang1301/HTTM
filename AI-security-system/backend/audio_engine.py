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
                
        self.suspicious_keywords = [
            "explosion", "boom", "bang", "burst", "fireworks", "artillery", "gunshot", "gunfire", "cap gun", "thump", "thud",
            "crying", "sobbing", "screaming", "scream", "shout", "yell", "wail", "groan",
            "alarm", "siren"
        ]
        self.threshold = 0.25

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

        # Check for danger events
        danger_detected = False
        detected_events = []

        for pred in top5_predictions:
            label_lower = pred["label"].lower()
            conf_fraction = pred["confidence"] / 100.0
            for keyword in self.suspicious_keywords:
                if keyword in label_lower and conf_fraction > self.threshold:
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

        danger_detected = False
        detected_events = []
        for pred in top5_predictions:
            label_lower = pred["label"].lower()
            conf_fraction = pred["confidence"] / 100.0
            for keyword in self.suspicious_keywords:
                if keyword in label_lower and conf_fraction > self.threshold:
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
