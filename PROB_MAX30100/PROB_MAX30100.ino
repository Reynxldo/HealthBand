#include <Wire.h>
#include "MAX30100_PulseOximeter.h"

PulseOximeter pox;
uint32_t lastReport = 0;

void onBeatDetected() {
  Serial.println("Latido detectado");
}

void setup() {
  Serial.begin(115200);
  Serial.println("Iniciando MAX30100...");

  Wire.begin(21, 22);
  Wire.setClock(100000);

  if (!pox.begin()) {
    Serial.println("Error: no se detectó el MAX30100");
    while (1);
  }

  pox.setIRLedCurrent(MAX30100_LED_CURR_7_6MA);
  pox.setOnBeatDetectedCallback(onBeatDetected);
  Serial.println("MAX30100 listo — coloca el dedo sobre el sensor");
}

void loop() {
  pox.update();

  if (millis() - lastReport > 1000) {
    float bpm = pox.getHeartRate();
    float spo2 = pox.getSpO2();

    Serial.print("BPM: ");
    Serial.print(bpm, 1);
    Serial.print("  |  SpO2: ");
    Serial.print(spo2, 1);
    Serial.println(" %");

    if (bpm < 40 || bpm == 0) {
      Serial.println("  → Sin dedo o señal débil");
    } else if (bpm >= 40 && bpm <= 120) {
      Serial.println("  → Rango normal");
    } else {
      Serial.println("  → Ritmo elevado");
    }

    lastReport = millis();
  }
}