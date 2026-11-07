# HƯỚNG DẪN HUẤN LUYỆN LẠI MÔ HÌNH TRÊN KAGGLE (PHIÊN BẢN 02)

File code huấn luyện đầy đủ: `Docs/.plans/train_kaggle_classifier_02.py`

---

## 1. Mục Tiêu Nâng Cấp Của Phiên Bản 02
1. **Khắc phục triệt để báo động giả:** Âm thanh vỗ tay to, đập bàn, nói lớn, tiếng ho, tiếng cười được đưa vào nhóm `06_Normal_Background` (kèm kỹ thuật tăng giảm âm lượng ngẫu nhiên - Volume Augmentation) để mô hình phân biệt rạch ròi với tiếng nổ hay tiếng la hét.
2. **Hợp nhất dữ liệu lớn (Dataset Fusion):** Kết hợp cả **ESC-50** và **UrbanSound8K** để vừa có tiếng khóc trẻ em, tiếng đập kính, còi báo cháy, vừa có tiếng súng thật (`gun_shot`).
3. **Trình diễn không gian 2 chiều (2D Projection):** Tự động xuất biểu đồ **t-SNE** (`tsne_2d_space.png`) và ma trận nhầm lẫn (`confusion_matrix.png`) để chèn vào Slide thuyết trình và Báo cáo.
4. **Giữ an toàn hệ thống:** Xuất ra file mới `custom_sound_classifier_02.keras` mà không đè lên bản cũ `custom_sound_classifier_01.keras`.

---

## 2. Các Bước Thực Hiện Trên Kaggle

1. Mở Kaggle Notebook hiện tại (đã mount `Esc-50`, `UrbanSound8K`, `FSD50K`).
2. Bật GPU: Bấm biểu tượng góc phải trên **Settings** $\rightarrow$ **Accelerator** $\rightarrow$ chọn **GPU T4 x2** (hoặc P100) và bật **Internet: On**.
3. Copy toàn bộ nội dung trong file `Docs/.plans/train_kaggle_classifier_02.py` dán vào 1 Cell trên Kaggle Notebook.
4. Bấm **Run Cell** (Ctrl + Enter) và đợi khoảng 10–15 phút.

---

## 3. Tải File Về Máy Và Kích Hoạt

1. Khi chạy xong, nhìn sang cột bên phải mục **Output** $\rightarrow$ `/kaggle/working`.
2. Bấm nút 3 chấm cạnh file **`custom_sound_classifier_02.keras`** $\rightarrow$ chọn **Download**.
3. Đặt file vừa tải vào thư mục backend của bạn:
   ```text
   D:/PTIT/Nam_4_1/HTTM/AI-security-system/backend/custom_sound_classifier_02.keras
   ```
4. Mở file `AI-security-system/backend/audio_engine.py`, sửa dòng 87 thành:
   ```python
   self.custom_model_path = os.path.join(BASE_DIR, 'backend', 'custom_sound_classifier_02.keras')
   ```
5. Khởi động lại backend để sử dụng mô hình mới. Nếu cần hoàn tác, chỉ cần đổi số `02` thành `01`.
