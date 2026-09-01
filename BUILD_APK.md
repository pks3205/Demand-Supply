# 📦 Android APK Build — Step-by-Step

यह गाइड वर्कफ़्लो से **Sabzi Mandi का APK** बनाने के लिए है।

## पहले से तैयार है (पुश किया हुआ)

Remote branch `arena/01a05c8b-demand-supply` पर यह सब मौजूद है:

- ✅ पूरा game (`src/`, `index.html`, `vite.config.js`)
- ✅ Capacitor 6 Android project (`android/`, `capacitor.config.json`)
- ✅ Web build Android-compatible (`base: "./"`)
- ✅ NPM scripts (`build`, `build:apk`)

## वर्कफ़्लो फ़ाइल कहाँ है?

📄 `.github/workflows/android-build.yml`

मैंने इसे Git में **push नहीं किया**, क्योंकि Arena के GitHub token के पास `workflows` permission नहीं है
(उस कारण `git push` और `gh api` दोनों `403` देते हैं)।

## वर्कफ़्लो चलाने के two तरीके

### Option A — मैं push करूँ (अगर आप permission दे दे)

GitHub App permission में **Workflows: Read & write** जोड़ें, फिर मुझे बताएँ। मैं तुरंत
`.github/workflows/android-build.yml` push कर दूँगा।

### Option B — आप खुद workflow जोड़कर चलाएँ (इसी ब्रांच पर)

1. GitHub repo → `arena/01a05c8b-demand-supply` branch खोलें।
2. **Add file → Create new file → `.github/workflows/android-build.yml`** बनाएँ।
3. नीचे दिया गया पूरा YAML paste करें और commit करें।
4. GitHub **Actions** tab → **Build Android APK** → **Run workflow** (branch: `arena/01a05c8b-demand-supply`) चुनें।
5. Build पूरा होने पर **"sabzi-mandi-debug-apk"** artifact download करें।

> ⚠️ Workflow को उसी branch पर रखें जहाँ game + android folder है, वरना checkout में app नहीं मिलेगा।

## वर्कफ़्लो यह करता है

```yaml
name: Build Android APK

on:
  push:
    branches:
      - main
      - arena/01a05c8b-demand-supply
  workflow_dispatch:

concurrency:
  group: android-build-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-apk:
    name: Build debug APK
    runs-on: ubuntu-latest

    steps:
      - name: Check out the repo
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install npm dependencies
        run: npm ci

      - name: Build the web app
        run: npm run build

      - name: Sync web assets into Capacitor Android project
        run: npx cap sync android

      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17
          cache: gradle

      - name: Build debug APK
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon --stacktrace

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: sabzi-mandi-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
```

## ⚠️ फ़ाइल को अपने हाथ से बनाते समय ध्यान रखें

- YAML में ब्रांच नाम `arena/01a05c8b-demand-supply` रखा है (app उसी branch पर है)।
- `npm run build` → `dist/` बनता है, फिर `npx cap sync android` उसे Android में कॉपी करता है।
- APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## APK कहाँ download होगा?

GitHub Action run के **Artifacts** section में **`sabzi-mandi-debug-apk`** नाम से मिलेगा।

## APK में क्या होगा?

- पूरा "सब्ज़ी मंडी" गेम (offline, बिना internet)
- 3D क्रेट चार्ट (Three.js WebGL)
- Buyer/Seller मोड, 10 स्टॉक, AI bots, timer, leaderboard

---

अगर आप चाहें तो मैं **main** branch पर एक **PR** भी खोल सकता हूँ ताकि आप उसे merge करके workflow main पर चला सकें।
