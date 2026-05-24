#include <Wire.h>
#include <Adafruit_MLX90614.h>

Adafruit_MLX90614 mlx = Adafruit_MLX90614();

// Offset de calibración - ajusta este valor según tus pruebas
float offset = 0.0;

void setup() {
  Serial.begin(115200);
  if (!mlx.begin()) {
    Serial.println("Error: No se identifica o se desconectó el MLX90614");
    while (1);
  }
  Serial.println("MLX90614 detectado");
  Serial.println("Distancia ideal: 1-2 cm de la muñeca");
}

void loop() {
  float tempAmbiente = mlx.readAmbientTempC();
  float tempObjeto = mlx.readObjectTempC() + offset;

  Serial.print("Ambiente: ");
  Serial.print(tempAmbiente, 1);
  Serial.print(" °C  |  Objeto: ");
  Serial.print(tempObjeto, 1);
  Serial.print(" °C");

  // Indicador visual en el monitor serie
  if (tempObjeto < 32.0) {
    Serial.println("  → Sin contacto o muy lejos");
  } else if (tempObjeto >= 32.0 && tempObjeto <= 37.5) {
    Serial.println("  → Rango normal");
  } else if (tempObjeto > 37.5) {
    Serial.println("  → Elevada");
  }

  delay(500);
}