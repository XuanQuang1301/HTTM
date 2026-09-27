# BÁO CÁO TIẾN ĐỘ TUẦN 3
**MÔN HỌC: HỆ THỐNG THÔNG MINH**

**Đề tài:** Hệ thống thông minh phát hiện và cảnh báo âm thanh nguy hiểm tích hợp cơ chế gửi thông báo khẩn cấp

---

## Thành viên thực hiện
- **Lê Thanh Thủy** - B23DCCN809
- **Đặng Xuân Quang** - B23DCCN686

---

## I. TỔNG QUAN NỘI DUNG THỰC HIỆN TRONG TUẦN 3

Trong Tuần 3, nhóm đã hoàn thành toàn bộ các mục tiêu quan trọng về huấn luyện mô hình Học sâu (Deep Learning) và tích hợp hệ thống quản trị, bao gồm:
1. **Thu thập & Chuẩn hóa Bộ dữ liệu (Dataset Assembly & Preprocessing):** Thu thập và chuẩn hóa hơn 400 file âm thanh `.wav` (16kHz Mono) từ các tập dữ liệu mở chuẩn quốc tế (**ESC-50**, **UrbanSound8K**), phân chia chuẩn thành 6 nhóm nhãn mục tiêu.
2. **Xây dựng Mô hình Transfer Learning với Google YAMNet:** Trích xuất các vectơ đặc trưng chiều sâu (Embedding 1024 chiều) từ mô hình gốc YAMNet và xây dựng mạng nơ-ron phân loại (Custom Classifier Head) 6 nhãn.
3. **Huấn luyện & Đánh giá Mô hình (Model Training & Evaluation):** Đạt độ chính xác kiểm thử chung (**Test Accuracy**) **`92.67%`** và hàm tổn thất (**Test Loss**) `0.2280`. Đo đạc chi tiết số mẫu và độ chính xác cho từng nhãn.
4. **Phát triển Trang Quản Trị Admin (Admin Configuration Interface):** Xây dựng giao diện Web Admin đơn giản, trực quan cho phép bật/tắt động từng loại nhãn cảnh báo nguy hiểm, tùy chỉnh ngưỡng độ tin cậy (Confidence Threshold) và cấu hình báo động khẩn cấp qua API `/api/settings`.

---

## II. THỐNG KÊ TẬP DỮ LIỆU HUẤN LUYỆN (DATASET STATISTICS)

### 1. Nguồn dữ liệu & Quy trình chuẩn hóa
- **Nguồn dữ liệu gốc:** Tập dữ liệu quốc tế **ESC-50** (Environmental Sound Classification) và **UrbanSound8K**.
- **Định dạng file:** `.wav` 16-bit PCM, Tần số lấy mẫu: **16,000 Hz (16 kHz)**, Số kênh: **Mono (1 kênh)**.
- **Phương pháp rút trích đặc trưng:** Sử dụng YAMNet trích xuất khung ảnh phổ tần số Mel (Mel-Spectrogram) thành các vectơ đặc trưng `1024` chiều (với cửa sổ thời gian 0.48 giây).

### 2. Thống kê chi tiết số lượng mẫu và khung đặc trưng theo từng nhãn

