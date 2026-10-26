const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  city: { type: String, required: true },
  temperature: { type: Number, required: true },
  condition: { type: String, default: '' },
  recordedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WeatherHistory', historySchema);
