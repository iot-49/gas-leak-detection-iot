// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const GasReading = require('./models/GasReading');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALERT_THRESHOLD = Number(process.env.ALERT_THRESHOLD || 400);

// Telegram bot (optional)
let bot = null;
if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  // We don't need polling because we only send messages from the server.
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
  console.log('Telegram bot configured.');
} else {
  console.log('Telegram not configured — will skip alerts.');
}

// Connect to MongoDB
mongoose.connect(MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(err => console.error('MongoDB error', err));

// API: receive reading from ESP8266 (POST JSON { value })
app.post('/api/gas', async (req, res) => {
  try {
    const { value } = req.body;
    if (typeof value !== 'number') return res.status(400).json({ error: 'value required (number)' });

    const reading = await GasReading.create({ value });

    // emit to dashboard clients via socket.io
    io.emit('new-reading', { value: reading.value, timestamp: reading.timestamp });

    // check threshold and send telegram alert
    if (value >= ALERT_THRESHOLD && bot) {
      const text = `⚠️ *Gas Alert*\nValue: ${value}\nTime: ${new Date(reading.timestamp).toLocaleString()}`;
      bot.sendMessage(TELEGRAM_CHAT_ID, text, { parse_mode: 'Markdown' }).catch(err => console.error('Telegram send error', err));
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// API: get recent readings
app.get('/api/gas', async (req, res) => {
  const limit = Number(req.query.limit || 50);
  const readings = await GasReading.find().sort({ timestamp: -1 }).limit(limit);
  res.json(readings);
});

// Socket connection logging
io.on('connection', socket => {
  console.log('Dashboard client connected', socket.id);
  socket.on('disconnect', () => console.log('Dashboard client disconnected', socket.id));
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