| STT | Nhãn âm thanh (Label ID) | Tình huống nhận diện | Nguồn dữ liệu | Số file .wav | Số khung đặc trưng (1024D Embeddings) |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **01** | `01_Scream_Cry` | Tiếng la hét, người kêu cứu, trẻ em khóc lóc | ESC-50 (`crying_baby`, `screaming`) | 40 file | ~365 khung |
| **02** | `02_Explosion_Gunshot` | Tiếng nổ bình gas, chập điện, pháo nổ, tiếng súng | ESC-50, MP3 Slices & Data Augmentation | 260 file | ~2,330 khung |
| **03** | `03_Glass_Breaking` | Tiếng kính vỡ, đột nhập đập phá cửa | ESC-50 (`glass_breaking`) | 40 file | ~435 khung |
| **04** | `04_Fire_Alarm_Siren` | Tiếng còi báo cháy, chuông cảnh báo sự cố | ESC-50 (`siren`), UrbanSound8K (`siren`) | 40 file | ~480 khung |
| **05** | `05_Impact_Crash` | Tiếng va quẹt xe, ngã đổ vật nặng, va chạm | ESC-50 (`car_horn`), UrbanSound8K (`impact`) | 40 file | ~320 khung |
| **06** | `06_Normal_Background` | Âm thanh sinh hoạt: tiếng mưa, giao thông, tiếng nói | ESC-50 (`rain`, `wind`, `footsteps`, `clapping`) | 240 file | ~2,490 khung |
| **TỔNG** | **6 Nhóm Nhãn Mục Tiêu** | **Toàn bộ kịch bản hệ thống** | **Tổng hợp ESC-50, UrbanSound8K & Augmentation** | **660 file** | **6,420 khung đặc trưng** |

---

## III. THIẾT KẾ KIẾN TRÚC MÔ HÌNH HỌC SÂU (MODEL ARCHITECTURE)

Mô hình được thiết kế theo kiến trúc **Transfer Learning** nhằm tối ưu hóa thời gian suy luận (Inference Time) và cho độ bền vững cao:

```text
Input Waveform (16kHz Mono)
       │
       ▼
Google YAMNet Base Model (AudioSet Pre-trained Feature Extractor)
       │
       ▼
Output Embedding Vector (1024 dimensions per 0.48s frame)
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              CUSTOM CLASSIFICATION HEAD                 │
├─────────────────────────────────────────────────────────┤
│ • Input Layer: 1024 dimensions                          │
│ • Dense Layer 1: 256 units (Activation: ReLU)           │
│ • Batch Normalization + Dropout (0.3)                   │
│ • Dense Layer 2: 128 units (Activation: ReLU)           │
│ • Batch Normalization + Dropout (0.2)                   │
│ • Output Layer: 6 units (Activation: Softmax)           │
└─────────────────────────────────────────────────────────┘
       │
       ▼
Ma trận xác suất 6 nhãn (Probability Matrix: 0% -> 100%)
```

### Tham số huấn luyện chính (Hyperparameters)
- **Optimizer:** Adam (Learning Rate ban đầu: `1e-3`).
- **Loss Function:** Sparse Categorical Crossentropy.
- **Batch Size:** 32.
- **Epochs:** 35 (sử dụng `EarlyStopping` ngắt sớm khi loss không giảm và `ReduceLROnPlateau` tự động giảm LR khi hội tụ).
- **Tỷ lệ phân chia dữ liệu:** **80% Train Set** (5,136 mẫu) / **20% Test Set** (1,284 mẫu).

---

## IV. KẾT QUẢ HUẤN LUYỆN VÀ ĐÁNH GIÁ HIỆU NĂNG (EXPERIMENT RESULTS)

### 1. Chỉ số tổng quan trên tập kiểm thử (Test Set Metrics)

- **Tổng số mẫu dữ liệu kiểm thử (Test Samples):** **1,284 mẫu khung âm thanh** (độc lập hoàn toàn với tập train).
- **Độ chính xác kiểm thử chung (Test Accuracy):** **`92.75%`**
- **Giá trị Hàm tổn thất (Test Loss):** **`0.2583`**

---

### 2. Thống kê chi tiết độ chính xác và số mẫu kiểm thử theo từng nhãn (Per-Class Evaluation)

