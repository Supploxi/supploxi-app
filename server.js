const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// CONFIG
// =============================================

const TRACK17_API_KEY = process.env.TRACK17_API_KEY || '7BD934C7225858A7C06EBA621E026BEB';
const TRACK17_BASE = 'https://api.17track.net/track/v2.2';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmlnwcclgufxjkklqntl.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbG53Y2NsZ3VmeGpra2xxbnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzk3MDgsImV4cCI6MjA4Nzk1NTcwOH0.8z2qgjtqUJpd0qrG7DmFPHGokvU-73iyFMwrF3IXML4';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;

// Admin client for auto-sync job (requires service role key)
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// =============================================
// 17TRACK STATUS MAPPING
// =============================================

// 17Track status codes → Supploxi statuses
const STATUS_CODE_MAP = {
  0: 'processing',        // NotFound
  10: 'in transit',       // InTransit
  20: 'exception',        // Expired
  30: 'in transit',       // PickedUp
  35: 'exception',        // Undelivered
  40: 'delivered',        // Delivered
  50: 'exception',        // Alert/Returning
};

// Carrier name → 17Track carrier code (0 = auto-detect)
const CARRIER_CODE_MAP = {
  'FedEx': 100003,
  'UPS': 100002,
  'DHL': 100001,
  'USPS': 21051,
  'China Post': 3011,
  'YunExpress': 190012,
  '4PX': 190001,
};

// =============================================
// HELPERS
// =============================================

function createUserClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

function mapTrackStatus(track) {
  if (!track) return 'processing';
  const code = track.e;
  let status = STATUS_CODE_MAP[code] || 'processing';

  // Refine "in transit" based on latest event description
  if (code === 10 && track.z0 && track.z0.b) {
    const desc = track.z0.b.toLowerCase();
    if (desc.includes('out for delivery') || desc.includes('delivering')) {
      status = 'out for delivery';
    } else if (desc.includes('customs') || desc.includes('clearance')) {
      status = 'customs';
    }
  }

  return status;
}

function extractEvents(track) {
  if (!track || !track.z1 || !Array.isArray(track.z1)) return [];
  return track.z1.map(ev => ({
    event_date: ev.a || null,
    description: ev.b || 'Status update',
    location: ev.c || null,
  }));
}

