# ==============================================================================
# HỆ THỐNG HUẤN LUYỆN MODEL PHÂN LOẠI ÂM THANH NGUY HIỂM (PHIÊN BẢN 02)
# Dataset: ESC-50 + UrbanSound8K (Chạy trên Kaggle GPU)
# Model Output: custom_sound_classifier_02.keras
# Hỗ trợ: Trích xuất YAMNet 1024D, Chống báo động giả (Vỗ tay, Nói to), Vẽ biểu đồ t-SNE 2D
# ==============================================================================

import os
import glob
import numpy as np
import pandas as pd
import soundfile as sf
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter
from sklearn.manifold import TSNE
from sklearn.metrics import classification_report, confusion_matrix

import tensorflow as tf
import tensorflow_hub as hub

print("==================================================================")
print(f" [1/6] Khởi tạo môi trường TensorFlow: {tf.__version__}")
print("==================================================================")

# 1. Tải Google YAMNet Feature Extractor
print("[INFO] Đang tải mô hình Google YAMNet từ TensorFlow Hub...")
yamnet = hub.load("https://tfhub.dev/google/yamnet/1")

def load_audio_16k_mono(filepath):
    """Đọc audio và chuẩn hóa về Mono 16,000 Hz float32 theo chuẩn YAMNet"""
    data, sr = sf.read(filepath, dtype='float32')
    if data.ndim > 1:
        data = np.mean(data, axis=1)
    if sr != 16000:
        target_len = int(len(data) * 16000 / sr)
        data = np.interp(
            np.linspace(0, len(data), target_len),
            np.arange(len(data)),
            data
        ).astype(np.float32)
    return data

X_data = []
y_data = []

LABEL_NAMES = [
    "01_Scream_Cry",
    "02_Explosion_Gunshot",
    "03_Glass_Breaking",
    "04_Fire_Alarm_Siren",
    "05_Impact_Crash",
    "06_Normal_Background"
]

# ==============================================================================
# 2. XỬ LÝ DỮ LIỆU TỪ ESC-50
# ==============================================================================
print("\n[2/6] Đang dò tìm và xử lý tập dữ liệu ESC-50...")
esc_csv_files = glob.glob("/kaggle/input/**/esc50.csv", recursive=True)

if not esc_csv_files:
    print("[INFO] Không thấy file CSV trong /kaggle/input, đang clone nhanh ESC-50 từ GitHub...")
    os.system("git clone --depth 1 https://github.com/karolpiczak/ESC-50.git")
    esc_csv_path = "ESC-50/meta/esc50.csv"
    esc_audio_dir = "ESC-50/audio"
else:
    esc_csv_path = esc_csv_files[0]
    esc_audio_dir = os.path.join(os.path.dirname(esc_csv_path), "..", "audio")
    if not os.path.exists(esc_audio_dir):
        esc_audio_dir = os.path.dirname(esc_csv_path)

print(f" -> Đã tìm thấy ESC-50 CSV tại: {esc_csv_path}")
esc_df = pd.read_csv(esc_csv_path)

ESC_MAP = {
    'crying_baby': 0,        # 01_Scream_Cry
    'fireworks': 1,          # 02_Explosion_Gunshot
    'glass_breaking': 2,     # 03_Glass_Breaking
    'siren': 3,              # 04_Fire_Alarm_Siren
    'door_wood_creaks': 4,   # 05_Impact_Crash
    # 06_Normal_Background (Hard Negatives: Âm thanh to vô hại chống báo động giả)
    'clapping': 5, 'applause': 5, 'speech': 5, 'laughter': 5, 
    'coughing': 5, 'sneezing': 5, 'door_wood_knock': 5, 
    'keyboard_typing': 5, 'footsteps': 5, 'rain': 5, 'wind': 5
}

