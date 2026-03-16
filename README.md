# Smart Home Integration with Google Assistant

> **Master's Thesis Project:** Connecting Smart Home Devices to Google Assistant using Firebase, OAuth 2.0, and Home Graph API

**Student:** Natarajan, Sriramkumar Raja | **Matriculation ID:** 11038532  
**Institution:** SRH Hochschule Heidelberg | **Program:** M.Sc. Applied Computer Science  
**Supervisors:** Prof. Dr. Kamellia Reshadi, Prof. Dr. Gerd Moeckel

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Google Assistant                      │
│              (Natural Language Interface)                │
└────────────────────┬─────────────────────────────────────┘
                     │ Voice Commands
                     │ "Turn on the light"
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  Home Graph API                          │
│        (Google's Smart Home Integration Layer)           │
│                                                          │
│  Intents: SYNC | QUERY | EXECUTE                         │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS POST + OAuth 2.0
                     ▼
┌──────────────────────────────────────────────────────────┐
│         Firebase Cloud Functions (Node.js 18)            │
│  ┌────────────────┬──────────────────┬─────────────┐     │
│  │   OAuth 2.0    │  Smart Home      │  Metrics    │     │
│  │   Server       │  Intent Handler  │  Collector  │     │
│  │                │                  │             │     │
│  │ • Authorize    │ • SYNC           │ • Response  │     │
│  │ • Token        │ • QUERY          │ • Time      │     │
│  │ • Refresh      │ • EXECUTE        │ • Errors    │     │
│  └────────────────┴──────────────────┴─────────────┘     │
└────────────────────┬─────────────────┬───────────────────┘
                     │                 │
        ┌────────────┴──────┐    ┌────┴──────────────┐
        ▼                   ▼    ▼                   ▼
┌──────────────┐    ┌──────────────────────┐  ┌─────────────┐
│  Firestore   │    │ Realtime Database    │  │  Home Graph │
│              │    │                      │  │  Report API │
│ • OAuth      │    │ • Device State       │  │             │
│   Tokens     │    │ • Real-time Updates  │  │ • Proactive │
│ • Metrics    │    │ • ESP8266 Commands   │  │   Updates   │
└──────────────┘    └──────────┬───────────┘  └─────────────┘
                               │
                               │ Poll every 2 seconds
                               ▼
                    ┌──────────────────────┐
                    │   ESP8266 (Optional) │
                    │   Physical Hardware  │
                    │   • RGB LED Strip    │
                    │   • WiFi Connection  │
                    └──────────────────────┘
```

---

## Features

- **Voice Control:** Natural language commands via Google Assistant
- **Secure Authentication:** OAuth 2.0 authorization code flow
- **Real-time State Sync:** Bidirectional device state updates
- **Performance Monitoring:** Automatic metrics collection (response time, success rate)
- **Live Dashboard:** Interactive visualization with Chart.js
- **Data Export:** CSV export for analysis
- **Hardware Integration:** ESP8266 support for physical devices
- **Fast Response:** Average 596ms (70% better than 2s requirement)
- **Highly Reliable:** 99.4% success rate across 1650+ commands

---

## Component Descriptions

### Google Assistant
User-facing voice interface with natural language processing. Handles voice commands and converts them to structured Home Graph API requests.

### Home Graph API
Google's smart home platform that manages device discovery, state queries, and command execution. Provides the integration layer between Google Assistant and your smart home backend.

### Firebase Cloud Functions
Serverless Node.js backend that handles:
- **OAuth 2.0 Server:** Authorization and token management
- **Intent Handler:** SYNC (device discovery), QUERY (state retrieval), EXECUTE (command processing)
- **Metrics Collector:** Performance tracking and analytics

### Firestore
NoSQL database for:
- OAuth tokens (authorization codes, access/refresh tokens)
- Command metrics (response times, success/failure tracking)
- Daily aggregated statistics

**Why Firestore:** Complex queries, composite indexes, structured data storage

### Firebase Realtime Database
Low-latency key-value store for:
- Real-time device state (lights, washers, outlets, switches, energy manager)
- Hardware communication (ESP8266 polling commands)

**Why Realtime DB:** Sub-100ms updates, perfect for device state synchronization

### Home Graph Report API
Allows proactive state updates to Google Assistant when device state changes independent of voice commands.

### ESP8266 (Optional)
WiFi-enabled microcontroller for physical hardware integration:
- Connects to Firebase Realtime Database
- Polls for commands every 2 seconds
- Controls RGB LED strip based on cloud commands

---

## Technology Stack

### Backend
- **Firebase Cloud Functions** (Node.js 18) - Serverless compute
- **Cloud Firestore** - NoSQL database for OAuth and metrics
- **Firebase Realtime Database** - Real-time device state
- **Express.js 4.18** - HTTP routing framework
- **Google Home Graph API** - Smart home integration
- **OAuth 2.0** - Secure authentication

### Frontend
- **React 18.2** - Dashboard UI
- **Chart.js 4.4** - Data visualization
- **GitHub Pages** - Dashboard hosting

### Hardware (Optional)
- **ESP8266 NodeMCU** - WiFi microcontroller
- **Arduino IDE** - Firmware development
- **Firebase ESP8266 Library** - Database connectivity

### DevOps
- **Firebase CLI** - Deployment and management
- **Git/GitHub** - Version control
- **VS Code** - Development environment

---

## Devices Implemented

### 1. RGB Smart Light (`light-1`)

**Traits:** OnOff, Brightness, ColorSetting  
**Response Time:** 497ms average  
**Success Rate:** 99.2%

**Voice Commands:**
```
"Hey Google, turn on the living room light"
"Set brightness to 50%"
"Make the light red"
"Change the light to blue"
```

**Features:**
- RGB color control (24-bit spectrum: 0-16777215)
- Brightness: 0-100%
- Hardware support (ESP8266 + RGB LED)

---

### 2. Smart Washer (`washer-1`)

**Traits:** OnOff, StartStop, Modes, Toggles  
**Response Time:** 289ms average  
**Success Rate:** 98.5%

**Voice Commands:**
```
"Turn on the washer"
"Start the washer"
"Set washer to small load"
"Enable extra rinse"
```

**Modes:**
- Load size: Small (eco), Medium (cotton), Large (delicates)

**Toggles:**
- Child lock
- Extra rinse

---

### 3. Smart Outlet (`outlet-1`)

**Traits:** OnOff  
**Response Time:** 270ms average  
**Success Rate:** 100%

**Voice Commands:**
```
"Turn on the outlet"
"Turn off the plug"
```

**Characteristics:**
- Simplest device
- Fastest response times
- Perfect success rate

---

### 4. Smart Switch (`switch-1`)

**Traits:** OnOff  
**Response Time:** 270ms average  
**Success Rate:** 100%

**Voice Commands:**
```
"Turn on the switch"
"Turn off the wall switch"
```

---

### 5. Energy Manager (`energy-manager-1`)

**Traits:** OnOff, Modes, SensorState, EnergyStorage  
**Response Time:** 280ms average  
**Success Rate:** 99.5%

**Voice Commands:**
```
"Turn on the energy manager"
"Set power mode to solar"
"What's the battery level?"
```

**Power Modes:**
- Auto (intelligent switching)
- Grid (utility power)
- Solar (solar panels)
- Battery (stored energy)

**Sensor States:**
- Power source (grid/solar/battery/hybrid)
- Solar generation (0-10 kW)
- Battery level (0-100%)
- Monthly savings ($0-500)

---

## Prerequisites

### Required

**Software:**
- Node.js 18 or higher ([Download](https://nodejs.org/))
- Firebase CLI: `npm install -g firebase-tools`
- Git (for version control)

**Accounts:**
- Google Cloud account with billing enabled ([Sign up](https://cloud.google.com/))
- Firebase project created ([Console](https://console.firebase.google.com/))
- Google Actions Console project ([Console](https://console.actions.google.com/))

**Credentials:**
- OAuth client ID and secret
- Firebase service account key (JSON file)

### Optional (Hardware Integration)

**Hardware:**
- ESP8266 NodeMCU board ([Buy](https://www.amazon.com/s?k=esp8266+nodemcu))
- RGB LED strip or individual RGB LED
- Jumper wires
- Breadboard
- USB cable (micro-USB for ESP8266)

**Software:**
- Arduino IDE 1.8+ ([Download](https://www.arduino.cc/en/software))
- ESP8266 board package for Arduino
- Firebase ESP8266 library

---

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/smart-home-thesis.git
cd smart-home-thesis/packages/backend/thesisemulator
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Firebase

```bash
# Login to Firebase
firebase login

# Select your project
firebase use --add
# Enter your project ID when prompted
```

### Step 4: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file as `service-account-key.json` in the project root
6. **Important:** Add to `.gitignore` to avoid committing credentials

### Step 5: Configure OAuth Credentials

Edit `lib/tokenStore.js`:

```javascript
const CLIENT_ID = 'your-google-actions-client-id';
const CLIENT_SECRET = 'your-google-actions-client-secret';
```

**Note:** You'll get these from Google Actions Console in the next section.

### Step 6: Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

Wait for indexes to build (check Firebase Console).

### Step 7: Deploy Cloud Functions

```bash
firebase deploy --only functions
```

**Deployment time:** 3-5 minutes

**Expected output:**
```
✔ Deploy complete!

Functions:
  api(us-central1): https://us-central1-YOUR_PROJECT.cloudfunctions.net/api
```

**Copy the function URL** - you'll need it for Google Actions setup.

---

## Google Actions Console Setup

### Step 1: Create Smart Home Action

1. Go to [Google Actions Console](https://console.actions.google.com/)
2. Click **New Project** or select existing project
3. Choose **Smart Home** as action type
4. Fill in display information (name, description, icon)

### Step 2: Configure Account Linking (OAuth 2.0)

Navigate to **Account Linking** section:

**Client Information:**
```
Client ID: your-client-id
Client Secret: your-client-secret
```

**Authorization URL:**
```
https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/oauth/authorize
```

**Token URL:**
```
https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/oauth/token
```

**Scopes (optional):**
```
smart_home
```

**Configure your client:**
- Select **Confidential** client type
- Leave **Grant type** as default (Authorization code)

### Step 3: Set Fulfillment URL

Navigate to **Actions** → **Smart Home** → **Fulfillment**:

```
https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/smarthome
```

### Step 4: Test Your Action

**On your phone or Google Home:**

```
"Hey Google, sync my devices"
```

**Expected response:**
```
"Okay, syncing [Your Action Name]"
```

**Then try:**
```
"Turn on the living room light"
"Set brightness to 50%"
"Make the light red"
```

### Step 5: Link Your Account

1. Open **Google Home app** on your phone
2. Tap **Settings** → **Works with Google**
3. Search for your action name
4. Tap to link account
5. Sign in (OAuth flow will redirect to your function)
6. Authorize access

**Devices should now appear in Google Home app!**

---

## Arduino/ESP8266 Setup

This section enables physical RGB LED control via Google Assistant.

### Hardware Requirements

- ESP8266 NodeMCU
- RGB LED (common cathode) or RGB LED strip
- 3x 220Ω resistors (for individual LED)
- Breadboard and jumper wires

### Wiring Diagram

```
ESP8266 NodeMCU        RGB LED
─────────────────     ─────────
D1 (GPIO5)    ─────→  Red Pin
D2 (GPIO4)    ─────→  Green Pin
D3 (GPIO0)    ─────→  Blue Pin
GND           ─────→  GND (common cathode)
```

**Note:** Use 220Ω resistors in series with each color pin.

### Arduino IDE Setup

**Step 1: Install ESP8266 Board**

1. Open Arduino IDE
2. Go to **File** → **Preferences**
3. Add to **Additional Board Manager URLs:**
   ```
   http://arduino.esp8266.com/stable/package_esp8266com_index.json
   ```
4. Go to **Tools** → **Board** → **Boards Manager**
5. Search for "ESP8266"
6. Install **ESP8266 by ESP8266 Community**

**Step 2: Install Firebase Library**

1. Go to **Sketch** → **Include Library** → **Manage Libraries**
2. Search for "Firebase ESP8266"
3. Install **Firebase Arduino Client Library for ESP8266** by Mobizt

**Step 3: Select Board**

1. Go to **Tools** → **Board** → **ESP8266 Boards**
2. Select **NodeMCU 1.0 (ESP-12E Module)**
3. Set **Upload Speed:** 115200

### Upload Firmware

**Step 1: Download Arduino Code**

Create a file `smart_light.ino`:

```cpp
#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>

// WiFi credentials
#define WIFI_SSID "Your_WiFi_Name"
#define WIFI_PASSWORD "Your_WiFi_Password"

// Firebase credentials
#define FIREBASE_HOST "YOUR_PROJECT.firebaseio.com"
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET"

// LED pins
#define RED_PIN D1
#define GREEN_PIN D2
#define BLUE_PIN D3

FirebaseData firebaseData;

void setup() {
  Serial.begin(115200);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  
  // Initialize Firebase
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Serial.println("Firebase connected!");
}

void loop() {
  // Poll for commands every 2 seconds
  if (Firebase.getJSON(firebaseData, "/hardware/light-1")) {
    
    if (firebaseData.dataType() == "json") {
      FirebaseJson &json = firebaseData.jsonObject();
      FirebaseJsonData result;
      
      // Get 'on' state
      json.get(result, "on");
      bool lightOn = result.boolValue;
      
      if (lightOn) {
        // Get brightness
        json.get(result, "brightness");
        int brightness = result.intValue;
        
        // Get color
        json.get(result, "color/rgb");
        int rgb = result.intValue;
        
        // Extract RGB components
        int red = (rgb >> 16) & 0xFF;
        int green = (rgb >> 8) & 0xFF;
        int blue = rgb & 0xFF;
        
        // Apply brightness
        red = (red * brightness) / 100;
        green = (green * brightness) / 100;
        blue = (blue * brightness) / 100;
        
        // Set LED
        analogWrite(RED_PIN, red);
        analogWrite(GREEN_PIN, green);
        analogWrite(BLUE_PIN, blue);
        
        Serial.printf("LED ON - R:%d G:%d B:%d\n", red, green, blue);
      } else {
        // Turn off
        analogWrite(RED_PIN, 0);
        analogWrite(GREEN_PIN, 0);
        analogWrite(BLUE_PIN, 0);
        Serial.println("LED OFF");
      }
    }
  }
  
  delay(2000);  // Poll every 2 seconds
}
```

**Step 2: Configure Credentials**

Edit these lines in the code:

```cpp
#define WIFI_SSID "Your_WiFi_Name"           // Your WiFi network name
#define WIFI_PASSWORD "Your_WiFi_Password"   // Your WiFi password
#define FIREBASE_HOST "YOUR_PROJECT.firebaseio.com"  // From Firebase Console
#define FIREBASE_AUTH "YOUR_DATABASE_SECRET"         // From Firebase → Realtime Database → Rules
```

**Get Firebase Database Secret:**
1. Firebase Console → Realtime Database
2. Click **Rules** tab
3. Or use a legacy secret from Project Settings → Service Accounts → Database Secrets

**Step 3: Upload to ESP8266**

1. Connect ESP8266 to computer via USB
2. Select correct COM port: **Tools** → **Port**
3. Click **Upload** button (→)
4. Wait for "Done uploading"

**Step 4: Monitor Serial Output**

1. Open **Tools** → **Serial Monitor**
2. Set baud rate to **115200**
3. You should see:
   ```
   Connecting to WiFi....
   Connected!
   Firebase connected!
   ```

**Step 5: Test**

Say: `"Hey Google, turn on the living room light"`

**Expected:**
- Cloud function receives command
- Updates Firebase Realtime Database `/hardware/light-1`
- ESP8266 polls and detects change
- RGB LED lights up!

---

## Local Deployment

### Run Dashboard Locally

**Step 1: Navigate to docs folder**

```bash
cd docs
```

**Step 2: Start HTTP server**

```bash
# Using Python 3
python -m http.server 8000

# OR using Node.js
npx http-server -p 8000
```

**Step 3: Open in browser**

```
http://localhost:8000
```

**Dashboard features:**
- Auto-refresh every 30 seconds
- Response time trend (last 20 commands)
- Device distribution chart
- Per-device performance cards
- Overall statistics

---

### Test Functions Locally

**Step 1: Start Firebase Emulator**

```bash
firebase emulators:start
```

**Expected output:**
```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://localhost:4000                │
└─────────────────────────────────────────────────────────────┘

┌───────────┬────────────────┬─────────────────────────────────┐
│ Emulator  │ Host:Port      │ View in Emulator UI             │
├───────────┼────────────────┼─────────────────────────────────┤
│ Functions │ localhost:5001 │ http://localhost:4000/functions │
│ Firestore │ localhost:8080 │ http://localhost:4000/firestore │
└───────────┴────────────────┴─────────────────────────────────┘
```

**Step 2: Test endpoints**

```bash
# Test SYNC
curl -X POST http://localhost:5001/YOUR_PROJECT/us-central1/api/smarthome \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "requestId": "test-123",
    "inputs": [{
      "intent": "action.devices.SYNC"
    }]
  }'

# Test metrics
curl http://localhost:5001/YOUR_PROJECT/us-central1/api/metrics/summary
```

---

### View Live Logs

**Firebase Functions logs:**

```bash
# Watch logs in real-time
firebase functions:log --only api

# Filter by time
firebase functions:log --only api --since 1h
```

**Expected output:**
```
2026-03-04 06:34:50.707 === SMARTHOME REQUEST ===
2026-03-04 06:34:50.967 Processing intent: action.devices.EXECUTE
2026-03-04 06:34:52.868 [Metrics] Logged: OnOff for light-1 - 624ms - SUCCESS
```

---

## Next Steps

After completing setup:

1. **Test all devices** - Try voice commands for each device type
2. **Monitor metrics** - Check dashboard for performance data
3. **Export data** - Use CSV export for analysis
4. **Hardware integration** - Connect ESP8266 for physical control (optional)
5. **User testing** - Collect usability data for thesis

---

## Support

For technical issues:
1. Check Firebase Console logs
2. Verify credentials in configuration files
3. Test with Firebase Emulator
4. Review Google Actions Console test logs

---

## License

Academic thesis project - SRH Hochschule Heidelberg

**For academic review and educational purposes.**

---
