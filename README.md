BÁO CÁO TIẾN ĐỘ TUẦN 1
MÔN HỌC: HỆ THỐNG THÔNG MINH

Đề tài: Hệ thống thông minh phát hiện và cảnh báo âm thanh nguy hiểm tích hợp cơ chế gửi thông báo khẩn cấp
I. TỔNG QUAN DỰ ÁN VÀ ĐẶT VẤN ĐỀ
1. Lý do chọn đề tài
Trong đời sống sinh hoạt, sản xuất và các khu vực an ninh, các sự cố nguy hiểm như cháy nổ, bạo lực, đột nhập, chập điện hoặc tai nạn cấp cứu thường xảy ra bất ngờ và gây ra hậu quả nghiêm trọng. Trong nhiều trường hợp, con người không có mặt kịp thời hoặc không thể phản ứng nhanh để ngăn chặn hậu quả.
Phần lớn các sự cố nguy hiểm đều phát ra âm thanh đặc trưng trước hoặc trong khi xảy ra (tiếng kêu cứu, tiếng nổ, tiếng kính vỡ, tiếng còi báo cháy). Do đó, việc xây dựng một hệ thống thông minh có khả năng lắng nghe, tự động phân loại âm thanh theo thời gian thực và kích hoạt các phản ứng khẩn cấp (như ngắt nguồn điện, phát còi báo động, gửi tin nhắn cảnh báo) là rất cần thiết và mang tính ứng dụng thực tiễn cao.
2. Mục tiêu của hệ thống
- Tự động tiếp nhận và xử lý tín hiệu âm thanh từ môi trường xung quanh theo thời gian thực.
- Nhận diện và phân loại chính xác các dạng âm thanh nguy hiểm phổ biến.
- Đưa ra quyết định thông minh dựa trên độ tin cậy để loại bỏ các trường hợp báo động giả.
- Tự động kích hoạt chuỗi hành động phản ứng: Phát còi báo động tại chỗ, điều khiển thiết bị ngắt điện khẩn cấp (Có thể có thêm) và tự động gửi thông báo báo động kèm thông tin sự cố tới cơ quan chức năng hoặc người quản lý.
3. Phạm vi và tính mới của đề tài
- Đề tài tập trung vào bài toán xử lý tín hiệu âm thanh (Audio Signal Processing) kết hợp với các mô hình Học sâu (Deep Learning).
- Điểm mới và điểm mạnh của hệ thống nằm ở tính trọn vẹn: Không dừng lại ở việc phân loại âm thanh tĩnh (dạng bài toán nhận dạng đơn thuần), hệ thống xây dựng trọn vẹn luồng xử lý thời gian thực từ khâu thu âm, phân tích AI, ra quyết định chống nhiễu đến khâu điều khiển hành động thực tế.
II. PHÂN TÍCH YÊU CẦU BÀI TOÁN VÀ CÁC TRƯỜNG HỢP NHẬN DẠNG
1. Yêu cầu chức năng của hệ thống
- Chức năng thu nhận âm thanh: Tiếp nhận nguồn âm thanh liên tục từ micro hoặc luồng âm thanh đầu vào.
- Chức năng tiền xử lý và trích xuất đặc trưng: Lọc nhiễu nền, phân đoạn tín hiệu và chuyển đổi âm thanh sang dạng biểu diễn phổ tần số (Mel-Spectrogram).
- Chức năng nhận dạng và phân loại AI: Sử dụng mô hình học sâu để dự đoán nhãn âm thanh và trả về xác suất độ tin cậy (Confidence Score).
- Chức năng xử lý logic và chống báo động giả: So sánh độ tin cậy với ngưỡng an toàn, xác nhận sự cố xảy ra liên tục qua nhiều khung thời gian trước khi kích hoạt báo động.
- Chức năng cảnh báo và điều khiển:
  + Kích hoạt còi báo động âm thanh.
  + Gửi tin nhắn báo động khẩn cấp (Telegram API / SMS) chứa thông tin thời gian và loại sự cố.
- Chức năng nhật ký và quản lý: Lưu trữ lịch sử các sự cố nguy hiểm phục vụ mục đích tra cứu và kiểm tra.
2. Yêu cầu phi chức năng
- Độ chính xác (Accuracy): Mô hình đạt độ chính xác cao trên các lớp âm thanh nguy hiểm (hạn chế tối đa việc bỏ sót sự cố).
- Thời gian phản ứng (Latency): Tổng thời gian từ khi âm thanh phát ra đến khi kích hoạt cảnh báo không vượt quá 1.5 - 2 giây.
- Khả năng chống nhiễu (Robustness): Hoạt động ổn định trong môi trường có tiếng ồn hỗn hợp.

3. Danh mục các nhãn âm thanh nguy hiểm và kịch bản xử lý
Để đảm bảo tính đa dạng và đáp ứng các kịch bản thực tế, hệ thống phân loại âm thanh thành 6 nhóm nhãn chính:


STT
Nhãn âm thanh (Label)
Tình huống nhận diện
Kịch bản phản ứng tự động
Mức độ ưu tiên
01
Scream / Cry for help
Tiếng la hét, tiếng người kêu cứu, bạo lực
• Kích hoạt còi hú tại chỗ

