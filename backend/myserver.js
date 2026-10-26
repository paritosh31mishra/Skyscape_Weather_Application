require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }));
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/weather', require('./routes/weather'));
app.get('/', (req, res) => res.json({ message: 'Weather API is running' }));

const port = process.env.PORT || 5557;
const mongoUrl = process.env.MONGODB_URI;
if (!mongoUrl) {
  console.error('Set MONGODB_URI in backend/.env before starting the server.');
  process.exit(1);
}

mongoose.connect(mongoUrl)
  .then(() => app.listen(port, () => console.log(`Weather API listening on port ${port}`)))
  .catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
