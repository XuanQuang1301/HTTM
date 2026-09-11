import os
import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
import pyaudio
import csv
import matplotlib.pyplot as plt
import pygame
import smtplib
from email.message import EmailMessage
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
gmail_user = os.environ.get("GMAIL_USER")
gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD")

# GPIO Setup (Optional for Windows / Non-Raspberry Pi environments)
try:
    import RPi.GPIO as GPIO
    HAS_GPIO = True
    GPIO.setmode(GPIO.BCM)
    LED_PIN = 18
    GPIO.setup(LED_PIN, GPIO.OUT)
    GPIO.output(LED_PIN, GPIO.LOW)
except (ImportError, RuntimeError):
    HAS_GPIO = False
    print("[INFO] RPi.GPIO module not available. Running in PC/Windows simulation mode.")

# Absolute directory paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)

# Load YAMNet Model
model_path = os.path.join(BASE_DIR, 'yamnet_model')
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

# PyAudio Config
CHUNK = 16000
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000

p = pyaudio.PyAudio()
stream = p.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)

# Matplotlib Setup
plt.ion()
fig, ax = plt.subplots()
ax.set_xlim(0, 1)

# Sound Setup
pygame.mixer.init()
alarm_file = os.path.join(ROOT_DIR, "assets", "alarm.WAV")
alarm_sound = pygame.mixer.Sound(alarm_file)
alarm_playing = False

# Email Alert Function
def send_email_alert(event_type):
    if not gmail_user or not gmail_app_password:
        print(f"[INFO] Skipping email alert for '{event_type}' (GMAIL_USER / GMAIL_APP_PASSWORD not configured).")
        return

    msg = EmailMessage()
    msg.set_content(f"Suspicious sound detected: {event_type}")
    msg['Subject'] = f"Audio Alert - {event_type}"
    msg['From'] = gmail_user
    msg['To'] = gmail_user  # or another recipient if preferred

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(gmail_user, gmail_app_password)
            smtp.send_message(msg)
        print(f"Email sent for {event_type}")
    except Exception as e:
        print(f"Failed to send email: {e}")

# Logging Setup
LOG_FILE = os.path.join(ROOT_DIR, "audio_detection_log.txt")
def log_event(event_type):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as log:
        log.write(f"[{timestamp}] Detected: {event_type}\n")

# Email Flags
email_sent_flags = {
    "crying, sobbing": False,
    "screaming": False,
    "shout": False,
    "gunshot": False,
    "explosion": False
}

# Detection Loop
print("Recording... Press Ctrl+C to stop.")

try:
    while True:
        data = stream.read(CHUNK)
        waveform = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        scores, embeddings, spectrogram = model(waveform)

        mean_scores = np.mean(scores, axis=0)
        top5_idx = np.argsort(mean_scores)[-5:][::-1]
        top5_scores = mean_scores[top5_idx]
        top5_labels = [class_names[i] for i in top5_idx]

        # Update Plot
        ax.clear()
        ax.barh(top5_labels, top5_scores)
        ax.set_xlim(0, 1)
        ax.set_xlabel("Confidence")
        ax.set_title("Top 5 Predictions")
        plt.pause(0.01)

        # Detection Logic
        suspicious_keywords = ["crying, sobbing", "screaming", "shout", "gunshot", "explosion"]
        threshold = 0.3
        detected_something = False

        for label, score in zip(top5_labels, top5_scores):
            for keyword in suspicious_keywords:
                if keyword in label.lower() and score > threshold:
                    detected_something = True
                    if HAS_GPIO:
                        GPIO.output(LED_PIN, GPIO.HIGH)
                    if not alarm_playing:
                        alarm_sound.play()
                        alarm_playing = True
                    if not email_sent_flags[keyword]:
                        send_email_alert(label)
                        log_event(label)
                        email_sent_flags[keyword] = True

        if not detected_something:
            if HAS_GPIO:
                GPIO.output(LED_PIN, GPIO.LOW)
            if alarm_playing:
                alarm_sound.stop()
                alarm_playing = False

except KeyboardInterrupt:
    print("Stopping...")

finally:
    if HAS_GPIO:
        GPIO.output(LED_PIN, GPIO.LOW)
        GPIO.cleanup()
    stream.stop_stream()
    stream.close()
    p.terminate()
    plt.close()
    pygame.mixer.quit()