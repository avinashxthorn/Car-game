#!/usr/bin/env bash
set -euo pipefail
mkdir -p smoke-output
# Preserve Android logs and the last screen even when a check fails.
trap 'adb logcat -d > smoke-output/logcat.txt 2>/dev/null || true; adb exec-out screencap -p > smoke-output/last-screen.png 2>/dev/null || true' EXIT
adb install -r dist/Saini-Drive.apk
adb logcat -c
adb shell am start -W -n com.saini.drive/.MainActivity
# Fresh emulators show a system fullscreen tutorial. Dismiss the observed
# Android dialog, then wait for the actual game Start button to be available.
python3 - <<'PY'
import subprocess,time,re,xml.etree.ElementTree as ET
from pathlib import Path
out=Path('smoke-output')
def adb(*args):
    return subprocess.check_output(['adb',*args],text=True,timeout=20)
def centre(node):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds','')))
    return str((x1+x2)//2),str((y1+y2)//2)
for attempt in range(15):
    time.sleep(2)
    adb('shell','uiautomator','dump','/sdcard/window.xml')
    xml=adb('shell','cat','/sdcard/window.xml')
    (out/'window.xml').write_text(xml)
    root=ET.fromstring(xml)
    popup=next((n for n in root.iter('node') if n.get('package')=='android' and n.get('resource-id')=='android:id/ok' and n.get('text')=='Got it'),None)
    if popup is not None:
        adb('shell','input','tap',*centre(popup))
        print('Dismissed Android fullscreen tutorial',flush=True)
        continue
    start=next((n for n in root.iter('node') if 'LET' in (n.get('text','')+' '+n.get('content-desc','')) and 'DRIVE' in (n.get('text','')+' '+n.get('content-desc',''))),None)
    if start is not None:
        (out/'start-coordinates.txt').write_text(' '.join(centre(start))+'\n')
        break
else:
    raise SystemExit('Game Start button did not appear after dismissing system UI; see screenshot and logcat')
PY
adb shell pidof com.saini.drive
adb exec-out screencap -p > smoke-output/home.png
read -r TAP_X TAP_Y < smoke-output/start-coordinates.txt
adb shell input tap "$TAP_X" "$TAP_Y"
sleep 4
adb exec-out screencap -p > smoke-output/driving.png
adb logcat -d > smoke-output/logcat.txt
if grep -E 'FATAL EXCEPTION|Unable to start activity|Uncaught (TypeError|ReferenceError|SyntaxError)' smoke-output/logcat.txt; then exit 1; fi
adb shell input keyevent KEYCODE_HOME
sleep 1
adb shell am start -W -n com.saini.drive/.MainActivity
sleep 2
adb shell pidof com.saini.drive
adb exec-out screencap -p > smoke-output/resume.png
