#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include "MAX30100_PulseOximeter.h"

#define PIN_LED    12
#define PIN_BUZZER 13

TwoWire I2C_MLX = TwoWire(1);

Adafruit_MLX90614 mlx = Adafruit_MLX90614();
PulseOximeter pox;

uint32_t lastReport   = 0;
uint32_t lastTempRead = 0;
uint32_t lastBuzzer   = 0;
bool buzzerActivo     = false;
bool buzzerEstado     = false;
int  buzzerContador   = 0;

float offset = 1.5;

// Promedio BPM
#define BPM_MUESTRAS 5
float bpmBuffer[BPM_MUESTRAS] = {0};
int bpmIndex = 0;
int bpmCount = 0;

#define SPO2_MINIMO   90.0
#define BPM_MAXIMO   120.0
#define TEMP_MAXIMA   37.5

void onBeatDetected() {
  Serial.println("♥ Latido");
}

void alertaBuzzer() {
  if (buzzerActivo) return;
  buzzerActivo   = true;
  buzzerEstado   = true;
  buzzerContador = 0;
  lastBuzzer     = millis();
  digitalWrite(PIN_BUZZER, HIGH);
}

void manejarBuzzer() {
  if (!buzzerActivo) return;

  uint32_t ahora = millis();

  if (buzzerEstado && ahora - lastBuzzer > 300) {
    buzzerEstado = false;
    digitalWrite(PIN_BUZZER, LOW);
    lastBuzzer = ahora;
  } else if (!buzzerEstado && ahora - lastBuzzer > 200) {
    buzzerContador++;
    if (buzzerContador >= 2) {
      buzzerActivo = false;
      buzzerEstado = false;
      digitalWrite(PIN_BUZZER, LOW);
    } else {
      buzzerEstado = true;
      digitalWrite(PIN_BUZZER, HIGH);
      lastBuzzer = ahora;
    }
  }
}

float calcularPromedioBPM() {
  if (bpmCount == 0) return 0;
  float suma = 0;
  int total = min(bpmCount, BPM_MUESTRAS);
  for (int i = 0; i < total; i++) suma += bpmBuffer[i];
  return suma / total;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(PIN_LED,    OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED,    HIGH);
  digitalWrite(PIN_BUZZER, LOW);

  Wire.begin(21, 22);
  Wire.setClock(100000);

  if (!pox.begin()) {
    Serial.println("Error: MAX30100 no detectado");
    while (1);
  }
  pox.setIRLedCurrent(MAX30100_LED_CURR_27_1MA);
  pox.setOnBeatDetectedCallback(onBeatDetected);
  Serial.println("MAX30100 OK");

  delay(500);

  I2C_MLX.begin(25, 26);
  I2C_MLX.setClock(100000);

  if (!mlx.begin(0x5A, &I2C_MLX)) {
    Serial.println("Error: MLX90614 no detectado");
    while (1);
  }
  Serial.println("MLX90614 OK");

  Serial.println("Sistema listo");
  Serial.println("------------------------");
}

void loop() {
  pox.update();
  manejarBuzzer();

  if (millis() - lastReport > 1000) {
    float bpm  = pox.getHeartRate();
    float spo2 = pox.getSpO2();

    if (bpm >= 40 && bpm <= 180) {
      bpmBuffer[bpmIndex] = bpm;
      bpmIndex = (bpmIndex + 1) % BPM_MUESTRAS;
      bpmCount++;
    }

    float bpmPromedio = calcularPromedioBPM();

    Serial.print("BPM: "); Serial.print(bpmPromedio, 1);
    Serial.print("  |  SpO2: "); Serial.print(spo2, 1); Serial.print(" %");

    if (bpm == 0) {
      Serial.println("  → Sin dedo");
      bpmCount = 0;
      bpmIndex = 0;
    } else if (bpmPromedio == 0) {
      Serial.println("  → Leyendo...");
    } else if (bpmPromedio <= BPM_MAXIMO) {
      Serial.println("  → Normal");
    } else {
      Serial.println("  → BPM elevado ⚠");
      alertaBuzzer();
    }

    if (spo2 > 0 && spo2 < SPO2_MINIMO) {
      Serial.println("  → SpO2 crítico ⚠");
      alertaBuzzer();
    }

    lastReport = millis();
  }

  if (millis() - lastTempRead > 2000) {
    float temp = mlx.readObjectTempC() + offset;

    Serial.print("Temperatura: "); Serial.print(temp, 1); Serial.print(" °C");

    if (temp < 34.0) {
      Serial.println("  → Sin contacto");
    } else if (temp <= TEMP_MAXIMA) {
      Serial.println("  → Normal");
    } else {
      Serial.println("  → Temperatura elevada ⚠");
      alertaBuzzer();
    }

    lastTempRead = millis();
  }

  pox.update();
}