• Gửi thông báo khẩn SOS đến ban quản lý và cơ quan chức năng
Khẩn cấp
02
Explosion / Gunshot
Tiếng nổ bình gas, nổ chập điện, tiếng súng
• Rung chuông báo động toàn hệ thống

• Gửi cảnh báo nguy hiểm cấp cao nhất
Tối khẩn
03
Glass Breaking
Tiếng đập phá, vỡ kính cửa sổ/cửa ra vào do đột nhập
• Phát tín hiệu còi cảnh báo tại điểm xảy ra sự cố

• Gửi cảnh báo nghi vấn xâm nhập tới an ninh
Cao
04
Fire Alarm / Siren
Tiếng còi báo cháy, chuông cảnh báo sự cố kỹ thuật
• Gửi thông báo sơ tán và cảnh báo cháy
Khẩn cấp
05
Impact / Crash
Va quẹt xe, ngã đổ vật nặng, chấn động kết cấu
• Gửi thông báo yêu cầu kiểm tra hiện trường cho bảo vệ

• Lưu lại trích đoạn âm thanh/camera tương ứng
Trung bình
06
Normal Background
Tiếng nói chuyện, sinh hoạt, mưa rơi, tiếng ồn giao thông
• Hệ thống ghi nhận trạng thái bình thường

• Không kích hoạt hành động (bỏ qua báo động giả)
Bình thường


III. THIẾT KẾ KIẾN TRÚC HỆ THỐNG THÔNG MINH

Hệ thống được thiết kế theo kiến trúc 4 khối chức năng nối tiếp nhau:

1. Khối thu nhận và Tiền xử lý dữ liệu (Input & Preprocessing Module)
- Đảm nhận việc đọc dữ liệu âm thanh theo từng cửa sổ thời gian (ví dụ: cửa sổ 1 giây hoặc 2 giây với độ chồng lấp 50%).
- Áp dụng các kỹ thuật chuẩn hóa tín hiệu, giảm nhiễu và chuyển đổi chuỗi tín hiệu dạng sóng (Waveform) thành hình ảnh biểu diễn phổ tần số Mel (Mel-Spectrogram).

2. Khối Phân loại và Suy luận AI (AI Inference Module)
- Nhận đầu vào là ảnh Mel-Spectrogram từ khối tiền xử lý.
- Đưa qua mô hình mạng Nơ-ron Học sâu (Deep Learning) để tính toán ma trận xác suất đầu ra cho từng nhãn âm thanh.
- Kết quả đầu ra gồm: Nhãn âm thanh có xác suất cao nhất và giá trị độ tin cậy tương ứng (từ 0% đến 100%).

3. Khối Quyết định và Chống báo động giả (Decision & Anti-False-Alarm Module)
- Đóng vai trò là trung tâm trí tuệ của hệ thống.
- So sánh độ tin cậy dự đoán với ngưỡng kích hoạt (Threshold, ví dụ: 85%).
- Áp dụng cơ chế kiểm tra theo chuỗi thời gian (Sliding Window Verification): Chỉ xác nhận có sự cố nguy hiểm khi nhãn nguy hiểm xuất hiện liên tục trong ít nhất 2 đến 3 khung hình liên tiếp. Điều này giúp ngăn chặn tuyệt đối các tiếng động ngẫu nhiên ngắn hạn gây ra báo động giả.
4. Khối Kích hoạt Hành động (Action Execution Module)
Khi khối quyết định xác nhận có sự cố nguy hiểm, khối này sẽ đồng thời điều khiển 3 luồng xử lý:
- Luồng 1 (Phát âm thanh): Phát tín hiệu âm thanh cảnh báo tần số cao qua loa/còi.
- Luồng 2 (Điều khiển phần cứng): Gửi lệnh điều khiển rơ-le (Relay) để ngắt mạch điện khẩn cấp, giảm nguy cơ cháy nổ từ chập điện (Phần này có thể có thêm) 
- Luồng 3 (Truyền tin khẩn cấp): Gọi API dịch vụ tin nhắn (như Telegram Bot API) để gửi tin nhắn cảnh báo tức thời tới điện thoại của người trách nhiệm
5. Quy trình luồng dữ liệu (Data Pipeline Overview)
Nguồn âm thanh -> Tiền xử lý (Mel-Spectrogram) -> Mô hình AI suy luận -> Khối so duyệt ngưỡng & chống báo động giả -> Khối kích hoạt báo động / Ngắt điện / Gửi thông báo.
IV. KHẢO SÁT CÔNG NGHỆ VÀ MÔ HÌNH DỰ KIẾN
1. Phương pháp biểu diễn đặc trưng âm thanh
- Bài toán xử lý âm thanh hiện đại thường chuyển đổi tín hiệu 1D sang không gian 2D dưới dạng ảnh phổ tần số Mel (Mel-Spectrogram).
- Ưu điểm: Cho phép tận dụng sức mạnh của các kiến trúc mạng Nơ-ron Cuộn (CNN) đã phát triển rất mạnh trong xử lý ảnh để áp dụng cho bài toán nhận dạng âm thanh.

