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