const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const TRACK17_API_KEY = '7BD934C7225858A7C06EBA621E026BEB';
const TRACK17_BASE = 'https://api.17track.net/track/v2.2';

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// ROUTES
// =============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), version: '2.0' });
});

// Register tracking number on 17Track
app.post('/api/tracking/register', async (req, res) => {
  try {
    const { tracking_number, carrier_code } = req.body;

    if (!tracking_number) {
      return res.status(400).json({ error: 'tracking_number is required' });
    }

    const response = await fetch(`${TRACK17_BASE}/register`, {
      method: 'POST',
      headers: {
        '17token': TRACK17_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        { number: tracking_number, carrier: carrier_code || 0 }
      ]),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[17Track Register]', err.message);
    res.status(500).json({ error: 'Failed to register tracking', details: err.message });
  }
});

// Get tracking info from 17Track
app.post('/api/tracking/getinfo', async (req, res) => {
  try {
    const { numbers } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'numbers array is required' });
    }

    const body = numbers.map(n => ({ number: n }));

    const response = await fetch(`${TRACK17_BASE}/gettrackinfo`, {
      method: 'POST',
      headers: {
        '17token': TRACK17_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[17Track GetInfo]', err.message);
    res.status(500).json({ error: 'Failed to get tracking info', details: err.message });
  }
});

// =============================================
// AUTO-SYNC JOB (every 6 hours)
// =============================================
const SIX_HOURS = 6 * 60 * 60 * 1000;

setInterval(() => {
  console.log('[17Track Sync] Running scheduled sync...');
  // Sync logic will be added in a future part
}, SIX_HOURS);

// =============================================
// HTML PAGE ROUTES
// =============================================

// Serve todas as páginas HTML
const pages = ['dashboard','onboarding','suppliers','suppliers-detail','products',
  'purchase-orders','po-detail','shipments','shipment-detail',
  'inventory','financials','tariffs','integrations','settings','reports']

pages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`))
  })
})

// Redirect raiz para index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log(`Supploxi v2 running at http://localhost:${PORT}`);
  console.log('17Track integration: ENABLED');
  console.log(`Auto-sync scheduled every 6 hours`);
});
