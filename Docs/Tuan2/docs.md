# BÁO CÁO TIẾN ĐỘ TUẦN 2
**MÔN HỌC: HỆ THỐNG THÔNG MINH**

**Đề tài:** HỆ THỐNG THÔNG MINH PHÁT HIỆN VÀ CẢNH BÁO ÂM THANH NGUY HIỂM

---

## Thành viên thực hiện
- **Lê Thanh Thủy** - Mã SV: B23DCCN809
- **Đặng Xuân Quang** - Mã SV: B23DCCN686

---

## I. TỔNG QUAN HỆ THỐNG

Hệ thống là giải pháp giám sát an ninh thông minh dựa trên học sâu (Deep Learning), liên tục thu nhận và phân tích tín hiệu âm thanh môi trường theo thời gian thực. Hệ thống có khả năng nhận diện chủ động các sự cố đe dọa an toàn và an ninh, đồng thời kích hoạt cảnh báo tức thời qua thư điện tử (Email), phát còi hú tại chỗ và định hướng kích hoạt mô phỏng ngắt mạch điện thông qua phần cứng.

Hệ thống được thiết kế theo kiến trúc phân tầng gồm 4 khối chức năng cốt lõi:

1. **Khối 1 (Audio Acquisition & Preprocessing):** Thu nhận luồng âm thanh PCM từ Microphone qua PyAudio (Server) và Web Audio API (Client), chuẩn hóa tần số lấy mẫu 16.000 Hz và phân đoạn khung trượt thời gian thực từ 0.96s đến 1.0s.
2. **Khối 2 (AI Inference Engine):** Sử dụng mô hình tiền huấn luyện Google YAMNet nguyên bản, suy luận trực tiếp trên không gian đặc trưng âm thanh và ánh xạ logic qua bộ từ khóa chuyên biệt để nhận dạng 6 nhóm âm thanh mục tiêu của dự án.
3. **Khối 3 (Temporal Decision Logic & Anti-False-Alarm):** Bộ lọc logic chống báo động giả dựa trên ngưỡng tin cậy phân tầng, giải thuật cửa sổ trượt biểu quyết chuỗi thời gian (Sliding Window Majority Voting) và cơ chế thời gian hồi ngăn spam cảnh báo.
4. **Khối 4 (Action, Alert & Dashboard):** Kích hoạt hệ thống còi hú tại chỗ, tự động gửi thư cảnh báo khẩn cấp qua giao thức SMTP (Gmail Alert Service), điều khiển mô phỏng ngắt mạch điện phần cứng (GPIO/Relay trên Raspberry Pi / PC Simulation) và trực quan hóa dữ liệu trên Dashboard (FastAPI + React/Vite).

---

## II. KIẾN TRÚC MÔ HÌNH HỌC SÂU

Trong giai đoạn nền tảng hiện tại (Tuần 2), hệ thống triển khai **Google YAMNet nguyên bản** nhằm tối ưu hóa độ phủ âm thanh, bảo đảm tốc độ đáp ứng thời gian thực mà không cần huấn luyện lại từ đầu.

### 1. Cấu trúc mô hình cốt lõi: Google YAMNet
- **Kiến trúc mạng:** Xây dựng dựa trên nền tảng **MobileNetV1** sử dụng các lớp tích chập tách biệt theo chiều sâu (Depthwise Separable Convolutions), giảm thiểu đáng kể số lượng tham số tính toán và vận hành mượt mà trên môi trường CPU hoặc thiết bị nhúng.
- **Tiền xử lý tín hiệu âm thanh:**
  - **Tần số lấy mẫu đầu vào:** Chuẩn hóa cố định **16.000 Hz (16 kHz)**, đơn kênh (Mono float32 trong dải `[-1.0, 1.0]`).
  - **Phân đoạn khung (Framing):** Kích thước cửa sổ trượt **0.96 giây (960ms)** với bước nhảy **0.48 giây** (độ chồng lấp 50%).
  - **Chuyển đổi phổ:** Sóng âm được biến đổi qua Fourier thời gian ngắn (STFT) thành ảnh phổ **Log-Mel Spectrogram 64 dải tần** trong khoảng từ 125 Hz đến 7.500 Hz với ma trận đầu vào kích thước **(96, 64)**.
