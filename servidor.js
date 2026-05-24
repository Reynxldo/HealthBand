const mqtt = require('mqtt');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const https = require('https');

// Telegram
const TELEGRAM_TOKEN = '8899290347:AAEMvCS1Z5XmfJG5zL0dN1T7zaXwckfl9lY';
const TELEGRAM_CHAT_ID = '7004792360';

function enviarTelegram(mensaje) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(mensaje)}&parse_mode=HTML`;
  https.get(url, (res) => {
    console.log('Telegram enviado:', res.statusCode);
  }).on('error', (err) => {
    console.error('Error Telegram:', err.message);
  });
}

// Almacenamiento en memoria
const lecturas = [];
const alertas = [];

// Express
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/historial', (req, res) => {
  res.json(lecturas.slice(-50).reverse());
});

app.get('/api/alertas', (req, res) => {
  res.json(alertas.slice(-20).reverse());
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

// WebSocket
const wss = new WebSocket.Server({ server });
let ultimosDatos = { bpm: 0, spo2: 0, temperatura: 0 };

wss.on('connection', (ws) => {
  console.log('Cliente web conectado');
  ws.send(JSON.stringify({ tipo: 'datos', ...ultimosDatos }));
});

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// MQTT
const mqttClient = mqtt.connect('mqtts://561ca56c1b5a4b978b24893f8b8a49c4.s1.eu.hivemq.cloud', {
  port: 8883,
  username: 'Caozinho369',
  password: 'Yrc5P@bmFgEUEbD',
  rejectUnauthorized: false
});

mqttClient.on('connect', () => {
  console.log('Conectado a HiveMQ');
  mqttClient.subscribe('pulsera/#');
});

mqttClient.on('message', (topic, message) => {
  const valor = parseFloat(message.toString());
  console.log(`${topic}: ${valor}`);

  if (topic === 'pulsera/bpm')         ultimosDatos.bpm = valor;
  if (topic === 'pulsera/spo2')        ultimosDatos.spo2 = valor;
  if (topic === 'pulsera/temperatura') ultimosDatos.temperatura = valor;

  if (topic === 'pulsera/alerta') {
    const alerta = message.toString();
    alertas.push({ tipo: alerta, timestamp: new Date().toISOString() });
    broadcast({ tipo: 'alerta', mensaje: alerta });
    enviarTelegram(`⚠️ <b>Alerta VitalCore</b>\n\n<b>${alerta}</b>\n\nBPM: ${ultimosDatos.bpm}\nSpO2: ${ultimosDatos.spo2}%\nTemp: ${ultimosDatos.temperatura}°C`);
    return;
  }

  if (ultimosDatos.bpm > 0 && ultimosDatos.spo2 > 0 && ultimosDatos.temperatura > 0) {
    lecturas.push({
      bpm: ultimosDatos.bpm,
      spo2: ultimosDatos.spo2,
      temperatura: ultimosDatos.temperatura,
      timestamp: new Date().toISOString()
    });
    if (lecturas.length > 500) lecturas.shift();
  }

  broadcast({ tipo: 'datos', ...ultimosDatos });
});

mqttClient.on('error', (err) => {
  console.error('Error MQTT:', err.message);
});