import os
import csv
import sys
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# BASE_DIR points to project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')

ESC50_CSV_URL = 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/meta/esc50.csv'
ESC50_AUDIO_BASE_URL = 'https://raw.githubusercontent.com/karolpiczak/ESC-50/master/audio/'

print("[INFO] Đang tải danh sách nhãn âm thanh từ ESC-50...")
req = urllib.request.urlopen(ESC50_CSV_URL)
lines = [line.decode('utf-8') for line in req.readlines()]
reader = csv.DictReader(lines)

CATEGORY_MAPPING = {
    'glass_breaking': os.path.join(DATASET_DIR, '03_Glass_Breaking'),
    'crying_baby': os.path.join(DATASET_DIR, '01_Scream_Cry'),
    'fireworks': os.path.join(DATASET_DIR, '02_Explosion_Gunshot'),
    'siren': os.path.join(DATASET_DIR, '04_Fire_Alarm_Siren'),
    'car_horn': os.path.join(DATASET_DIR, '05_Impact_Crash')
}

for cat, folder in CATEGORY_MAPPING.items():
    os.makedirs(folder, exist_ok=True)

download_count = {cat: 0 for cat in CATEGORY_MAPPING}

for row in reader:
    category = row['category']
    filename = row['filename']
    
    if category in CATEGORY_MAPPING:
        target_folder = CATEGORY_MAPPING[category]
        target_path = os.path.join(target_folder, filename)
        
        if not os.path.exists(target_path):
            audio_url = ESC50_AUDIO_BASE_URL + filename
            try:
                urllib.request.urlretrieve(audio_url, target_path)
                download_count[category] += 1
                print(f"[DOWNLOADED] {category} -> {filename}")
            except Exception as e:
                print(f"[ERROR] Không thể tải {filename}: {e}")

print("\n[HOÀN THÀNH] Đã tải thành công các mẫu dữ liệu vào thư mục dataset:")
for cat, count in download_count.items():
    print(f" - {cat}: {count} file .wav")
