import { createHmac, timingSafeEqual } from 'node:crypto';

const apiBase = 'https://api.razorpay.com/v1';

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && process.env.RAZORPAY_KEY_SECRET);
}

async function razorpayRequest(path, options = {}) {
  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.description || 'Razorpay request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function createRazorpayOrder({ amount, receipt, notes }) {
  return razorpayRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({ amount, currency: 'INR', receipt, notes })
  });
}

export function getRazorpayPayment(paymentId) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
}

export function captureRazorpayPayment(paymentId, amount) {
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: 'POST',
    body: JSON.stringify({ amount, currency: 'INR' })
  });
}

export function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!/^[a-f\d]{64}$/i.test(signature || '')) return false;
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function verifyRazorpayWebhookSignature(body, signature) {
  if (!Buffer.isBuffer(body) || !/^[a-f\d]{64}$/i.test(signature || '')) return false;
  const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
