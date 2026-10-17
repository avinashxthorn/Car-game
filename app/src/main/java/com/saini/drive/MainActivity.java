package com.saini.drive;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.view.Surface;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;

/** Offline-only Android host. All URLs are served from packaged assets. */
public class MainActivity extends Activity implements SensorEventListener {
    private WebView web;
    private SensorManager sensors;
    private Sensor accelerometer;
    private long lastSensor;
    private boolean active;
    private static final String HOST = "game.saini.local";

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        immersive();
        sensors = (SensorManager) getSystemService(SENSOR_SERVICE);
        accelerometer = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        web = new WebView(this);
        web.setBackgroundColor(0xff101e1b);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new NativeBridge(), "SainiNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (HOST.equals(request.getUrl().getHost()) && "https".equals(request.getUrl().getScheme())) {
                    String path = request.getUrl().getPath();
                    if (path == null || path.equals("/")) path = "/index.html";
                    if (!path.contains("..")) {
                        String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".css") ? "text/css" : path.endsWith(".js") || path.endsWith(".mjs") ? "text/javascript" : "text/plain";
                        try { return new WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1))); }
                        catch (IOException ignored) { }
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, new ByteArrayInputStream(new byte[0]));
            }
        });
        setContentView(web);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }
    @Override public void onWindowFocusChanged(boolean focused) { super.onWindowFocusChanged(focused); if (focused) immersive(); }
    @Override protected void onResume() {
        super.onResume(); active = true;
        if (web != null) { web.onResume(); web.resumeTimers(); }
        if (accelerometer != null) sensors.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
    }
    @Override protected void onPause() {
        active = false;
        if (web != null) { web.evaluateJavascript("window.sainiPause && window.sainiPause()", null); web.onPause(); web.pauseTimers(); }
        sensors.unregisterListener(this);
        super.onPause();
    }
    @Override protected void onDestroy() { sensors.unregisterListener(this); web.removeJavascriptInterface("SainiNative"); web.destroy(); super.onDestroy(); }
    @Override public void onBackPressed() { web.evaluateJavascript("window.sainiBack && window.sainiBack()", null); }
    @Override public void onSensorChanged(SensorEvent event) {
        if (!active || event.timestamp - lastSensor < 33000000) return;
        lastSensor = event.timestamp;
        int rotation = getWindowManager().getDefaultDisplay().getRotation();
        float tilt = (rotation == Surface.ROTATION_270 ? -1 : 1) * event.values[1] / 5.5f;
        web.evaluateJavascript("window.sainiTilt && window.sainiTilt(" + tilt + ")", null);
    }
    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
    private class NativeBridge {
        @JavascriptInterface public boolean hasTilt() { return accelerometer != null; }
        @JavascriptInterface public void vibrate(int milliseconds) {
            Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) v.vibrate(VibrationEffect.createOneShot(Math.min(100, Math.max(1, milliseconds)), VibrationEffect.DEFAULT_AMPLITUDE));
        }
    }
}
