import os
import sys
import time
import json
import requests
import psutil
import random
import numpy as np
from datetime import datetime
from threading import Lock

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False

SERVER_URL            = "http://192.168.1.34:4000"
EMAIL                 = "admin@smartpark.ai"
PASSWORD              = "Admin@123"
FACILITY_ID           = "348efc36-7857-4569-a402-730186287dda"
DEVICE_CODE           = "RAPI-01"
SEND_INTERVAL_SECONDS = 1
FRAME_POLL_SECONDS    = 0.25
USE_CAMERA            = True
CAMERA_URL            = "http://192.168.1.27:8080/video"

SLOT_ZONES = [
    {"slot_code": "A-01", "x": 95,  "y": 90, "w": 425, "h": 620},
    {"slot_code": "A-02", "x": 530, "y": 90, "w": 425, "h": 620},
    {"slot_code": "A-03", "x": 970, "y": 90, "w": 425, "h": 620},
    {"slot_code": "A-04", "x": 1415,"y": 90, "w": 425, "h": 620},
]

OCCUPIED_STD_THRESHOLD         = 24
OCCUPIED_EDGE_THRESHOLD        = 0.045
OCCUPIED_COLOR_RATIO_THRESHOLD = 0.04

AVAILABLE_STD_THRESHOLD         = 18
AVAILABLE_EDGE_THRESHOLD        = 0.030
AVAILABLE_COLOR_RATIO_THRESHOLD = 0.015

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"

token         = None
lock          = Lock()
current_slots = {}
slot_baselines = {}

def login():
    global token
    print(f"{CYAN}Logging in to SmartPark AI...{RESET}")
    try:
        r = requests.post(
            f"{SERVER_URL}/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=10
        )
        data = r.json()
        if r.status_code == 200 and data.get("success"):
            token = data["data"]["token"]
            print(f"{GREEN}Authenticated successfully{RESET}")
            return True
        print(f"{RED}Login failed: {data}{RESET}")
        return False
    except Exception as e:
        print(f"{RED}Login error: {e}{RESET}")
        return False

def build_payload(slots):
    cpu  = psutil.cpu_percent(interval=None)
    ram  = psutil.virtual_memory().percent
    temp = 45.0
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for key in temps:
                temp = temps[key][0].current
                break
    except:
        pass
    return {
        "parking_id":    FACILITY_ID,
        "device_id":     DEVICE_CODE,
        "timestamp":     datetime.utcnow().isoformat() + "Z",
        "slots":         slots,
        "confidence":    0.95,
        "device_health": {
            "cpuPercent":  cpu,
            "ramPercent":  ram,
            "temperature": temp,
            "ipAddress":   "192.168.1.1",
            "status":      "ONLINE"
        }
    }

def send_payload(slots):
    global token
    payload = build_payload(slots)
    headers = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.post(
            f"{SERVER_URL}/api/simulation/pi-payload",
            json=payload,
            headers=headers,
            timeout=5
        )
        if r.status_code == 401:
            login()
            return send_payload(slots)
        return r.status_code
    except Exception as e:
        print(f"{RED}Send error: {e}{RESET}")
        return None