- **Đặc tính đầu ra:**
  - Vector phân phối xác suất kích hoạt của **521 lớp sự kiện âm thanh** theo danh mục chuẩn quốc tế **AudioSet Ontology**.
  - Trích xuất vector đặc trưng nhúng chiều sâu (**Audio Embeddings 1024 chiều**) đóng vai trò làm dữ liệu đầu vào cho giai đoạn huấn luyện mở rộng tiếp theo (Custom Transfer Learning).
- **Triển khai cục bộ (Local Deployment):**
  - Mô hình được đóng gói dưới dạng **TensorFlow SavedModel offline** tại thư mục `yamnet_model`, cho phép hệ thống chạy độc lập không phụ thuộc vào kết nối mạng internet.
  - **Độ trễ suy luận (Inference Latency):** Đạt từ **15ms - 30ms** trên CPU thông thường, đáp ứng trọn vẹn tiêu chí thời gian thực.

---

## III. DATASET VÀ NGUỒN DỮ LIỆU

Hệ thống kết hợp tập dữ liệu nền tảng của mô hình cùng các tập dữ liệu mở phục vụ việc đánh giá chuẩn đối sánh:

### 1. Google AudioSet (Dataset nền tảng của YAMNet)
- Bộ dữ liệu âm thanh sự kiện quy mô lớn nhất hiện nay do Google công bố với hơn **2 triệu trích đoạn âm thanh** từ YouTube, bao phủ **521 nhãn sự kiện âm thanh** môi trường, đời sống và tình huống khẩn cấp.

### 2. Các tập dữ liệu khảo sát và mở rộng
Nhóm sử dụng 2 bộ dữ liệu mở chuẩn quốc tế làm tập mẫu đánh giá đối sánh:
- **ESC-50:** Gồm 2.000 mẫu âm thanh môi trường chuẩn hóa (50 lớp) phục vụ khảo sát tiếng kêu cứu, tiếng kính vỡ và các tạp âm tự nhiên (mưa, gió, tiếng bước chân).
- **UrbanSound8K:** Gồm 8.732 trích đoạn âm thanh đô thị (10 lớp) phục vụ kiểm chứng nhận diện tiếng súng nổ (gunshot), còi báo động (siren) và tiếng ồn sinh hoạt.

### 3. Tập dữ liệu kiểm thử thực tế của dự án
- **Mẫu âm thanh kiểm thử chức năng phân tích trực tiếp:**
  - `dragon-studio-nuclear-explosion-386181.mp3`: Mẫu âm thanh vụ nổ lớn, sóng xung kích.
  - `pataponai-hatapon-crying-344088.mp3`: Mẫu âm thanh tiếng kêu khóc, nức nở, cầu cứu.
  - `assets/alarm.WAV`: Mẫu âm thanh còi hú an ninh tần số cao dùng để phản hồi cảnh báo.
- **Luồng âm thanh thu nhận trực tiếp:** Microphone thu qua thư viện **PyAudio** (Server) và chuẩn **Web Audio API** (Client).

---

## IV. DANH MỤC 6 NHÓM ÂM THANH MỤC TIÊU & CƠ CHẾ ÁNH XẠ LOGIC

Hệ thống sử dụng bộ lọc từ khóa nguy hiểm đa tầng đối chiếu với **Top 5 nhãn** có xác suất cao nhất từ YAMNet để phân loại vào đúng 6 nhóm âm thanh mục tiêu của dự án:

