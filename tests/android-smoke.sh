#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke-output
adb install -r dist/Saini-Drive.apk
adb logcat -c
adb shell am start -W -n com.saini.drive/.MainActivity
sleep 10
adb shell pidof com.saini.drive
adb exec-out screencap -p > smoke-output/home.png
adb shell uiautomator dump /sdcard/window.xml >/dev/null
adb pull /sdcard/window.xml smoke-output/window.xml
# Resolve the accessible start button's centre from Android's UI tree.
python3 - <<'PY' > smoke-output/start-coordinates.txt
import xml.etree.ElementTree as ET,re
root=ET.parse('smoke-output/window.xml')
for n in root.iter('node'):
    if 'DRIVE' in n.get('text','') and 'LET' in n.get('text',''):
        x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
        print((x1+x2)//2,(y1+y2)//2)
        break
else:
    raise SystemExit('Start button not found; WebView may not have rendered')
PY
read -r TAP_X TAP_Y < smoke-output/start-coordinates.txt
adb shell input tap "$TAP_X" "$TAP_Y"
sleep 3
adb exec-out screencap -p > smoke-output/driving.png
adb logcat -d > smoke-output/logcat.txt
if grep -E 'FATAL EXCEPTION|Unable to start activity|Uncaught (TypeError|ReferenceError|SyntaxError)' smoke-output/logcat.txt; then exit 1; fi
adb shell input keyevent KEYCODE_HOME
sleep 1
adb shell am start -W -n com.saini.drive/.MainActivity
sleep 2
adb shell pidof com.saini.drive
adb exec-out screencap -p > smoke-output/resume.png