def detect_slots(frame):
    global current_slots, slot_baselines
    gray    = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    results = {}

    for zone in SLOT_ZONES:
        x, y, w, h = zone["x"], zone["y"], zone["w"], zone["h"]
        code = zone["slot_code"]

        # Ignore slot borders and surrounding road area. Those create edges and
        # shadows that make empty slots look occupied.
        pad_x = max(8, int(w * 0.12))
        pad_y = max(8, int(h * 0.12))
        x1 = x + pad_x
        y1 = y + pad_y
        x2 = x + w - pad_x
        y2 = y + h - pad_y

        roi = blurred[y1:y2, x1:x2]
        color_roi = frame[y1:y2, x1:x2]
        if roi.size == 0 or color_roi.size == 0:
            results[code] = "available"
            continue

        baseline = slot_baselines.get(code)
        if baseline is None or baseline.shape != roi.shape:
            slot_baselines[code] = roi.astype(np.float32)
            baseline = slot_baselines[code]

        std        = float(roi.std())
        edges      = cv2.Canny(roi, 50, 150)
        edge_ratio = float((edges > 0).sum()) / float(edges.size)
        dark_ratio = float((roi < 110).sum()) / float(roi.size)
        diff = cv2.absdiff(roi, cv2.convertScaleAbs(baseline))
        diff_score = float(diff.mean())

        # Also check for yellow and red car colors
        hsv          = cv2.cvtColor(color_roi, cv2.COLOR_BGR2HSV)
        yellow_mask  = cv2.inRange(hsv, np.array([15, 80, 80]),  np.array([35, 255, 255]))
        red_mask1    = cv2.inRange(hsv, np.array([0,  80, 80]),  np.array([10, 255, 255]))
        red_mask2    = cv2.inRange(hsv, np.array([160,80, 80]),  np.array([180,255, 255]))
        car_mask     = yellow_mask | red_mask1 | red_mask2
        car_ratio    = float(cv2.countNonZero(car_mask)) / float(car_mask.size)

        previous_state = current_slots.get(code, "available")

        # Use background difference as the primary real-time signal.
        # The baseline adapts quickly when a slot is available and slowly when
        # occupied, so arrivals and departures both flip state promptly.
        std_hit = std >= OCCUPIED_STD_THRESHOLD
        edge_hit = edge_ratio >= OCCUPIED_EDGE_THRESHOLD
        color_hit = car_ratio >= OCCUPIED_COLOR_RATIO_THRESHOLD
        diff_hit = diff_score >= 12.0

        occupied_now = color_hit or diff_hit or (std_hit and edge_hit)

        clearly_available = (
            diff_score < 8.0
            and
            std < AVAILABLE_STD_THRESHOLD
            and edge_ratio < AVAILABLE_EDGE_THRESHOLD
            and car_ratio < AVAILABLE_COLOR_RATIO_THRESHOLD
        )

        if occupied_now:
            results[code] = "occupied"
        elif clearly_available:
            results[code] = "available"
        else:
            results[code] = previous_state

        learn_rate = 0.18 if results[code] == "available" else 0.02
        cv2.accumulateWeighted(roi.astype(np.float32), slot_baselines[code], learn_rate)

        color = (0, 0, 255) if results[code] == "occupied" else (0, 255, 0)
        cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
        cv2.putText(frame, f"{code}:{results[code][:4].upper()}",
                    (x+5, y+20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
        cv2.putText(frame, f"s:{std:.1f} e:{edge_ratio:.2f} d:{dark_ratio:.2f} c:{car_ratio:.2f} df:{diff_score:.1f}",
                    (x+5, y+h-8), cv2.FONT_HERSHEY_SIMPLEX, 0.35, color, 1)

    current_slots.update(results)
    return results, frame

def simulate_slots():
    global current_slots
    if not current_slots:
        current_slots = {z["slot_code"]: "available" for z in SLOT_ZONES}
    for code in list(current_slots.keys()):
        r = random.random()
        if current_slots[code] == "available" and r < 0.30:
            current_slots[code] = "occupied"
            print(f"{RED}[CAR ARRIVED] {code}: AVAILABLE -> OCCUPIED{RESET}")
        elif current_slots[code] == "occupied" and r < 0.40:
            current_slots[code] = "available"
            print(f"{GREEN}[CAR LEFT]    {code}: OCCUPIED -> AVAILABLE{RESET}")
    return dict(current_slots)

def calibrate():
    print(f"{CYAN}Opening camera for calibration...{RESET}")
    cap = cv2.VideoCapture(CAMERA_URL)
    if not cap.isOpened():
        print(f"{RED}Cannot open camera: {CAMERA_URL}{RESET}")
        return
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print(f"{RED}Could not read frame{RESET}")
        return
    for zone in SLOT_ZONES:
        x, y, w, h = zone["x"], zone["y"], zone["w"], zone["h"]
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 255), 2)
        cv2.putText(frame, zone["slot_code"],
                    (x+5, y+20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,255), 2)
    path = "/home/pr4xh4r/calibration.jpg"
    cv2.imwrite(path, frame)
    print(f"{GREEN}Calibration image saved: {path}{RESET}")
    print(f"{YELLOW}Frame size: {frame.shape[1]}x{frame.shape[0]}{RESET}")

def main():
    print(f"\n{CYAN}SmartPark AI Agent Starting...{RESET}")
    print(f"Server:   {SERVER_URL}")
    print(f"Facility: {FACILITY_ID}")
    print(f"Device:   {DEVICE_CODE}")
    print(f"Camera:   {CAMERA_URL if USE_CAMERA else 'Simulation mode'}")

    if not login():
        print(f"{RED}Cannot start without authentication{RESET}")
        sys.exit(1)

    use_cam = False
    if USE_CAMERA and CV2_AVAILABLE:
        print(f"\n{CYAN}Opening IP Webcam stream...{RESET}")
        cap = cv2.VideoCapture(CAMERA_URL)
        if not cap.isOpened():
            print(f"{YELLOW}Cannot open camera, falling back to simulation{RESET}")
        else:
            print(f"{GREEN}Camera stream opened successfully{RESET}")
            use_cam = True

    print(f"\n{CYAN}Starting data collection... (Press Ctrl+C to stop){RESET}\n")

    try:
        last_sent_slots = None
        last_sent_at = 0.0
        while True:
            if use_cam:
                ret, frame = cap.read()
                if not ret:
                    print(f"{YELLOW}Frame read failed, retrying...{RESET}")
                    time.sleep(1)
                    continue
                slots, _ = detect_slots(frame)
            else:
                slots = simulate_slots()

            time_str = datetime.now().strftime("%H:%M:%S")
            slot_str = "  ".join([
                f"{RED if v == 'occupied' else GREEN}{k}={'OCC' if v == 'occupied' else 'AVL'}{RESET}"
                for k, v in slots.items()
            ])
            now = time.time()
            has_changed = slots != last_sent_slots
            should_send = has_changed or (now - last_sent_at) >= SEND_INTERVAL_SECONDS

            if should_send:
                status = send_payload(slots)
                cpu = psutil.cpu_percent(interval=None)
                print(f"[{time_str}] {slot_str} | HTTP {status} | CPU {cpu}%")
                last_sent_slots = dict(slots)
                last_sent_at = now

            time.sleep(FRAME_POLL_SECONDS if use_cam else SEND_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print(f"\n{YELLOW}Stopped by user{RESET}")
    finally:
        if use_cam and 'cap' in locals():
            cap.release()

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--calibrate":
        if CV2_AVAILABLE:
            calibrate()
        else:
            print("OpenCV not installed")
    else:
        main()
