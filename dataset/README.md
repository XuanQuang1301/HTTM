# TẬP DỮ LIỆU HUẤN LUYỆN (DATASET FOR AUDIO CLASSIFICATION)

## I. Phân Tích Các Nhãn Đã Có Và Nhãn Còn Thiếu Trong Dự Án Hiện Tại

Qua kiểm tra mã nguồn hệ thống hiện tại trong [audio_engine.py](../AI-security-system/backend/audio_engine.py):
- **Các nhãn ĐÃ ĐƯỢC hỗ trợ phát hiện sơ bộ:**
  1. **Tiếng La Hét / Kêu Cứu (`01_Scream_Cry`)**: `screaming`, `scream`, `crying`, `sobbing`, `shout`
  2. **Tiếng Nổ / Tiếng Súng (`02_Explosion_Gunshot`)**: `explosion`, `boom`, `gunshot`, `fireworks`
  3. **Tiếng Còi Báo Cháy (`04_Fire_Alarm_Siren`)**: `alarm`, `siren`

- **Các nhãn CÒN THIẾU / CẦN THÊM DATA ĐỂ HUẤN LUYỆN CHUẨN HÓA:**
  1. **`03_Glass_Breaking` (Tiếng kính vỡ, đập phá cửa cửa sổ/cửa chính)**
  2. **`05_Impact_Crash` (Tiếng va đập mạnh, tai nạn xe, chấn động kết cấu)**

---

## II. Cấu Trúc Thư Mục Chuẩn

Vui lòng thả các file âm thanh định dạng `.wav` (chuẩn 16kHz Mono) vào các thư mục tương ứng bên dưới để tiến hành train mô hình:

```text
dataset/
├── 01_Scream_Cry/          # (Tiếng la hét, kêu cứu)
├── 02_Explosion_Gunshot/   # (Tiếng nổ, tiếng súng)
├── 03_Glass_Breaking/      # [NHÃN CÒN THIẾU 1] (Tiếng vỡ kính, đập phá)
├── 04_Fire_Alarm_Siren/    # (Tiếng còi báo cháy, báo động)
├── 05_Impact_Crash/        # [NHÃN CÒN THIẾU 2] (Tiếng va đập, tai nạn)
└── 06_Normal_Background/   # (Âm thanh nền bình thường)
```

---

## III. Hướng Dẫn Tải Dữ Liệu Cho 2 Nhãn Còn Thiếu

1. **`03_Glass_Breaking`**:
   - Nguồn: Tập dữ liệu **ESC-50** (Class 39: `glass_breaking`) hoặc **AudioSet**.
2. **`05_Impact_Crash`**:
   - Nguồn: Tập dữ liệu **UrbanSound8K** (Class 1: `car_horn`, `drilling`, `impact`) hoặc **ESC-50** (Class 40: `can_opening`, `door_wood_knock`).
