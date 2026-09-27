import os
import sys
import json
import glob
import numpy as np
import soundfile as sf
import tensorflow as tf
import tensorflow_hub as hub

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# BASE_DIR points to project root (d:\PTIT\Nam_4_1\HTTM)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')
YAMNET_MODEL_DIR = os.path.join(BASE_DIR, 'AI-security-system', 'yamnet_audio_classification', 'yamnet_model')
MODEL_SAVE_PATH = os.path.join(BASE_DIR, 'AI-security-system', 'backend', 'custom_sound_classifier.keras')
MODEL_SAVE_PATH_ALT = os.path.join(BASE_DIR, 'AI-security-system', 'yamnet_audio_classification', 'custom_sound_classifier.keras')
LABELS_JSON_PATH = os.path.join(BASE_DIR, 'AI-security-system', 'backend', 'class_labels.json')

LABEL_MAP = {
    '01_Scream_Cry': 0,
    '02_Explosion_Gunshot': 1,
    '03_Glass_Breaking': 2,
    '04_Fire_Alarm_Siren': 3,
    '05_Impact_Crash': 4,
    '06_Normal_Background': 5
}

LABEL_NAMES_VI = [
    "Tiếng La Hét / Kêu Cứu (Scream/Cry)",
    "Tiếng Nổ / Tiếng Súng (Explosion/Gunshot)",
    "Tiếng Vỡ Kính / Đập Phá (Glass Breaking)",
    "Còi Báo Cháy / Báo Động (Fire Alarm/Siren)",
    "Tiếng Va Đập / Tai Nạn (Impact/Crash)",
    "Âm Thanh Nền Bình Thường (Normal Background)"
]

print("==================================================================")
print("   HUẤN LUYỆN MÔ HÌNH PHÂN LOẠI ÂM THANH NGUY HIỂM (TRANSFER LEARNING)")
print("==================================================================")

print(f"[INFO] 1. Tải mô hình YAMNet Feature Extractor từ '{YAMNET_MODEL_DIR}'...")
yamnet_model = hub.load(YAMNET_MODEL_DIR)

def load_audio_16k_mono(filepath):
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

X_data = []
y_data = []

print("[INFO] 2. Trích xuất đặc trưng YAMNet Embeddings từ tập dữ liệu dataset/...")

total_files = 0
for folder_name, label_idx in LABEL_MAP.items():
    folder_path = os.path.join(DATASET_DIR, folder_name)
    if not os.path.exists(folder_path):
        continue
    
    wav_files = glob.glob(os.path.join(folder_path, '*.wav'))
    print(f" -> Đang xử lý nhãn [{folder_name}] (ID: {label_idx}): {len(wav_files)} file audio...")
    
    for wav_path in wav_files:
        try:
            waveform = load_audio_16k_mono(wav_path)
            if len(waveform) < 1600:
                continue
                
            scores, embeddings, spectrogram = yamnet_model(waveform)
            emb_np = embeddings.numpy()
            
            for emb in emb_np:
                X_data.append(emb)
                y_data.append(label_idx)
                
            total_files += 1
        except Exception as e:
            print(f" [CẢNH BÁO] Lỗi đọc file {os.path.basename(wav_path)}: {e}")

X_data = np.array(X_data, dtype=np.float32)
y_data = np.array(y_data, dtype=np.int32)

print(f"\n[INFO] Đã trích xuất thành công: {len(X_data)} khung đặc trưng (Embedding 1024D) từ {total_files} file audio!")

# Train / Test split using pure NumPy
np.random.seed(42)
indices = np.arange(len(X_data))
np.random.shuffle(indices)
split_idx = int(len(X_data) * 0.80)

train_idx, test_idx = indices[:split_idx], indices[split_idx:]
X_train, X_test = X_data[train_idx], X_data[test_idx]
y_train, y_test = y_data[train_idx], y_data[test_idx]

print(f"[INFO] 3. Phân chia tập dữ liệu: Train = {len(X_train)} mẫu, Test/Validation = {len(X_test)} mẫu.")

print("[INFO] 4. Khởi tạo kiến trúc mạng nơ-ron phân loại 6 nhãn...")
classifier_model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(1024,)),
    tf.keras.layers.Dense(256, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(6, activation='softmax')
])

classifier_model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

classifier_model.summary()

callbacks = [
    tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=7, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, verbose=1)
]

print("\n[INFO] 5. Bắt đầu quá trình Huấn Luyện (Training Process)...")
history = classifier_model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=35,
    batch_size=32,
    callbacks=callbacks,
    verbose=1
)

print("\n[INFO] 6. Đánh giá hiệu năng mô hình trên tập kiểm thử Test Set...")
test_loss, test_acc = classifier_model.evaluate(X_test, y_test, verbose=0)
print(f"==================================================================")
print(f" 🎉 ĐỘ CHÍNH XÁC KIỂM THỬ (TEST ACCURACY): {test_acc * 100:.2f}%")
print(f"    LOSS KIỂM THỬ (TEST LOSS):            {test_loss:.4f}")
print(f"==================================================================")

y_pred_probs = classifier_model.predict(X_test, verbose=0)
y_pred = np.argmax(y_pred_probs, axis=1)

print("\n[ĐÁNH GIÁ ĐỘ CHÍNH XÁC THEO TỪNG NHÃN]")
for i, name in enumerate(LABEL_NAMES_VI):
    cls_indices = np.where(y_test == i)[0]
    if len(cls_indices) > 0:
        cls_acc = np.mean(y_pred[cls_indices] == i) * 100
        print(f" - Nhãn {i} [{name}]: {cls_acc:.1f}% ({len(cls_indices)} mẫu)")

print(f"\n[INFO] 7. Lưu file mô hình đã train thành công:")
classifier_model.save(MODEL_SAVE_PATH)
classifier_model.save(MODEL_SAVE_PATH_ALT)
print(f" -> Đã lưu: '{MODEL_SAVE_PATH}'")
print(f" -> Đã lưu: '{MODEL_SAVE_PATH_ALT}'")

label_info = {
    "labels": LABEL_NAMES_VI,
    "label_map": LABEL_MAP,
    "accuracy": float(round(test_acc * 100, 2))
}
with open(LABELS_JSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(label_info, f, ensure_ascii=False, indent=2)

print(f" -> Đã lưu file cấu hình nhãn: '{LABELS_JSON_PATH}'")
print("\n🎉 HOÀN TẤT HUẤN LUYỆN VÀ ĐÓNG GÓI MÔ HÌNH THÀNH CÔNG!")
