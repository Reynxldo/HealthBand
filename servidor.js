const mqtt = require('mqtt');
const express = require('express');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
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

// Base de datos
const db = new sqlite3.Database('./healthband.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS lecturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bpm REAL,
    spo2 REAL,
    temperatura REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS alertas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Express
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API para obtener historial
app.get('/api/historial', (req, res) => {
  db.all('SELECT * FROM lecturas ORDER BY timestamp DESC LIMIT 50', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/alertas', (req, res) => {
  db.all('SELECT * FROM alertas ORDER BY timestamp DESC LIMIT 20', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Servidor HTTP
const server = app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
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
    db.run('INSERT INTO alertas (tipo) VALUES (?)', [alerta]);
    broadcast({ tipo: 'alerta', mensaje: alerta });
    enviarTelegram(`⚠️ <b>Alerta VitalCore</b>\n\n<b>${alerta}</b>\n\nBPM: ${ultimosDatos.bpm}\nSpO2: ${ultimosDatos.spo2}%\nTemp: ${ultimosDatos.temperatura}°C`);
    return;
  }

  if (ultimosDatos.bpm > 0 && ultimosDatos.spo2 > 0 && ultimosDatos.temperatura > 0) {
    db.run(
      'INSERT INTO lecturas (bpm, spo2, temperatura) VALUES (?, ?, ?)',
      [ultimosDatos.bpm, ultimosDatos.spo2, ultimosDatos.temperatura]
    );
  }

  broadcast({ tipo: 'datos', ...ultimosDatos });
});

mqttClient.on('error', (err) => {
  console.error('Error MQTT:', err.message);
});

// Prueba inmediata al arrancar
setTimeout(() => {
  enviarTelegram('🧪 Prueba VitalCore — bot funcionando');
}, 3000);