# AI Security System - Monorepo Dashboard

Hệ thống an ninh tích hợp AI nhận diện và phân loại âm thanh thời gian thực (sử dụng mô hình Google YAMNet AI).

---

## Yêu Cầu Môi Trường Cần Cài Đặt Ban Đầu

Trước khi bắt đầu cài đặt dự án trên máy mới, hãy đảm bảo máy tính đã cài đặt các công cụ sau:

1. **Python** (Phiên bản 3.10 trở lên): [Tải tại python.org](https://www.python.org/downloads/)
2. **Node.js** (Phiên bản 18.0 trở lên và npm 9+): [Tải tại nodejs.org](https://nodejs.org/)

---

## Hướng Dẫn Cài Đặt Môi Trường Từ Đầu (Step-by-Step)

### BƯỚC 1: Mở Terminal và di chuyển vào thư mục dự án

```powershell
cd AI-security-system
```

---

### BƯỚC 2: Cài đặt Môi trường Python Backend (venv)

1. **Tạo môi trường ảo venv:**
   ```powershell
   python -m venv venv
   ```

2. **Cài đặt các thư viện Python từ requirements.txt:**
   ```powershell
   .\venv\Scripts\python -m pip install --upgrade pip
   .\venv\Scripts\pip install -r requirements.txt
   ```

---

### BƯỚC 3: Cài đặt Thư viện Frontend & Monorepo (Node.js)

Tại thư mục gốc dự án (AI-security-system), chạy lệnh:

```powershell
npm install
```
*Lệnh này sẽ tự động cài đặt Turborepo, Concurrently và toàn bộ thư viện React cho Frontend.*

---

### BƯỚC 4: Cấu Hình Biến Môi Trường (.env)

1. **Tạo file .env từ file mẫu .env.example:**
   ```powershell
   Copy-Item .env.example .env
   ```
   *(Hoặc tạo file .env tại thư mục gốc dự án AI-security-system/.env)*

2. **Nội dung tệp .env cấu hình URL kết nối:**
   ```env
   # Backend Server Host & Port
   HOST=127.0.0.1
   PORT=8000

   # URL Frontend kết nối tới Backend API (được đọc bởi React Vite)
   VITE_API_BASE_URL=http://127.0.0.1:8000
   ```

---

## KHỞI CHẠY DỰ ÁN (Monorepo 1 Lệnh Duy Nhất)

Sau khi cài đặt xong môi trường, bạn chỉ cần gõ 1 lệnh duy nhất:

```powershell
npm run dev
```

Turborepo sẽ tự động kích hoạt song song 2 dịch vụ:
- **Frontend Web Dashboard**: http://localhost:5173
- **Backend FastAPI**: http://127.0.0.1:8000 (Swagger Docs: http://127.0.0.1:8000/docs)

---

## Các Lệnh Phụ Trợ (Tùy Chọn)

- **Chạy riêng lẻ Backend:** `npm run dev:backend`
- **Chạy riêng lẻ Frontend:** `npm run dev:frontend`
- **Chạy Monorepo log phân màu (Concurrently):** `npm run dev:all`

---

## Cấu Trúc Thư Mục Dự Án Monorepo

```
AI-security-system/
├── .env                 # File biến môi trường gốc (VITE_API_BASE_URL, PORT,...)
├── .env.example         # File mẫu hướng dẫn cấu hình biến môi trường
├── package.json         # Cấu hình Monorepo Workspaces & Turborepo
├── turbo.json           # Cấu hình pipeline Turborepo
├── requirements.txt     # Danh sách thư viện Python cho Backend (FastAPI, YAMNet,...)
├── backend/             # Dịch vụ Backend FastAPI
│   ├── app.py           # REST API routes & Websocket stream
│   ├── audio_engine.py   # Mô hình xử lý Google YAMNet AI
│   └── package.json     # Node wrapper khởi chạy Python server
├── frontend/            # Giao diện React + Vite Dashboard
│   ├── src/             # Mã nguồn React (App.jsx, index.css)
│   └── package.json     # Thư viện Frontend React Vite
└── yamnet_audio_classification/  # Dữ liệu mô hình YAMNet
```