2. Khảo sát các mô hình Học sâu (Deep Learning)
Hệ thống dự kiến khảo sát và thử nghiệm các kiến trúc mô hình sau để lựa chọn mô hình tối ưu nhất:
- Mạng Nơ-ron Cuộn 2D (CNN 2D Custom): Mô hình cuộn nhiều lớp tự thiết kế, có kích thước nhẹ, tốc độ suy luận nhanh.
- Mô hình MobileNetV3 / ResNet18: Các kiến trúc CNN phổ biến, hỗ trợ trích xuất đặc trưng sâu, độ chính xác cao.
- Mô hình pre-trained YAMNet (Google): Mô hình mạng nơ-ron được huấn luyện sẵn trên tập dữ liệu AudioSet khổng lồ, rất phù hợp cho bài toán phân loại âm thanh sự kiện thời gian thực.

3. Tập dữ liệu khảo sát và huấn luyện
- Đề tài tiến hành thu thập và tổng hợp dữ liệu từ các tập dữ liệu âm thanh mở chuẩn quốc tế như ESC-50, UrbanSound8K và AudioSet.
- Kết hợp với việc tự bổ sung các mẫu âm thanh tiếng kêu cứu tiếng Việt và âm thanh môi trường thực tế để tăng tính đại diện.
- Áp dụng các kỹ thuật tăng cường dữ liệu âm thanh (Data Augmentation) như: Thêm tiếng ồn trắng, thay đổi tốc độ, thay đổi cao độ để mô hình đạt độ bền vững cao.

4. Công nghệ triển khai hệ thống
- Ngôn ngữ lập trình chính: Python.
- Thư viện xử lý âm thanh: Librosa, PyAudio, SoundFile.
- Thư viện Học sâu: PyTorch / TensorFlow.
- Công nghệ Backend và Giao diện:
- Dịch vụ thông báo: Telegram API / Twilio SMS API.


V. KẾ HOẠCH THỰC HIỆN DỰ ÁN (ROADMAP)

Tuần 1:
- Phân tích chi tiết bài toán và yêu cầu hệ thống.
- Thiết kế kiến trúc tổng quan 4 khối chức năng.
- Khảo sát tài liệu, lựa chọn tập dữ liệu và các mô hình AI dự kiến.

Tuần 2:
- Thu thập, lọc và chuẩn hóa tập dữ liệu âm thanh cho các nhãn nguy hiểm và nhãn nền.
- Xây dựng Module tiền xử lý âm thanh tự động (chuyển đổi tín hiệu thành Mel-Spectrogram).
- Thực hiện tăng cường dữ liệu (Data Augmentation).

Tuần 3:
- Huấn luyện các mô hình AI (CNN 2D, ResNet, YAMNet).
- Đánh giá, so sánh hiệu năng các mô hình theo các chỉ số Accuracy, Precision, Recall, F1-score và thời gian suy luận (Inference Time).
- Lựa chọn mô hình tối ưu nhất.

Tuần 4:
- Xây dựng Module tiếp nhận và xử lý luồng âm thanh thời gian thực (Real-time Audio Stream).
- Cài đặt thuật toán kiểm soát ngưỡng và chống báo động giả (Sliding Window Verification).

Tuần 5:
- Triển khai ứng dụng Web Dashboard quản lý và giám sát hệ thống.
- Xây dựng Module kích hoạt báo động: Mô phỏng ngắt rơ-le điện, phát còi báo động và tích hợp Telegram Bot gửi tin nhắn khẩn cấp.

Tuần 6:
- Kiểm thử tích hợp toàn bộ hệ thống theo các kịch bản sự cố thực tế.
- Đo đạc độ trễ và độ ổn định của hệ thống.
- Hoàn thiện báo cáo tổng kết và chuẩn bị tài liệu thuyết trình.


VI. KẾT QUẢ ĐẠT ĐƯỢC TRONG TUẦN 1 VÀ HƯỚNG PHÁT TRIỂN TUẦN 2

1. Kết quả đạt được trong Tuần 1
- Hoàn thành bản phân tích bài toán và xác định rõ 6 nhóm nhãn âm thanh mục tiêu cùng kịch bản phản ứng tương ứng.
- Hoàn thành thiết kế kiến trúc hệ thống 4 khối chức năng đảm bảo tính logic và tính khả thi của một hệ thống thông minh.
- Lựa chọn được hướng tiếp cận công nghệ chính: Chuyển đổi Mel-Spectrogram kết hợp với mô hình CNN 2D / YAMNet.
- Lập bảng kế hoạch thực hiện dự án chi tiết cho 6 tuần.
2. Kế hoạch công việc Tuần 2
- Tiến hành tải và trích xuất dữ liệu âm thanh từ các tập dữ liệu công cộng (ESC-50, UrbanSound8K).
- Đóng gói mã nguồn tiền xử lý dữ liệu âm thanh và trích xuất Mel-Spectrogram chuẩn hóa.
- Chuẩn bị tập dữ liệu huấn luyện và kiểm thử sẵn sàng cho bước huấn luyện mô hình ở Tuần 3.



