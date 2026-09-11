import os
import sys
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
import csv
import pygame
import soundfile as sf

# Absolute directory paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# Load YAMNet Model
model_path = os.path.join(BASE_DIR, 'yamnet_model')
print("[INFO] Loading YAMNet model...")
model = hub.load(model_path)

# Load Class Labels
labels_path = tf.keras.utils.get_file(
    'yamnet_class_map.csv',
    'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv'
)
class_names = []
with open(labels_path, newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        class_names.append(row['display_name'])

# Sound Setup
pygame.mixer.init()
alarm_file = os.path.join(ROOT_DIR, "assets", "alarm.WAV")
alarm_sound = pygame.mixer.Sound(alarm_file)

def load_audio_16k_mono(filename):
    """Loads any audio file (MP3, WAV, FLAC, etc.) and converts to 16kHz mono float32 array."""
    data, samplerate = sf.read(filename, dtype='float32')

    # Convert stereo to mono
    if data.ndim > 1:
        data = np.mean(data, axis=1)

    # Resample to 16000 Hz if needed
    if samplerate != 16000:
        num_target_samples = int(len(data) * 16000 / samplerate)
        data = np.interp(
            np.linspace(0, len(data), num_target_samples),
            np.arange(len(data)),
            data
        ).astype(np.float32)

    return data

def test_audio_file(audio_filepath):
    if not os.path.exists(audio_filepath):
        print(f"[ERROR] File '{audio_filepath}' does not exist!")
        return

    print(f"\n[INFO] Testing audio file: {audio_filepath}")
    waveform = load_audio_16k_mono(audio_filepath)

    # Run YAMNet inference
    scores, embeddings, spectrogram = model(waveform)
    
    # Peak scores across all frame windows
    max_scores = np.max(scores, axis=0)

    # Get Top 5 Peak Predictions
    top5_idx = np.argsort(max_scores)[-5:][::-1]
    top5_scores = max_scores[top5_idx]
    top5_labels = [class_names[i] for i in top5_idx]

    print("\n--- TOP 5 PEAK PREDICTIONS ---")
    for rank, (label, score) in enumerate(zip(top5_labels, top5_scores), 1):
        print(f"{rank}. {label:<30} Peak Confidence: {score*100:.2f}%")

    # Detection check
    suspicious_keywords = ["crying, sobbing", "screaming", "shout", "gunshot", "explosion"]
    threshold = 0.3
    detected_events = []

    for label, score in zip(top5_labels, top5_scores):
        for keyword in suspicious_keywords:
            if keyword in label.lower() and score > threshold:
                detected_events.append((label, score))

    if detected_events:
        print("\n[ALERT] DANGER DETECTED!")
        for label, score in detected_events:
            print(f"   -> Event: {label} (Peak Confidence: {score*100:.2f}%)")
        print("Playing Alarm Sound...")
        alarm_sound.play()
        pygame.time.wait(3000)  # Play alarm sound for 3 seconds
    else:
        print("\n[SAFE] No dangerous sound detected above threshold.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_audio_file(sys.argv[1])
    else:
        print("Usage: python test_file.py <path_to_audio_file>")
