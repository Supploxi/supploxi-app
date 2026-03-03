// Email system for Purchase Orders using Resend API

const RESEND_API_URL = 'https://api.resend.com/emails'

function getApiKey() {
  return import.meta.env.VITE_RESEND_API_KEY || ''
}

// Generate HTML for Purchase Order email
export function generatePOEmailHTML(poData) {
  const { po_number, supplier_name, items, subtotal, shipping_cost, duties_estimate, total, notes, expected_delivery } = poData

  const itemRows = (items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${item.name || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${item.sku || '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:center;">${item.quantity || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;">$${(parseFloat(item.unit_price) || 0).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;text-align:right;font-weight:600;">$${((parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0)).toFixed(2)}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <div style="background:#0a0c14;padding:24px 32px;">
        <h1 style="color:#00d4aa;font-size:20px;font-weight:700;margin:0;">Supploxi</h1>
        <p style="color:#9ca3af;font-size:13px;margin:4px 0 0;">Purchase Order</p>
      </div>
      <div style="padding:24px 32px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:24px;">
          <div>
            <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">PO Number</p>
            <p style="color:#111827;font-size:18px;font-weight:700;margin:0;">${po_number}</p>
          </div>
          <div style="text-align:right;">
            <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Supplier</p>
            <p style="color:#111827;font-size:16px;font-weight:600;margin:0;">${supplier_name}</p>
          </div>
        </div>
        ${expected_delivery ? `<p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Expected Delivery: <strong style="color:#111827;">${expected_delivery}</strong></p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Item</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">SKU</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Qty</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Unit Price</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="margin-top:16px;padding-top:16px;border-top:2px solid #e5e7eb;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;"><span>Subtotal</span><span>$${(parseFloat(subtotal) || 0).toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;"><span>Shipping</span><span>$${(parseFloat(shipping_cost) || 0).toFixed(2)}</span></div>
          ${duties_estimate ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#6b7280;"><span>Duties (est.)</span><span>$${(parseFloat(duties_estimate) || 0).toFixed(2)}</span></div>` : ''}
          <div style="display:flex;justify-content:space-between;padding:8px 0 0;font-size:18px;font-weight:700;color:#111827;border-top:1px solid #e5e7eb;margin-top:4px;"><span>Total</span><span>$${(parseFloat(total) || 0).toFixed(2)}</span></div>
        </div>
        ${notes ? `<div style="margin-top:20px;padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;"><p style="color:#6b7280;font-size:12px;font-weight:600;margin:0 0 4px;">Notes</p><p style="color:#374151;font-size:14px;margin:0;">${notes}</p></div>` : ''}
      </div>
      <div style="padding:16px 32px;border-top:1px solid #e5e7eb;background:#f9fafb;">
        <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">Sent via Supploxi Supply Chain Management</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

// Send Purchase Order email to supplier
export async function sendPurchaseOrder(supplierEmail, poData) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Resend API key not configured')

  const html = generatePOEmailHTML(poData)

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Supploxi <orders@supploxi.com>',
      to: [supplierEmail],
      subject: `Purchase Order ${poData.po_number} — Supploxi`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Email send failed (${res.status})`)
  }

  return await res.json()
}

// Send order confirmation to customer
export async function sendOrderConfirmation(customerEmail, orderData) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Resend API key not configured')

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Supploxi <noreply@supploxi.com>',
      to: [customerEmail],
      subject: `Order Confirmation ${orderData.order_number} — Supploxi`,
      html: `<p>Your order ${orderData.order_number} has been confirmed. We'll notify you when it ships.</p>`,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Email send failed (${res.status})`)
  }

  return await res.json()
}