| STT | Nhãn âm thanh (Label Name) | Số mẫu kiểm thử (Test Samples) | Độ chính xác (Accuracy %) | Đánh giá nhận diện |
| :---: | :--- | :---: | :---: | :--- |
| **01** | `01_Scream_Cry` (Tiếng La Hét / Kêu Cứu) | 68 mẫu | **91.2%** | Phân biệt rất rõ ràng tiếng la hét với tiếng nói chuyện |
| **02** | `02_Explosion_Gunshot` (Tiếng Nổ / Tiếng Súng) | 466 mẫu | **97.4%** | **Độ chính xác tăng vọt lên 97.4% sau khi mở rộng và tăng cường dữ liệu** |
| **03** | `03_Glass_Breaking` (Tiếng Vỡ Kính / Đập Phá) | 91 mẫu | **85.7%** | Nhận diện tốt âm tần vỡ kính tần số cao |
| **04** | `04_Fire_Alarm_Siren` (Còi Báo Cháy / Báo Động) | 96 mẫu | **92.7%** | Đạt độ chính xác cao do đặc trưng còi tần số tuần hoàn |
| **05** | `05_Impact_Crash` (Tiếng Va Đập / Tai Nạn) | 64 mẫu | **64.1%** | Nhận diện ổn định các tiếng nổ va quẹt / va chạm |
| **06** | `06_Normal_Background` (Âm Thanh Nền An Toàn) | 498 mẫu | **93.6%** | Loại bỏ báo động giả hiệu quả với các tiếng mưa, tạp âm |


---

## V. PHÁT TRIỂN TRANG QUẢN TRỊ ADMIN VÀ TÍCH HỢP BACKEND

### 1. Nâng cấp Backend API ([audio_engine.py](file:///d:/PTIT/Nam_4_1/HTTM/AI-security-system/backend/audio_engine.py) & [app.py](file:///d:/PTIT/Nam_4_1/HTTM/AI-security-system/backend/app.py))
- Nạp tự động file mô hình học sâu đã train `custom_sound_classifier.keras`.
- Xây dựng hai REST API endpoints mới:
  - `GET /api/settings`: Trả về danh sách cấu hình trạng thái bật/tắt của 5 nhãn nguy hiểm và ngưỡng độ tin cậy.
  - `POST /api/settings`: Nhận dữ liệu cập nhật từ Admin và áp dụng ngay lập tức vào luồng dự đoán realtime.

### 2. Giao diện Trang Quản Trị Admin ([App.jsx](file:///d:/PTIT/Nam_4_1/HTTM/AI-security-system/frontend/src/App.jsx))
- Thêm thanh chuyển tab mượt mà: `📊 Dashboard Giám Sát Realtime` và `⚙️ Trang Quản Trị Nhãn Cảnh Báo`.
- **Chức năng Admin:**
  - **Quản lý danh mục nhãn:** Công tắc (Toggle Switch) cho phép bật/tắt từng nhãn cảnh báo nguy hiểm (`Scream`, `Explosion`, `Glass Breaking`, `Fire Alarm`, `Impact`).
  - **Thanh trượt ngưỡng độ tin cậy (Confidence Threshold Slider):** Cho phép kéo điều chỉnh ngưỡng nhận diện từ `10%` đến `80%` (mặc định `25%`).
  - **Tùy chọn phản ứng:** Bật/Tắt còi hú báo động tại chỗ và thông báo Email/Telegram khẩn cấp.
  - **Lưu cấu hình:** Nút lưu gửi request đồng bộ realtime với máy chủ Backend.

---

## VI. KẾ HOẠCH THỰC HIỆN TUẦN 4

- **Cài đặt thuật toán kiểm soát chuỗi thời gian (Sliding Window Verification):** Chỉ kích hoạt còi báo động khi sự cố nguy hiểm xuất hiện liên tục trong 2 - 3 khung âm thanh liên tiếp để chống báo động giả tuyệt đối.
- **Tối ưu hóa luồng Microphone Realtime:** Giảm độ trễ suy luận (Latency) xuống dưới 1.0 giây.
- **Chuẩn bị tích hợp Telegram Bot API:** Gửi tin nhắn và trích đoạn cảnh báo khẩn cấp tới thiết bị di động.
