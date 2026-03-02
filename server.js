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
  // Numeric codes (legacy fallback)
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

  // String tags (track_info.latest_status.status)
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

// Get tracking info (proxy with debug logging + tracking limit)
app.post('/api/tracking/getinfo', async (req, res) => {
  try {
    const { numbers, user_id } = req.body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'numbers array is required' });
    }

    // Check tracking limit if user_id provided and sbAdmin available
    if (user_id && sbAdmin) {
      const { data: us } = await sbAdmin.from('user_settings').select('monthly_tracking_limit, tracking_count_month, tracking_count_reset').eq('user_id', user_id).single();
      if (us) {
        // Reset counter if new month
        const resetDate = us.tracking_count_reset ? new Date(us.tracking_count_reset) : new Date();
        const now = new Date();
        let count = us.tracking_count_month || 0;
        if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
          count = 0;
          await sbAdmin.from('user_settings').update({ tracking_count_month: 0, tracking_count_reset: now.toISOString().split('T')[0] }).eq('user_id', user_id);
        }
        const limit = us.monthly_tracking_limit || 999;
        if (count >= limit) {
          return res.status(429).json({ error: 'Monthly tracking limit reached', limit, used: count });
        }
        // Increment counter
        await sbAdmin.from('user_settings').update({ tracking_count_month: count + numbers.length }).eq('user_id', user_id);
      }
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

    // Debug logging
    console.log('[GetInfo] Response code:', data?.code);
    console.log('[GetInfo] Accepted:', data?.data?.accepted?.length || 0, '| Rejected:', data?.data?.rejected?.length || 0);

    if (data?.data?.accepted?.length > 0) {
      const first = data.data.accepted[0];
      const ti = first.track_info || {};
      console.log('[GetInfo] track_info keys:', Object.keys(ti).join(', '));
      console.log('[GetInfo] latest_status:', JSON.stringify(ti.latest_status));
      console.log('[GetInfo] latest_event:', JSON.stringify(ti.latest_event));
      const events = ti.tracking?.providers?.[0]?.events || [];
      console.log('[GetInfo] events count:', events.length);
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
// AUTO-SYNC (runs every 3 hours)
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

    // 2. Check per-user tracking limits and filter out users over limit
    const userIds = [...new Set(shipments.map(s => s.user_id))];
    const { data: allSettings } = await sbAdmin.from('user_settings').select('user_id, monthly_tracking_limit, tracking_count_month, tracking_count_reset').in('user_id', userIds);
    const settingsMap = {};
    const now = new Date();
    for (const us of (allSettings || [])) {
      const resetDate = us.tracking_count_reset ? new Date(us.tracking_count_reset) : new Date();
      let count = us.tracking_count_month || 0;
      if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
        count = 0;
        await sbAdmin.from('user_settings').update({ tracking_count_month: 0, tracking_count_reset: now.toISOString().split('T')[0] }).eq('user_id', us.user_id);
      }
      settingsMap[us.user_id] = { limit: us.monthly_tracking_limit || 999, count };
    }

    const eligibleShipments = shipments.filter(s => {
      const us = settingsMap[s.user_id] || { limit: 999, count: 0 };
      return us.count < us.limit;
    });

    if (eligibleShipments.length < shipments.length) {
      console.log(`[AutoSync] Skipping ${shipments.length - eligibleShipments.length} shipment(s) — users over tracking limit`);
    }

    if (!eligibleShipments.length) {
      console.log('[AutoSync] No eligible shipments to sync');
      return;
    }

    // 3. Batch in groups of 40 (17Track API limit)
    for (let i = 0; i < eligibleShipments.length; i += 40) {
      const batch = eligibleShipments.slice(i, i + 40);
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
        const trackInfo = result.track_info;
        if (!trackInfo) {
          console.log(`[AutoSync] No track info for ${result.number}`);
          continue;
        }

        const ship = batch.find(s => s.tracking_number === result.number);
        if (!ship) continue;

        // Map status from track_info.latest_status.status (string: "InTransit", "Delivered", etc.)
        const statusStr = trackInfo.latest_status?.status || '';
        const subStatus = trackInfo.latest_status?.sub_status || '';
        // Check sub_status for customs hold before general mapping
        const newStatus = subStatus.includes('CustomsHold') ? 'customs' : mapTrackStatus(statusStr);
        const events = trackInfo.tracking?.providers?.[0]?.events || [];
        const latestEvent = trackInfo.latest_event || events[0] || null;

        // Update shipment record
        const updateData = {
          status: newStatus,
          last_synced_at: new Date().toISOString(),
        };

        if (latestEvent) {
          updateData.last_event = latestEvent.description || '';
          updateData.last_event_location = latestEvent.location || '';
        }

        // Carrier from result.carrier or provider name
        const providerName = trackInfo.tracking?.providers?.[0]?.provider?.name;
        if (providerName) {
          updateData.carrier_detected = providerName;
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
              event_time: ev.time_iso ? new Date(ev.time_iso).toISOString() : new Date().toISOString(),
              location: ev.location || '',
              description: ev.description || '',
              status_code: ev.stage || statusStr,
            }))
          );

          if (evtErr) {
            console.error(`[AutoSync] Error saving events for ${result.number}:`, evtErr.message);
          }
        }

        // Increment user tracking count
        const us = settingsMap[ship.user_id];
        if (us) {
          us.count++;
          await sbAdmin.from('user_settings').update({ tracking_count_month: us.count }).eq('user_id', ship.user_id);
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
  console.log(`Auto-sync: ${sbAdmin ? 'ENABLED (every 3 hours)' : 'DISABLED (set SUPABASE_SERVICE_KEY)'}`);

  // Run auto-sync on startup (after 30s delay to let server warm up)
  if (sbAdmin) {
    setTimeout(() => {
      console.log('[AutoSync] Running initial sync...');
      autoSyncTracking();
    }, 30000);

    // Then every 3 hours
    setInterval(autoSyncTracking, 3 * 60 * 60 * 1000);
  }
});
