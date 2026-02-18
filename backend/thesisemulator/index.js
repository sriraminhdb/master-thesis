const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Import routes
const oauth = require('./routes/oauth');
const smarthome = require('./routes/smarthome');
const metrics = require('./routes/metrics');

// Register routes
app.use('/oauth', oauth);
app.use('/smarthome', smarthome);
app.use('/metrics', metrics);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ThesisEmulator Smart Home API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Export as Firebase Function
exports.api = functions.https.onRequest(app);