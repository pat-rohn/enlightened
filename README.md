# Enlightened
Small project to configure and control ESP32/ESP8266 using HTTP. Compatible with [esp-enlightened](https://github.com/pat-rohn/esp-enlightened). Uses Angular and Ionic with Capacitor.

## Features
 - Configure ESP over WiFi (WiFi credentials, used pin etc.)
 - Control LED's using ws28xx protocol
 - Sunrise alarm with button inputs
 - Reading different sensors and send values to a [edge-server/backend](https://github.com/pat-rohn/go-iotedge)

![alt text](https://raw.githubusercontent.com/pat-rohn/enlightened/main/example-settings.png)
![alt text](https://raw.githubusercontent.com/pat-rohn/enlightened/main/example-led-control.png)
![alt text](https://raw.githubusercontent.com/pat-rohn/enlightened/main/example-alarm.png)

## Get started

Install dependencies:
```bash
npm install
```

Reference: [Ionic with Capacitor](https://capacitorjs.com/docs/getting-started/with-ionic)

### Develop
```bash
ng serve
```

### Open in Android Studio
```bash
npm run build && npx cap sync
npx cap open android
```

### Build APK in Android Studio

- Allow HTTP in `AndroidManifest.xml`:
```xml
<application
    ...
    android:usesCleartextTraffic="true">
</application>
```

- Optional: change the launcher icon (source: `icon.xcf`, export as 1024×1024 `icon.png`)
    - Right-click `app/src/main/res` → New → Image Asset
    - Choose file for foreground layer and a color for background layer
    - Click Next and Finish

- Navigate to Build → Build Bundle(s)/APK(s) → Build APK(s)
