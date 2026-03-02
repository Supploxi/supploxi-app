const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const TRACK17_API_KEY = process.env.TRACKING_API_KEY || '7BD934C7225858A7C06EBA621E026BEB';
const TRACK17_BASE = 'https://api.17track.net/track/v2.2';

// =============================================
// SUPABASE (server-side, for auto-sync)
// =============================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nmlnwcclgufxjkklqntl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

let sbAdmin = null;
if (SUPABASE_SERVICE_KEY) {
  sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log('[AutoSync] Supabase admin client initialized');
} else {
  console.warn('[AutoSync] SUPABASE_SERVICE_KEY not set — auto-sync disabled');
  console.warn('[AutoSync] Set SUPABASE_SERVICE_KEY env var to enable automatic tracking updates');
}

// =============================================
// STATUS MAPPING (17Track -> Supploxi)
// =============================================
function mapTrackStatus(code, tag) {
  // Numeric codes (17Track v2.2 track.e field)
  const numericMap = {
    0: 'processing',
    10: 'in_transit',
    20: 'exception',
    30: 'in_transit',
    35: 'exception',
    40: 'delivered',
    50: 'exception',
  };
  if (typeof code === 'number' && numericMap[code] !== undefined) {
    return numericMap[code];
  }

  // String tags (track.w1 or legacy)
  const stringMap = {
    NotFound: 'processing',
    InTransit: 'in_transit',
    Delivered: 'delivered',
    Undelivered: 'exception',
    Returning: 'exception',
    Expired: 'exception',
    PickedUp: 'in_transit',
    OutForDelivery: 'out_for_delivery',
    CustomsHold: 'customs',
    Alert: 'exception',
  };
  const tagStr = tag || (typeof code === 'string' ? code : null);
  if (tagStr && stringMap[tagStr]) {
    return stringMap[tagStr];
  }

  return 'processing';
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    version: '2.1',
    autoSync: sbAdmin ? 'enabled' : 'disabled (no SUPABASE_SERVICE_KEY)',
  });
});

// Register tracking number
app.post('/api/tracking/register', async (req, res) => {
  try {
    const { tracking_number, carrier_code } = req.body;

    if (!tracking_number) {
      return res.status(400).json({ error: 'tracking_number is required' });
    }

    console.log('[Register] Registering:', tracking_number);

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
    console.log('[Register] Response code:', data?.code, '| Data:', JSON.stringify(data?.data || {}).substring(0, 200));
    res.json(data);
  } catch (err) {
    console.error('[Register] Error:', err.message);
    res.status(500).json({ error: 'Failed to register tracking', details: err.message });
  }
});

// Get tracking info (proxy with debug logging)
app.post('/api/tracking/getinfo', async (req, res) => {
  try {
    const { numbers } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'numbers array is required' });
    }

    const body = numbers.map(n => ({ number: n }));
    console.log('[GetInfo] Requesting info for:', numbers.join(', '));

    const response = await fetch(`${TRACK17_BASE}/gettrackinfo`, {
      method: 'POST',
      headers: {
        '17token': TRACK17_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Debug logging — log the full response structure
    console.log('[GetInfo] Response code:', data?.code);
    console.log('[GetInfo] Accepted:', data?.data?.accepted?.length || 0, '| Rejected:', data?.data?.rejected?.length || 0);

    if (data?.data?.accepted?.length > 0) {
      const first = data.data.accepted[0];
      const t = first.track || {};
      console.log('[GetInfo] Track keys:', Object.keys(t).join(', '));
      console.log('[GetInfo] track.e (status code):', t.e);
      console.log('[GetInfo] track.w1 (status tag):', t.w1);
      console.log('[GetInfo] track.z0 (latest event):', JSON.stringify(t.z0));
      console.log('[GetInfo] track.z1 (events count):', t.z1?.length || 0);
      if (t.z1?.length > 0) {
        console.log('[GetInfo] First event:', JSON.stringify(t.z1[0]));
      }
    }

    if (data?.data?.rejected?.length > 0) {
      console.log('[GetInfo] Rejected details:', JSON.stringify(data.data.rejected));
    }

    res.json(data);
  } catch (err) {
    console.error('[GetInfo] Error:', err.message);
    res.status(500).json({ error: 'Failed to get tracking info', details: err.message });
  }
});

