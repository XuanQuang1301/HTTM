# HƯỚNG DẪN THU THẬP DATASET VÀ HUẤN LUYỆN BỘ NHÃN ÂM THANH MỚI

Thư mục `scripts/` chứa toàn bộ công cụ tự động hóa quá trình **Tải dữ liệu**, **Cắt lọc / Tăng cường dữ liệu (Data Augmentation)** và **Huấn luyện mô hình AI (Transfer Learning)** cho hệ thống phát hiện cảnh báo âm thanh nguy hiểm.

---

## MỤC LỤC
1. [Nguồn Thu Thập & Lấy Dataset Âm Thanh](#1-nguồn-thu-thập--lấy-dataset-âm-thanh)
2. [Cấu Trúc Lưu Trữ Dataset (`dataset/`)](#2-cấu-trúc-lưu-trữ-dataset-dataset)
3. [Hướng Dẫn Thêm Bộ Nhãn Mới & Train Mô Hình](#3-hướng-dẫn-thêm-bộ-nhãn-mới--train-mô-hình)
4. [Kỹ Thuật Tăng Cường Dữ Liệu (Data Augmentation)](#4-kỹ-thuật-tăng-cường-dữ-liệu-data-augmentation)
5. [Quy Trình Tích Hợp Tự Động Với Backend & UI](#5-quy-trình-tích-hợp-tự-động-với-backend--ui)

---

## 1. NGUỒN THU THẬP & LẤY DATASET ÂM THANH

Để huấn luyện thêm các bộ nhãn âm thanh khác (ví dụ: tiếng chó sủi, tiếng rò rỉ nước, tiếng trẻ em khóc, tiếng cưa máy, tiếng va chạm xe...), bạn có thể lấy dữ liệu từ các nguồn uy tín sau:

### Các Tập Dữ Liệu Âm Thanh Công Cộng Phổ Biến

1. **ESC-50 (Environmental Sound Classification)**:
   - **Mô tả**: Tập dữ liệu gồm 2,000 mẫu âm thanh (mỗi mẫu 5 giây), chia thành 50 lớp âm thanh sinh hoạt và môi trường (siren, glass breaking, crying baby, dog bark, fireworks, thunderstorm...).
   - **Link GitHub**: [karolpiczak/ESC-50](https://github.com/karolpiczak/ESC-50)
   - **Cách dùng trong dự án**: Script `download_missing_dataset.py` đã tích hợp sẵn cơ chế tải trực tiếp file `.wav` từ kho lưu trữ của ESC-50.

2. **UrbanSound8K**:
   - **Mô tả**: 8,732 đoạn âm thanh ngắn (<= 4 giây) thuộc 10 lớp âm thanh đô thị (air_conditioner, car_horn, children_playing, dog_bark, drilling, engine_idling, gun_shot, jackhammer, siren, street_music).
   - **Link Tải**: [UrbanSound8K Dataset](https://urbansounddataset.weebly.com/urbansound8k.html)

3. **Google AudioSet**:
   - **Mô tả**: Tập dữ liệu siêu lớn chứa hơn 2 triệu trích đoạn âm thanh YouTube được dán nhãn thuộc hơn 500 loại âm thanh khác nhau (bao gồm các loại âm thanh nguy hiểm, sự cố kỹ thuật).
   - **Link Tham Khảo**: [AudioSet Dataset](https://research.google.com/audioset/)

4. **Freesound.org**:
   - **Mô tả**: Kho dữ liệu hiệu ứng âm thanh mở cực kỳ phong phú. Bạn có thể tìm kiếm theo từ khóa chính xác như `scream`, `explosion`, `glass break`, `gunshot`, `car crash`, `alarm` và tải file dạng `.wav` hoặc `.mp3`.
   - **Link Trang Chủ**: [Freesound.org](https://freesound.org/)

5. **Kaggle Datasets**:
   - **Mô tả**: Rất nhiều bài thi và dataset cộng đồng về Audio Classification.
   - **Từ khóa tìm kiếm**: `Audio Classification`, `Sound Event Detection`, `Emergency Sounds Dataset`.
   - **Link Search**: [Kaggle Audio Datasets](https://www.kaggle.com/search?q=audio+classification)

6. **BBC Sound Effects**:
   - **Mô tả**: Kho hơn 16,000 hiệu ứng âm thanh chất lượng cao của đài BBC.
   - **Link Tải**: [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk/)

### Tự Thu Âm Thực Tế (Custom Recorded Audio)
- Bạn có thể dùng smartphone hoặc micro để ghi âm các tình huống thực tế (ví dụ: tiếng kêu cứu bằng tiếng Việt, tiếng gõ cửa khẩn cấp, tiếng chuông báo nhà).
- Sau khi ghi âm, hãy lưu thành định dạng `.wav` (hoặc `.mp3`) và cắt thành các đoạn ngắn từ 1 đến 5 giây.

---

## 2. CẤU TRÚC LƯU TRỮ DATASET (`dataset/`)

Tất cả các file âm thanh phục vụ huấn luyện cần được đặt trong thư mục gốc `dataset/` theo cấu trúc từng thư mục con tương ứng với từng nhãn:

```text
HTTM/
├── dataset/
│   ├── 01_Scream_Cry/              # Chứa các file .wav tiếng la hét, kêu cứu
│   ├── 02_Explosion_Gunshot/       # Chứa các file .wav tiếng nổ, tiếng súng
│   ├── 03_Glass_Breaking/          # Chứa các file .wav tiếng vỡ kính, đập phá
│   ├── 04_Fire_Alarm_Siren/        # Chứa các file .wav tiếng còi báo cháy, báo động
│   ├── 05_Impact_Crash/            # Chứa các file .wav tiếng va đập, tai nạn
│   ├── 06_Normal_Background/       # Chứa các file .wav tiếng ồn nền bình thường
│   ├── 07_Dog_Bark/                # (Ví dụ nhãn mới): Tiếng chó sủi báo động
│   └── 08_Water_Leak/              # (Ví dụ nhãn mới): Tiếng rò rỉ nước
```

### Quy chuẩn File Âm Thanh
- **Định dạng file**: Ưu tiên `.wav` (PCM uncompressed).
- **Tần số lấy mẫu (Sample Rate)**: Kịch bản `train_classifier.py` sẽ **tự động chuyển đổi** mọi file audio về **16,000 Hz Mono** khi trích xuất đặc trưng YAMNet. Do đó bạn không cần phải thực hiện resample thủ công.
- **Độ dài file**: Khuyến nghị từ 1 đến 5 giây mỗi file.

---

## 3. HƯỚNG DẪN THÊM BỘ NHÃN MỚI & TRAIN MÔ HÌNH

Nếu bạn muốn mở rộng từ 6 nhãn hiện tại thành **7, 8 hoặc N nhãn âm thanh khác**, hãy thực hiện theo các bước chi tiết dưới đây:

### Bước 1: Tạo thư mục nhãn mới trong `dataset/`
Vào thư mục `dataset/` và tạo thư mục chứa các file âm thanh mới.  
*Ví dụ*: Tạo thư mục `dataset/07_Dog_Bark/` và chép các file `.wav` tiếng chó sủi vào đây.

---

### Bước 2: Cập nhật danh sách nhãn trong `scripts/train_classifier.py`

Mở file [train_classifier.py](train_classifier.py) và cập nhật hai cấu trúc dữ liệu `LABEL_MAP` và `LABEL_NAMES_VI`:

```python
# Cập nhật LABEL_MAP (khóa là tên thư mục trong dataset/, giá trị là chỉ số từ 0 -> N-1)
LABEL_MAP = {
    '01_Scream_Cry': 0,
    '02_Explosion_Gunshot': 1,
    '03_Glass_Breaking': 2,
    '04_Fire_Alarm_Siren': 3,
    '05_Impact_Crash': 4,
    '06_Normal_Background': 5,
    '07_Dog_Bark': 6,            # <-- Thêm nhãn mới tại đây
    '08_Water_Leak': 7           # <-- Thêm nhãn mới tại đây (nếu có)
}

# Cập nhật tên tiếng Việt hiển thị tương ứng trên Giao diện UI & Báo cáo
LABEL_NAMES_VI = [
    "Tiếng La Hét / Kêu Cứu (Scream/Cry)",
    "Tiếng Nổ / Tiếng Súng (Explosion/Gunshot)",
    "Tiếng Vỡ Kính / Đập Phá (Glass Breaking)",
    "Còi Báo Cháy / Báo Động (Fire Alarm/Siren)",
    "Tiếng Va Đập / Tai Nạn (Impact/Crash)",
    "Âm Thanh Nền Bình Thường (Normal Background)",
    "Tiếng Chó Sủi Báo Động (Dog Bark)",         # <-- Thêm tên nhãn tiếng Việt
    "Tiếng Rò Rỉ Nước Sự Cố (Water Leak)"        # <-- Thêm tên nhãn tiếng Việt
]
```

---

### Bước 3: Cập nhật số lượng đầu ra (Output Neurons) trong Mô hình Keras

Trong file `scripts/train_classifier.py`, điều chỉnh số nút của lớp cuối cùng (Dense Output Layer) cho phù hợp với tổng số nhãn `len(LABEL_MAP)`:

```python
num_classes = len(LABEL_MAP) # Tự động lấy tổng số nhãn (ví dụ: 7 hoặc 8)

classifier_model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(1024,)),
    tf.keras.layers.Dense(256, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.3),
    tf.keras.layers.Dense(128, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.2),
    tf.keras.layers.Dense(num_classes, activation='softmax')  # <-- Sử dụng num_classes
])
```

---

### Bước 4: Thực thi lệnh huấn luyện mô hình

Mở Terminal tại thư mục gốc của dự án (`HTTM`) và chạy lệnh:

```bash
python scripts/train_classifier.py
```

**Quá trình thực thi sẽ tự động diễn ra theo các bước**:
1. Đọc và trích xuất YAMNet 1024-dimensional Embeddings cho từng file trong `dataset/`.
2. Chia tập dữ liệu thành **80% Train / 20% Test**.
3. Huấn luyện mạng nơ-ron phân loại với các kỹ thuật `EarlyStopping` và `ReduceLROnPlateau`.
4. Đánh giá độ chính xác (Accuracy %) chi tiết theo từng nhãn.
5. **Tự động đóng gói và xuất file**:
   - `AI-security-system/backend/custom_sound_classifier.keras`
   - `AI-security-system/yamnet_audio_classification/custom_sound_classifier.keras`
   - `AI-security-system/backend/class_labels.json`

---

## 4. KỸ THUẬT TĂNG CƯỜNG DỮ LIỆU (DATA AUGMENTATION)

Khi thêm một loại âm thanh mới nhưng số lượng file gốc còn ít (dưới 30-50 file), bạn nên áp dụng các kỹ thuật Data Augmentation có sẵn trong script `scripts/expand_explosion_dataset.py` để nhân bản dữ liệu:

### 1. Tự động cắt đoạn dài (Slicing long audio):
Nếu bạn có 1 file ghi âm / nhạc hiệu ứng dài (ví dụ: file 3 phút `.mp3`), bạn có thể dùng đoạn mã cắt cửa sổ trượt (Sliding Window Chunking 2s, 50% overlap) để tạo ra hàng chục mẫu ngắn 2s:

```python
chunk_len = 16000 * 2  # 2 giây
step = 16000           # 1 giây bước nhảy (50% overlap)
for i in range(0, len(data) - chunk_len, step):
    chunk = data[i : i + chunk_len]
    if np.max(np.abs(chunk)) > 0.05: # Bỏ qua khoảng lặng (silence)
        sf.write(output_path, chunk, 16000)
```

### 2. Các phép biến đổi âm thanh (Audio Transforms):
- **Volume Boost / Attenuation**: Nhân biên độ tín hiệu với 0.7x đến 1.5x.
- **White Noise Injection**: Cộng thêm nhiễu trắng tỉ lệ nhỏ (ví dụ: `std=0.008`) để tăng độ chống nhiễu thực tế.
- **Time Shift**: Dịch chuyển dòng thời gian bằng `np.roll`.
- **Pitch Shift / Resampling**: Thay đổi độ cao tần số âm thanh.

Bạn có thể chạy thử nghiệm hoặc nhân bản script này thành `scripts/expand_custom_dataset.py` cho nhãn mới của bạn.

---

## 5. QUY TRÌNH TÍCH HỢP TỰ ĐỘNG VỚI BACKEND & UI

Sau khi huấn luyện xong bằng `python scripts/train_classifier.py`, mô hình mới và file cấu hình `class_labels.json` được cập nhật tự động vào Backend:

1. **Backend FastAPI (`audio_engine.py`)**: Khi khởi động lại hoặc đọc stream âm thanh, backend tự động đọc file `class_labels.json` để lấy danh sách tên tiếng Việt và ma trận chuyển đổi nhãn.
2. **Web Dashboard Frontend (React + Vite)**: Hiển thị đúng danh sách nhãn mới cùng biểu đồ Confidence Score tương ứng theo thời gian thực mà **không cần sửa lại code giao diện UI**.

---

**Lưu ý**:
- Hãy luôn đảm bảo nhãn `06_Normal_Background` có đủ đa dạng mẫu âm thanh (tiếng nói chuyện, tiếng mưa, tiếng gió, tiếng xe cộ xa xa) để mô hình không bị nhận diện nhầm các âm thanh sinh hoạt bình thường thành sự cố nguy hiểm!
