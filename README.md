# Saini Drive

An offline, landscape Android countryside driving game. Opens with **Made by Saini**.

## Install on your phone

1. Open **[Releases](https://github.com/avinashxthorn/Car-game/releases/latest)**.
2. Under Assets, download **Saini-Drive.apk**.
3. Open the APK and allow your browser or Files app to install it when Android asks.
4. Launch **Saini Drive** and hold your phone sideways.

Requires Android 8.0+, a recent Android System WebView, and OpenGL ES 3 / WebGL 2. The APK is a debug-signed development build. Each fresh CI runner can use a different debug key; if a later build reports an update-signature conflict, uninstall the old build first (this clears local records). A private production signing key is needed before Play Store release.

## Play

- **Left thumb:** drag the wheel sideways to steer. It smoothly returns to centre when released.
- **Right thumb:** hold GAS, hold BRAKE to slow down, or hold GAS + NITRO for a boost. The brake takes priority.
- Settings offer arrow buttons or device tilt, sensitivity, automatic acceleration, sound, vibration, graphics quality, and morning/golden-hour lighting.
- Camera button cycles chase, high chase, and bonnet views.
- Avoid traffic. Close clean passes earn points. Grass slows you down.
- **Free Drive:** endless relaxed driving.
- **3 km Sprint:** cover 3 km in 150 seconds. Collisions reduce speed and car health.
- Android Back pauses; backgrounding the app pauses safely. Best distance, car colour, and preferences stay on the device.
- Keyboard preview: WASD / arrows, Space for nitro, C for camera, Escape to pause.

## Graphics and implementation

Original procedural 3D sports car with sculpted body, alloy wheels, tinted glass, mirrors, lights, spoiler, contact shadow, wheel rotation, steering and suspension animations. Streaming countryside includes hills, trees, rocks, road markings, roadside posts, clouds, birds, fog, traffic, and off-road dust. GPU instancing keeps vegetation draw calls bounded. High mode adds sun shadows; Smooth mode reduces rendering resolution and disables shadows.

Java Android host with a bundled Three.js r170 WebGL 2 renderer and ES modules. This is **not a Unity project**; the studio splash is custom. All assets and audio synthesis are local. The app declares no Internet permission, has no ads, and collects no analytics. No external asset downloads are required while playing.

## Build

The `Build Saini Drive APK` workflow runs on every push to `main`, tests physics, builds/lints the APK, uploads an artifact, and creates a GitHub Release. A second job launches the APK on an Android emulator and saves screenshots.

Local prerequisites: JDK 17 and Android SDK 35.

```sh
./gradlew :app:assembleDebug :app:lintDebug
node --test tests/physics.test.mjs
```

Output: `app/build/outputs/apk/debug/app-debug.apk`.

Browser preview (for development):

```sh
python3 -m http.server 8765 --directory app/src/main/assets
```

Open `http://localhost:8765`. Phone tilt uses the Android sensor bridge in the APK; browser tilt depends on browser support and permissions.

## Source layout

- `app/src/main/java/com/saini/drive/MainActivity.java` — secure offline host, landscape, lifecycle, tilt, vibration.
- `app/src/main/assets/world.mjs` — procedural scene, car, camera, streaming environment.
- `app/src/main/assets/physics.mjs` — deterministic vehicle simulation.
- `app/src/main/assets/game.mjs` — game loop, UI, multitouch, audio, records.
- `tests/physics.test.mjs` — handling, brake priority, nitro, boundaries, collisions, timing.

Three.js is MIT licensed; see `app/src/main/assets/vendor/THREE-LICENSE.txt`. No copyrighted car brands, commercial game assets, or Unity trademarks are included.