// Redirect root to index
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =============================================
// AUTO-SYNC (runs every 6 hours)
// =============================================
async function autoSyncTracking() {
  if (!sbAdmin) {
    console.log('[AutoSync] Skipped — no Supabase service key configured');
    return;
  }

  console.log('[AutoSync] Starting sync cycle at', new Date().toISOString());

  try {
    // 1. Fetch all active shipments (not delivered/cancelled)
    const { data: shipments, error: fetchErr } = await sbAdmin
      .from('shipments')
      .select('id, tracking_number, user_id, status')
      .not('status', 'in', '("delivered","cancelled")');

    if (fetchErr) {
      console.error('[AutoSync] Error fetching shipments:', fetchErr.message);
      return;
    }

    if (!shipments?.length) {
      console.log('[AutoSync] No active shipments to sync');
      return;
    }

    console.log(`[AutoSync] Found ${shipments.length} active shipment(s)`);

    // 2. Batch in groups of 40 (17Track API limit)
    for (let i = 0; i < shipments.length; i += 40) {
      const batch = shipments.slice(i, i + 40);
      const body = batch.map(s => ({ number: s.tracking_number }));

      console.log(`[AutoSync] Fetching batch ${Math.floor(i / 40) + 1}: ${batch.map(s => s.tracking_number).join(', ')}`);

      const response = await fetch(`${TRACK17_BASE}/gettrackinfo`, {
        method: 'POST',
        headers: {
          '17token': TRACK17_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data?.code !== 0) {
        console.error('[AutoSync] 17Track API error code:', data?.code, data?.data);
        continue;
      }

      const accepted = data?.data?.accepted || [];
      console.log(`[AutoSync] Accepted: ${accepted.length}, Rejected: ${data?.data?.rejected?.length || 0}`);

      for (const result of accepted) {
        const trackInfo = result.track;
        if (!trackInfo) {
          console.log(`[AutoSync] No track info for ${result.number}`);
          continue;
        }

        const ship = batch.find(s => s.tracking_number === result.number);
        if (!ship) continue;

        // Map status — try numeric (track.e) then string (track.w1)
        const newStatus = mapTrackStatus(trackInfo.e, trackInfo.w1);
        const events = trackInfo.z1 || [];
        const latestEvent = trackInfo.z0 || events[0] || null;

        // Update shipment record
        const updateData = {
          status: newStatus,
          last_synced_at: new Date().toISOString(),
        };

        if (latestEvent) {
          updateData.last_event = latestEvent.z || '';
          updateData.last_event_location = latestEvent.c || '';
        }

        if (trackInfo.c) {
          updateData.carrier_detected = trackInfo.c;
        }

        const { error: updateErr } = await sbAdmin
          .from('shipments')
          .update(updateData)
          .eq('id', ship.id);

        if (updateErr) {
          console.error(`[AutoSync] Error updating ${result.number}:`, updateErr.message);
          continue;
        }

        // Save tracking events
        if (events.length > 0) {
          await sbAdmin.from('tracking_events').delete().eq('shipment_id', ship.id);

          const { error: evtErr } = await sbAdmin.from('tracking_events').insert(
            events.map(ev => ({
              shipment_id: ship.id,
              event_time: ev.a ? new Date(ev.a).toISOString() : new Date().toISOString(),
              location: ev.c || '',
              description: ev.z || '',
              status_code: String(trackInfo.e ?? ''),
            }))
          );

          if (evtErr) {
            console.error(`[AutoSync] Error saving events for ${result.number}:`, evtErr.message);
          }
        }

        console.log(`[AutoSync] Updated ${result.number}: ${ship.status} -> ${newStatus} (${events.length} events)`);
      }
    }

    console.log('[AutoSync] Sync cycle complete at', new Date().toISOString());
  } catch (err) {
    console.error('[AutoSync] Unhandled error:', err.message);
  }
}

// =============================================
// START SERVER
// =============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Supploxi v2.1 running at http://localhost:${PORT}`);
  console.log(`Auto-tracking: ENABLED (17Track API)`);
  console.log(`Auto-sync: ${sbAdmin ? 'ENABLED (every 6 hours)' : 'DISABLED (set SUPABASE_SERVICE_KEY)'}`);

  // Run auto-sync on startup (after 30s delay to let server warm up)
  if (sbAdmin) {
    setTimeout(() => {
      console.log('[AutoSync] Running initial sync...');
      autoSyncTracking();
    }, 30000);

    // Then every 6 hours
    setInterval(autoSyncTracking, 6 * 60 * 60 * 1000);
  }
});