async function call17Track(endpoint, body) {
  const res = await fetch(`${TRACK17_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      '17token': TRACK17_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Process tracking data and update Supabase for a list of shipments
async function syncShipments(supabase, shipments) {
  if (!shipments || shipments.length === 0) return { synced: 0, results: [] };

  const numbers = shipments.map(s => ({ number: s.tracking_number }));
  const trackResponse = await call17Track('/gettrackinfo', numbers);

  const results = [];
  let synced = 0;

  if (trackResponse.code !== 0 || !trackResponse.data) {
    return { synced: 0, results: [], error: trackResponse.message || 'API error' };
  }

  const accepted = trackResponse.data.accepted || [];

  for (const item of accepted) {
    const shipment = shipments.find(s => s.tracking_number === item.number);
    if (!shipment) continue;

    const track = item.track;
    const newStatus = mapTrackStatus(track);
    const events = extractEvents(track);

    // Update shipment status and timestamp
    const updateData = {
      last_tracking_update: new Date().toISOString(),
    };

    // Only update status if it has progressed (don't go backwards)
    const statusOrder = ['processing', 'in transit', 'customs', 'out for delivery', 'delivered', 'exception'];
    const currentIdx = statusOrder.indexOf((shipment.status || '').toLowerCase());
    const newIdx = statusOrder.indexOf(newStatus);

    if (newStatus === 'exception' || (newIdx > currentIdx && currentIdx < 4)) {
      updateData.status = newStatus;

      if (newStatus === 'delivered') {
        updateData.actual_arrival = new Date().toISOString().split('T')[0];
      }
    }

    await supabase
      .from('shipments')
      .update(updateData)
      .eq('id', shipment.id);

    // Replace 17track events (keep manual ones)
    await supabase
      .from('tracking_events')
      .delete()
      .eq('shipment_id', shipment.id)
      .eq('source', '17track');

    if (events.length > 0) {
      const eventRows = events.map(ev => ({
        shipment_id: shipment.id,
        event_date: ev.event_date,
        description: ev.description,
        location: ev.location,
        status: newStatus,
        source: '17track',
      }));

      await supabase.from('tracking_events').insert(eventRows);
    }

    synced++;
    results.push({
      tracking_number: item.number,
      status: updateData.status || shipment.status,
      events_count: events.length,
    });
  }

  return { synced, results };
}

// =============================================
// MIDDLEWARE
// =============================================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// =============================================
// ROUTES
// =============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', tracking: '17track-enabled' });
});

// --- Register tracking number on 17Track ---
app.post('/api/tracking/register', async (req, res) => {
  try {
    const { tracking_number, carrier } = req.body;
    if (!tracking_number) {
      return res.status(400).json({ error: 'tracking_number is required' });
    }

    const carrierCode = CARRIER_CODE_MAP[carrier] || 0;
    const data = await call17Track('/register', [
      { number: tracking_number, carrier: carrierCode }
    ]);

    res.json(data);
  } catch (err) {
    console.error('[17Track Register Error]', err.message);
    res.status(500).json({ error: 'Failed to register tracking', details: err.message });
  }
});

// --- Get tracking status from 17Track ---
app.post('/api/tracking/status', async (req, res) => {
  try {
    const { tracking_numbers } = req.body;
    if (!tracking_numbers || !Array.isArray(tracking_numbers) || tracking_numbers.length === 0) {
      return res.status(400).json({ error: 'tracking_numbers array is required' });
    }

    const body = tracking_numbers.map(tn => ({ number: tn }));
    const data = await call17Track('/gettrackinfo', body);

    res.json(data);
  } catch (err) {
    console.error('[17Track Status Error]', err.message);
    res.status(500).json({ error: 'Failed to get tracking status', details: err.message });
  }
});

// --- Sync all active shipments for a user ---
app.post('/api/tracking/sync-all', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createUserClient(token);

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get all active (non-delivered) shipments with tracking
    const { data: shipments, error: shipErr } = await supabase
      .from('shipments')
      .select('id, tracking_number, carrier, status, track17_registered')
      .eq('user_id', user.id)
      .eq('track17_registered', true)
      .neq('status', 'delivered');

    if (shipErr) {
      return res.status(500).json({ error: 'Failed to fetch shipments', details: shipErr.message });
    }

    if (!shipments || shipments.length === 0) {
      return res.json({ message: 'No active tracked shipments', synced: 0 });
    }

    const result = await syncShipments(supabase, shipments);
    res.json({ message: `Synced ${result.synced} shipments`, ...result });
  } catch (err) {
    console.error('[Sync Error]', err.message);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// --- Sync a single shipment ---
app.post('/api/tracking/sync-one', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const { shipment_id } = req.body;
    if (!shipment_id) {
      return res.status(400).json({ error: 'shipment_id is required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createUserClient(token);

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: shipment, error: shipErr } = await supabase
      .from('shipments')
      .select('id, tracking_number, carrier, status, track17_registered')
      .eq('id', shipment_id)
      .eq('user_id', user.id)
      .single();

    if (shipErr || !shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const result = await syncShipments(supabase, [shipment]);
    res.json(result);
  } catch (err) {
    console.error('[Sync One Error]', err.message);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// =============================================
// AUTO-SYNC JOB (every 6 hours)
// =============================================

const SIX_HOURS = 6 * 60 * 60 * 1000;

async function autoSyncAll() {
  if (!supabaseAdmin) {
    console.log('[Auto-Sync] Skipped — SUPABASE_SERVICE_KEY not configured');
    return;
  }

  console.log('[Auto-Sync] Starting automatic tracking sync...');

  try {
    // Get all active shipments across all users
    const { data: shipments, error } = await supabaseAdmin
      .from('shipments')
      .select('id, tracking_number, carrier, status, user_id')
      .eq('track17_registered', true)
      .neq('status', 'delivered');

    if (error || !shipments || shipments.length === 0) {
      console.log('[Auto-Sync] No active shipments to sync');
      return;
    }

    console.log(`[Auto-Sync] Syncing ${shipments.length} shipments...`);

    // Process in batches of 40 (17Track limit)
    const batchSize = 40;
    let totalSynced = 0;

    for (let i = 0; i < shipments.length; i += batchSize) {
      const batch = shipments.slice(i, i + batchSize);
      const result = await syncShipments(supabaseAdmin, batch);
      totalSynced += result.synced;
    }

    console.log(`[Auto-Sync] Complete — synced ${totalSynced} shipments`);
  } catch (err) {
    console.error('[Auto-Sync] Error:', err.message);
  }
}

setInterval(autoSyncAll, SIX_HOURS);

// =============================================
// START SERVER
// =============================================

app.listen(PORT, () => {
  console.log(`Supploxi running at http://localhost:${PORT}`);
  console.log(`17Track integration: ENABLED`);
  console.log(`Auto-sync: ${supabaseAdmin ? 'ACTIVE (every 6h)' : 'DISABLED (set SUPABASE_SERVICE_KEY to enable)'}`);

  // Run first sync 30 seconds after startup
  if (supabaseAdmin) {
    setTimeout(autoSyncAll, 30000);
  }
});
