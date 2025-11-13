// models/GasReading.js
const mongoose = require('mongoose');

// Define a schema for gas readings
const gasSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Export the model
module.exports = mongoose.model('GasReading', gasSchema);