| STT | Nhóm âm thanh mục tiêu | Từ khóa / Nhãn nhận diện (AudioSet) | Tình huống thực tế | Mức độ cảnh báo | Phản ứng hệ thống tự động |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **01** | **Scream / Cry for help** | Screaming, Scream, Shout, Yell, Crying, sobbing, Wail, Groan | Tiếng la hét, tiếng người kêu cứu, bạo lực gia đình, cướp giật | **Khẩn cấp**<br>*(High Priority)* | • Gửi email cảnh báo SOS khẩn cấp<br>• Phát còi hú cảnh báo tại chỗ<br>• Trực quan hóa mức tin cậy trên Dashboard |
| **02** | **Explosion / Gunshot** | Explosion, Boom, Bang, Gunshot, gunfire, Cap gun, Artillery | Tiếng nổ bình gas, nổ chập điện, tiếng vũ khí súng đạn | **Tối khẩn cấp**<br>*(Critical)* | • Gửi email cảnh báo cháy nổ khẩn cấp<br>• Bật còi hú cảnh báo liên tục<br>• Kích hoạt mô phỏng ngắt điện (Relay)<br>• Ghi log đỏ hệ thống `[CRITICAL]` |
| **03** | **Glass Breaking** | Glass, Shatter, Chink, clink, Breaking | Tiếng đập phá, vỡ kính cửa sổ/cửa ra vào do đột nhập | **Cảnh báo cao**<br>*(Warning)* | • Gửi email cảnh báo đột nhập<br>• Lưu trữ nhật ký sự cố phục vụ điều tra |
| **04** | **Fire Alarm / Siren** | Siren, Civil defense siren, Fire alarm, Smoke detector, Buzzer | Tiếng còi báo cháy, chuông cảnh báo sự cố kỹ thuật | **Khẩn cấp**<br>*(High Priority)* | • Gửi email báo động kỹ thuật / báo cháy<br>• Hiển thị trạng thái khẩn cấp toàn trang |
| **05** | **Impact / Crash** | Crash, Smash, Car crash, Thud, Thump | Va quẹt xe cộ, ngã đổ vật nặng, chấn động kết cấu | **Cảnh báo**<br>*(Attention)* | • Ghi nhận nhật ký sự kiện vào database<br>• Hiển thị thông báo chú ý trên Dashboard |
| **06** | **Normal Background** | Speech, Music, Rain, Wind, Footsteps, Dog, Typing, Silence... | Tiếng nói chuyện, sinh hoạt, mưa rơi, tiếng ồn giao thông | **Bình thường**<br>*(Normal)* | • Giữ trạng thái an toàn<br>• Bỏ qua báo động, không kích hoạt cảnh báo |

---

## V. GIẢI THUẬT QUYẾT ĐỊNH & CHỐNG BÁO ĐỘNG GIẢ

Nhằm triệt tiêu hiện tượng báo động nhầm do tạp âm ngẫu nhiên ngắn hạn, hệ thống triển khai chu trình kiểm soát 4 bước nghiêm ngặt:

```
[Khung Âm Thanh PCM] 
         │
         ▼
 ┌───────────────┐      Score < 0.30
 │ Bước 1: Lọc  │───────────────────────► [ Bỏ qua - Normal ]
 │  Ngưỡng Score │
 └───────┬───────┘
         │ Score ≥ 0.30
         ▼
 ┌───────────────┐      Count < 2 / 3
 │ Bước 2: Hàng  │───────────────────────► [ Chờ Khung Tiếp Theo ]
 │ Đợi Trượt k=3 │
 └───────┬───────┘
         │ Count ≥ 2 trong 3 khung
         ▼
 ┌───────────────┐      Cờ Email = True
 │ Bước 3: Cờ Ngăn│───────────────────────► [ Đã gửi email, bỏ qua gửi lại ]
 │ Spam Email    │
 └───────┬───────┘
         │ Cờ Email = False
         ▼
 ┌───────────────┐
 │ Bước 4: Khóa  │ ──► Gửi Email SMTP SSL + Phát Còi Hú Pygame + Mô phỏng Ngắt 電 Relay
 │ Cooldown 10s  │     (Khóa cờ gửi email & giữ thời gian hồi 10s)
 └───────────────┘
```