esc_count = 0
for _, row in esc_df.iterrows():
    cat = row.get('category')
    fname = row.get('filename')
    if cat in ESC_MAP:
        lbl = ESC_MAP[cat]
        fpath_matches = glob.glob(f"/kaggle/input/**/{fname}", recursive=True)
        fpath = fpath_matches[0] if fpath_matches else os.path.join(esc_audio_dir, fname)
        
        if os.path.exists(fpath):
            try:
                wav = load_audio_16k_mono(fpath)
                
                # Data Augmentation: Tăng giảm âm lượng ngẫu nhiên cho nhóm Normal
                # Dạy mạng hiểu rằng âm lượng to (vỗ tay/quát sát mic) vẫn là bình thường
                variants = [wav]
                if lbl == 5:
                    variants.append(wav * 1.8) # Vỗ tay / nói rất to sát mic
                    variants.append(wav * 0.5) # Âm lượng nhỏ
                    
                for v in variants:
                    _, embeddings, _ = yamnet(v)
                    for emb in embeddings.numpy():
                        X_data.append(emb)
                        y_data.append(lbl)
                esc_count += 1
            except Exception:
                pass

print(f" -> Đã trích xuất thành công {esc_count} file âm thanh từ ESC-50.")

# ==============================================================================
# 3. XỬ LÝ DỮ LIỆU BỔ TRỢ TỪ URBANSOUND8K
# ==============================================================================
print("\n[3/6] Đang dò tìm và xử lý tập dữ liệu UrbanSound8K...")
urb_csv_files = glob.glob("/kaggle/input/**/UrbanSound8K.csv", recursive=True)

if urb_csv_files:
    urb_csv_path = urb_csv_files[0]
    urb_base_dir = os.path.dirname(urb_csv_path)
    print(f" -> Đã tìm thấy UrbanSound8K CSV tại: {urb_csv_path}")
    urb_df = pd.read_csv(urb_csv_path)

    # UrbanSound8K Class Mapping:
    # 6: gun_shot      -> Nhãn 1 (02_Explosion_Gunshot)
    # 8: siren         -> Nhãn 3 (04_Fire_Alarm_Siren)
    # 1: car_horn      -> Nhãn 4 (05_Impact_Crash)
    # 0: air_con, 4: drilling, 5: engine, 7: jackhammer, 9: street_music -> Nhãn 5 (Normal)
    URB_MAP = {
        6: 1,
        8: 3,
        1: 4,
        0: 5, 4: 5, 5: 5, 7: 5, 9: 5
    }

    class_counter = {1: 0, 3: 0, 4: 0, 5: 0}
    MAX_SAMPLES_PER_CLASS = 200 # Giữ cân bằng, tránh làm lệch phân phối dữ liệu

    urb_count = 0
    for _, row in urb_df.iterrows():
        c_id = row['classID']
        if c_id in URB_MAP:
            lbl = URB_MAP[c_id]
            if class_counter[lbl] >= MAX_SAMPLES_PER_CLASS:
                continue

            fname = row['slice_file_name']
            fold = f"fold{row['fold']}"
            fpath_matches = glob.glob(f"{urb_base_dir}/**/{fold}/{fname}", recursive=True)
            
            if fpath_matches and os.path.exists(fpath_matches[0]):
                try:
                    wav = load_audio_16k_mono(fpath_matches[0])
                    _, embeddings, _ = yamnet(wav)
                    for emb in embeddings.numpy():
                        X_data.append(emb)
                        y_data.append(lbl)
                    class_counter[lbl] += 1
                    urb_count += 1
                except Exception:
                    pass

    print(f" -> Đã trích xuất thành công {urb_count} file âm thanh từ UrbanSound8K.")
else:
    print(" [THÔNG BÁO] Không tìm thấy UrbanSound8K.csv, tiếp tục huấn luyện với ESC-50.")

X_data = np.array(X_data, dtype=np.float32)
y_data = np.array(y_data, dtype=np.int32)
print(f"\n[THỐNG KÊ TOÀN DIỆN] Tổng số khung đặc trưng: {len(X_data)} frames (Vector 1024D).")
print(f"Phân bố số lượng mẫu theo từng nhãn: {dict(Counter(y_data))}")

