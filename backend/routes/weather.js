const express = require('express');
const auth = require('../middleware/auth');
const WeatherHistory = require('../schema/weatherhistoryschema');

const router = express.Router();
router.use(auth);

router.post('/', async (req, res) => {
  try {
    const { city, temperature, condition } = req.body;
    if (!city || typeof temperature !== 'number') return res.status(400).json({ message: 'City and temperature are required.' });
    const record = await WeatherHistory.create({ user: req.userId, city, temperature, condition });
    return res.status(201).json({ record });
  } catch (error) {
    return res.status(500).json({ message: 'Could not save weather history.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const records = await WeatherHistory.find({ user: req.userId }).sort({ recordedAt: -1 }).limit(50);
    return res.json({ records });
  } catch (error) {
    return res.status(500).json({ message: 'Could not load weather history.' });
  }
});

module.exports = router;