1. **Bước 1 (Lọc ngưỡng tin cậy động):** Only các nhãn nguy hiểm (từ nhóm 01 đến nhóm 05) có xác suất dự đoán vượt ngưỡng:
   $$\text{Score} = P(\text{Label} \mid \text{Audio}) \ge 0.30 \quad (30\%)$$
   mới được chuyển tiếp vào bộ đệm đánh giá chuỗi thời gian.
2. **Bước 2 (Hàng đợi trượt chuỗi thời gian - Sliding Window Majority Voting):** Sử dụng hàng đợi trượt kích thước $k = 3$ khung liên tiếp (mỗi khung 1.0 giây). Hệ thống yêu cầu sự cố cùng loại phải xuất hiện tối thiểu 2 lần trong 3 khung liên tiếp:
   $$\text{Count} = \sum_{i=1}^{3} \mathbb{I}(\text{Label}_i == \text{Target}) \ge 2$$
3. **Bước 3 (Cơ chế cờ ngăn spam email - Email Anti-Spam Flagging):** Tích hợp cờ trạng thái `email_sent_flags` cho từng từ khóa sự cố. Sau khi gửi email cảnh báo đầu tiên, cờ sẽ khóa kênh gửi thư của từ khóa đó cho đến khi môi trường trở lại trạng thái bình thường (Normal).
4. **Bước 4 (Thời gian hồi phục - Cooldown Period):** Áp dụng thời gian hồi cố định **10s** giữa các lần kích hoạt chuông báo động để tránh gây hoảng loạn và nghẽn hệ thống.

---

## VI. KIẾN TRÚC HỆ THỐNG PHẦN MỀM & GIAO TIẾP PHẦN CỨNG

Hệ thống được tổ chức theo kiến trúc phân tầng tích hợp giữa Software Dashboard và Hardware Control:

### 1. Frontend Dashboard (React + Vite + TailwindCSS)
- Hiển thị bảng điều khiển thời gian thực với chỉ số an ninh toàn cảnh (**Normal** / **Warning** / **Critical Danger**).
- Biểu đồ thanh ngang hiển thị Top 5 xác suất sự kiện âm thanh được cập nhật liên tục qua giao thức **WebSocket**.
- Bảng nhật ký sự cố (**Incident Logs**) và nút điều khiển còi hú khẩn cấp thủ công.

### 2. Backend API Service (FastAPI)
- Tiếp nhận luồng âm thanh PCM từ client với độ trễ cực thấp (**< 100ms**).
- Điều phối toàn bộ luồng xử lý: `Audio Acquisition` $\rightarrow$ `YAMNet Inference` $\rightarrow$ `Temporal Logic Filtering` $\rightarrow$ `Phản hồi WebSocket về Dashboard`.

### 3. Cơ chế Phản ứng & Gửi Cảnh báo Khẩn cấp
- **Hệ thống cảnh báo qua Email (SMTP SSL):** Kết nối trực tiếp đến máy chủ `smtp.gmail.com` qua cổng **465** để gửi thư khẩn cấp đính kèm tiêu đề rõ ràng, thời gian chính xác và loại sự cố phát hiện.
- **Hệ thống âm thanh tại chỗ:** Phát file còi hú tần số cao qua module `pygame.mixer` khi phát hiện các nhóm sự cố 01, 02, 03, 04.

### 4. Mô phỏng ngắt điện qua phần cứng (Hardware Circuit Breaker Simulation)
- Định hướng can thiệp an toàn điện khi phát hiện sự cố cháy nổ / chập điện (**Explosion / Gunshot**).
- Triển khai mô phỏng logic qua module `RPi.GPIO` (điều khiển chân `LED_PIN = 18` đóng vai trò chân kích hoạt Relay ngắt nguồn điện). Hệ thống tự động chuyển sang chế độ mô phỏng trên môi trường Windows/PC nếu không phát hiện bo mạch phần cứng.

---

---