# ==============================================================================
# 4. TRÌNH DIỄN KHÔNG GIAN 2 CHIỀU (t-SNE 2D PROJECTION)
# ==============================================================================
print("\n[4/6] Đang chạy thuật toán t-SNE chiếu lên không gian 2D để kiểm tra tính phân tách cụm...")
try:
    # Chọn ngẫu nhiên tối đa 2500 mẫu để vẽ t-SNE nhanh và rõ nét
    sample_size = min(2500, len(X_data))
    tsne_indices = np.random.choice(len(X_data), sample_size, replace=False)
    
    tsne = TSNE(n_components=2, perplexity=30, random_state=42, n_iter=1000)
    X_2d = tsne.fit_transform(X_data[tsne_indices])
    y_2d = y_data[tsne_indices]

    plt.figure(figsize=(12, 8))
    palette = sns.color_palette("bright", 6)
    for i, label_name in enumerate(LABEL_NAMES):
        idx = np.where(y_2d == i)
        plt.scatter(X_2d[idx, 0], X_2d[idx, 1], label=label_name, alpha=0.65, s=35, color=palette[i])

    plt.title("Không Gian Đặc Trưng Âm Thanh 2D (t-SNE Projection)", fontsize=14, fontweight='bold')
    plt.xlabel("Chiều t-SNE 1", fontsize=11)
    plt.ylabel("Chiều t-SNE 2", fontsize=11)
    plt.legend(bbox_to_anchor=(1.02, 1), loc='upper left', borderaxespad=0.)
    plt.grid(True, linestyle="--", alpha=0.4)
    plt.tight_layout()
    plt.savefig("tsne_2d_space.png", dpi=300)
    plt.close()
    print(" -> [THÀNH CÔNG] Đã lưu biểu đồ 2D vào file: 'tsne_2d_space.png' (Dùng chèn vào Slide/Báo cáo)!")
except Exception as e:
    print(f" [BỎ QUA] Lỗi khi vẽ t-SNE: {e}")

# ==============================================================================
# 5. HUẤN LUYỆN MẠNG NƠ-RON 6 NHÃN
# ==============================================================================
print("\n[5/6] Bắt đầu quá trình huấn luyện mô hình Mạng Nơ-ron...")

indices = np.arange(len(X_data))
np.random.seed(42)
np.random.shuffle(indices)

split = int(0.80 * len(X_data))
X_train, X_test = X_data[indices[:split]], X_data[indices[split:]]
y_train, y_test = y_data[indices[:split]], y_data[indices[split:]]

# Kiến trúc MLP sâu chuẩn xác với đầu vào 1024D và 6 nhãn đầu ra
model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(1024,)),
    tf.keras.layers.Dense(256, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.35),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.25),
    tf.keras.layers.Dense(6, activation='softmax')
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

callbacks = [
    tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=6, restore_best_weights=True),
    tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=2, verbose=1)
]

history = model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=35,
    batch_size=64,
    callbacks=callbacks,
    verbose=1
)

# Đánh giá hiệu năng chi tiết
test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
print("\n==================================================================")
print(f" 🎉 ĐỘ CHÍNH XÁC KIỂM THỬ (TEST ACCURACY): {test_acc * 100:.2f}%")
print(f"    LOSS KIỂM THỬ (TEST LOSS):            {test_loss:.4f}")
print("==================================================================")

y_pred_probs = model.predict(X_test, verbose=0)
y_pred = np.argmax(y_pred_probs, axis=1)

print("\n[BÁO CÁO ĐỘ CHÍNH XÁC TỪNG NHÃN (CLASSIFICATION REPORT)]")
print(classification_report(y_test, y_pred, target_names=LABEL_NAMES, digits=4))

# Lưu ma trận nhầm lẫn
try:
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(9, 7))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=LABEL_NAMES, yticklabels=LABEL_NAMES)
    plt.title("Ma Trận Nhầm Lẫn (Confusion Matrix)", fontsize=13, fontweight='bold')
    plt.ylabel("Nhãn Thực Tế")
    plt.xlabel("Nhãn Dự Đoán")
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.savefig("confusion_matrix.png", dpi=300)
    plt.close()
    print(" -> [THÀNH CÔNG] Đã lưu ma trận nhầm lẫn vào: 'confusion_matrix.png'!")
except Exception as e:
    pass

# ==============================================================================
# 6. XUẤT FILE MODEL PHIÊN BẢN 02
# ==============================================================================
OUTPUT_MODEL_NAME = "custom_sound_classifier_02.keras"
model.save(OUTPUT_MODEL_NAME)

print("\n==================================================================")
print(f" [6/6] HOÀN TẤT! ĐÃ LƯU FILE MÔ HÌNH: '{OUTPUT_MODEL_NAME}'")
print(f" -> Tải file từ mục 'Output' (/kaggle/working) về máy.")
print(f" -> Đặt vào: D:/PTIT/Nam_4_1/HTTM/AI-security-system/backend/{OUTPUT_MODEL_NAME}")
print("==================================================================")
