import os
import sys
import glob
import urllib.request
import numpy as np
import soundfile as sf

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# BASE_DIR points to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPLOSION_DIR = os.path.join(BASE_DIR, 'dataset', '02_Explosion_Gunshot')
os.makedirs(EXPLOSION_DIR, exist_ok=True)

# 1. Slice sample file dragon-studio-nuclear-explosion-386181.mp3 if available
sample_mp3 = os.path.join(BASE_DIR, 'AI-security-system', 'dragon-studio-nuclear-explosion-386181.mp3')
if os.path.exists(sample_mp3):
    try:
        data, sr = sf.read(sample_mp3, dtype='float32')
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if sr != 16000:
            target_len = int(len(data) * 16000 / sr)
            data = np.interp(np.linspace(0, len(data), target_len), np.arange(len(data)), data).astype(np.float32)
        
        chunk_len = 16000 * 2 # 2s chunks
        step = 16000 # 1s step (50% overlap)
        count = 0
        for i in range(0, len(data) - chunk_len, step):
            chunk = data[i : i + chunk_len]
            if np.max(np.abs(chunk)) > 0.05: # Skip silence
                out_name = f"nuclear_explosion_slice_{count}.wav"
                sf.write(os.path.join(EXPLOSION_DIR, out_name), chunk, 16000)
                count += 1
        print(f"[SUCCESS] Đã cắt thành công {count} mẫu âm thanh từ file mp3 tiếng nổ!")
    except Exception as e:
        print(f"[CẢNH BÁO] Không thể cắt mp3: {e}")

# 2. Download additional open-source Gunshot & Explosion WAV files
ADDITIONAL_URLS = [
    "https://raw.githubusercontent.com/m-c-frank/sound-classification/master/data/gun_shot/1-100032-A-0.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/1-100032-A-0.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/2-117615-A-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/2-117615-B-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/2-117616-A-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/3-119120-A-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/3-119120-B-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/3-172881-A-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/4-119647-A-48.wav",
    "https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/5-160614-A-48.wav"
]

print("[INFO] Tải thêm các mẫu tiếng súng và tiếng nổ từ nguồn dữ liệu mở...")
for idx, url in enumerate(ADDITIONAL_URLS):
    try:
        out_file = os.path.join(EXPLOSION_DIR, f"extra_gunshot_explosion_{idx}.wav")
        urllib.request.urlretrieve(url, out_file)
        print(f" -> Tải thành công: {os.path.basename(out_file)}")
    except Exception as e:
        pass

# 3. Data Augmentation for Explosion / Gunshot class
print("[INFO] Bắt đầu tăng cường dữ liệu âm thanh (Data Augmentation) cho nhãn 02_Explosion_Gunshot...")
existing_files = glob.glob(os.path.join(EXPLOSION_DIR, '*.wav'))
aug_count = 0

for wav_path in existing_files:
    if "aug_" in os.path.basename(wav_path):
        continue
    try:
        data, sr = sf.read(wav_path, dtype='float32')
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if sr != 16000:
            t_len = int(len(data) * 16000 / sr)
            data = np.interp(np.linspace(0, len(data), t_len), np.arange(len(data)), data).astype(np.float32)
            
        base_name = os.path.splitext(os.path.basename(wav_path))[0]
        
        # Augmentation 1: Volume Boost
        data_boost = np.clip(data * 1.5, -1.0, 1.0)
        sf.write(os.path.join(EXPLOSION_DIR, f"aug_boost_{base_name}.wav"), data_boost, 16000)
        aug_count += 1
        
        # Augmentation 2: White Noise
        noise = np.random.normal(0, 0.008, len(data)).astype(np.float32)
        data_noisy = np.clip(data + noise, -1.0, 1.0)
        sf.write(os.path.join(EXPLOSION_DIR, f"aug_noise_{base_name}.wav"), data_noisy, 16000)
        aug_count += 1
        
        # Augmentation 3: Time Shift
        shift_len = int(16000 * 0.2)
        data_shifted = np.roll(data, shift_len)
        sf.write(os.path.join(EXPLOSION_DIR, f"aug_shift_{base_name}.wav"), data_shifted, 16000)
        aug_count += 1

        # Augmentation 4: Pitch Shift / Resample
        ratio = 0.9
        low_len = int(len(data) * ratio)
        data_low = np.interp(np.linspace(0, len(data), low_len), np.arange(len(data)), data).astype(np.float32)
        sf.write(os.path.join(EXPLOSION_DIR, f"aug_low_{base_name}.wav"), data_low, 16000)
        aug_count += 1

    except Exception as e:
        print(f"[CẢNH BÁO] Lỗi augment file {wav_path}: {e}")

total_now = len(glob.glob(os.path.join(EXPLOSION_DIR, '*.wav')))
print(f"\n[HOÀN THÀNH] Đã mở rộng tập dữ liệu 02_Explosion_Gunshot từ 39 file lên tổng cộng: {total_now} file .wav!")