## VII. ĐÁNH GIÁ VÀ KẾ HOẠCH MỞ RỘNG

### 1. Đánh giá thực tế khả năng nhận diện các nhãn âm thanh
Hệ thống trong mã nguồn `AI-security-system` thực hiện phân loại trực tiếp trên 521 nhãn AudioSet và chia thành 2 nhóm sự kiện chính:
- **Nhóm 5 nhãn nguy hiểm kích hoạt cảnh báo (Danger Target Keywords):**
  1. `crying, sobbing`: Tiếng khóc, nức nở, kêu cứu khẩn cấp.
  2. `screaming`: Tiếng la hét, hoảng loạn khi xảy ra sự cố.
  3. `shout`: Tiếng quát tháo, xô xát, gây hấn.
  4. `gunshot`: Tiếng súng nổ, nổ vũ khí nguy hiểm.
  5. `explosion`: Tiếng nổ lớn, nổ bình gas, chập điện.
  - *Cơ chế xử lý:* Khi xác suất dự đoán $\ge 30\%$, hệ thống kích hoạt đồng thời Còi hú tại chỗ, gửi Email cảnh báo khẩn SOS và mô phỏng ngắt Rơ-le điện (Relay GPIO 18).
- **Nhóm nhãn âm thanh môi trường & sinh hoạt (Background / Normal):**
  1. `Speech / Conversation`: Tiếng nói chuyện, giao tiếp sinh hoạt.
  2. `Silence / Ambient`: Môi trường yên tĩnh, không gian không có tiếng động lớn.
  3. `Rain / Wind noise`: Tiếng mưa rơi, gió thổi tự nhiên.
  4. `Footsteps / Typing`: Tiếng bước chân, tiếng gõ bàn phím.
  5. `Traffic / Dog bark`: Tiếng ồn xe cộ giao thông, tiếng cún sủi.
  - *Cơ chế xử lý:* Hệ thống tự động bỏ qua, duy trì trạng thái An toàn (Normal) và không kích hoạt cảnh báo báo động giả.

### 2. Đánh giá ưu điểm và hạn chế của hệ thống hiện tại
- **Ưu điểm:**
  - Độ trễ suy luận cực thấp (**15ms - 30ms** trên CPU), vận hành mượt mà không cần GPU rời.
  - Vận hành hoàn toàn offline nhờ mô hình SavedModel đóng gói sẵn.
  - Tận dụng toàn diện không gian 521 nhãn của AudioSet giúp bao quát được cả 6 nhóm âm thanh mục tiêu mà không bị hiện tượng quá khớp dữ liệu (overfitting).
- **Hạn chế:**
  - Bộ lọc từ khóa tiếng Anh dựa trên phổ tần số quốc tế, chưa nhận biết được các câu kêu cứu mang tính ngữ nghĩa riêng biệt bằng tiếng Việt.

### 3. Kế hoạch phát triển Giai đoạn tiếp theo
- **Giai đoạn 2 - Huấn luyện mô hình phân loại chuyên biệt (Custom Transfer Learning):**
  - Tận dụng vector nhúng **1024 chiều** trích xuất từ YAMNet để huấn luyện thêm một mạng nơ-ron phân loại (Dense Layers + Dropout) chuyên biệt cho đúng 6 nhóm nhãn mục tiêu trên tập dữ liệu kết hợp từ ESC-50, UrbanSound8K và dữ liệu âm thanh sự cố thu thập thực tế.
- **Giai đoạn 3 - Tối ưu hóa triển khai biên & Hoàn thiện mô-đun phần cứng:**
  - Lượng tử hóa mô hình sang định dạng **TensorFlow Lite (TFLite) INT8** để nhúng độc lập lên các bo mạch vi máy tính giá rẻ (Raspberry Pi 4/5).
  - Đấu nối chân GPIO trực tiếp vào Module Relay cơ/bán dẫn thực tế để đóng ngắt tải điện 220V ngoài đời thực khi phát hiện sự cố cháy nổ.
