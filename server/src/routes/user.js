import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, insert, list, update, remove, reserveListing, where, sortNewest, sortAmount, sortEnd, sanitizeUser } from '../db.js';
import { allow, requireAuth, signUser } from '../auth.js';
import { FISH_TYPES, QUALITIES, SIZES, assessBidRisk, predictPrice, refreshAuction } from '../utils.js';
import { captureRazorpayPayment, createRazorpayOrder, getRazorpayPayment, razorpayConfigured, verifyRazorpaySignature, verifyRazorpayWebhookSignature } from '../payments.js';

const router = express.Router();
const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../');
const uploadDir = resolve(projectRoot, 'server/uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const imageExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${imageExtensions[file.mimetype] || ''}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, Boolean(imageExtensions[file.mimetype]))
});
const imageUpload = (req, res, next) => upload.single('image')(req, res, error => {
  if (!error) return next();
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Fish image must be 5 MB or smaller' : 'Could not upload fish image' });
  }
  next(error);
});
const detectionAttempts = new Map();
const limitFishDetection = (req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const attempt = detectionAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 12) {
    res.set('Retry-After', String(Math.ceil((attempt.resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Too many photo searches. Please try again in a few minutes.' });
  }
  if (!attempt || attempt.resetAt <= now) detectionAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else attempt.count += 1;
  for (const [ip, value] of detectionAttempts) if (value.resetAt <= now) detectionAttempts.delete(ip);
  next();
};
const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const fishermanFor = async id => sanitizeUser(await get('users', id));
const listingView = async listing => { const auction = (await list('auctions')).find(item => item.listing === listing.id) || null; const bids = auction ? sortAmount(where(await list('bids'), { auction: auction.id })) : []; const currentPrice = bids[0]?.amount || auction?.startPrice || listing.salePrice || listing.expectedPrice; return { ...listing, fisherman: await fishermanFor(listing.fisherman), auction: auction ? { ...auction, bidCount: bids.length, currentPrice, priceIncreasePercent: auction.startPrice ? +(((currentPrice - auction.startPrice) / auction.startPrice) * 100).toFixed(2) : 0 } : null }; };

async function beginRazorpayPayment(order, address) {
  const amount = Math.round(Number(order.amount) * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    const error = new Error('Order amount is invalid');
    error.status = 400;
    throw error;
  }
  if (order.paymentStatus === 'paid') {
    const error = new Error('This order has already been paid');
    error.status = 409;
    throw error;
  }

  if (address) await update('orders', order.id, { address });
  const transaction = await insert('payments', {
    order: order.id,
    orderNumber: order.orderNumber,
    buyer: order.buyer,
    fisherman: order.fisherman,
    listing: order.listing,
    amount: Number(order.amount),
    currency: 'INR',
    gateway: 'razorpay',
    status: 'creating',
    mode: 'test'
  });

  try {
    const gatewayOrder = await createRazorpayOrder({
      amount,
      receipt: String(order.orderNumber).slice(0, 40),
      notes: { tideMarketOrder: order.id }
    });
    await update('payments', transaction.id, {
      gatewayOrderId: gatewayOrder.id,
      status: 'pending'
    });
    await update('orders', order.id, {
      paymentStatus: 'pending',
      orderStatus: 'awaiting-payment',
      paymentMethod: 'razorpay',
      gateway: 'razorpay',
      gatewayOrderId: gatewayOrder.id
    });
    return {
      keyId: process.env.RAZORPAY_KEY_ID,
      gatewayOrderId: gatewayOrder.id,
      transactionId: transaction.id,
      orderNumber: order.orderNumber,
      amount: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      name: 'TideMarket',
      description: `Payment for ${order.orderNumber}`
    };
  } catch (error) {
    await update('payments', transaction.id, {
      status: 'failed',
      failureReason: 'Could not create a payment session'
    });
    await update('orders', order.id, { paymentStatus: 'failed', orderStatus: 'payment-failed' });
    if (order.listing && order.purchaseType === 'buyout') {
      const listing = await get('listings', order.listing);
      if (listing?.status === 'reserved' && listing.reservedBy === order.buyer) {
        await update('listings', listing.id, { status: 'available', reservedBy: null });
      }
    }
    console.error('Razorpay order creation failed:', error.message);
    throw Object.assign(new Error('Could not start payment. Check the Razorpay test credentials and try again.'), { status: 502 });
  }
}

async function failPayment(transaction, reason) {
  await update('payments', transaction.id, {
    status: 'failed',
    failureReason: String(reason || 'Payment was not completed').slice(0, 160)
  });
  const order = await get('orders', transaction.order);
  if (!order) return;
  await update('orders', order.id, { paymentStatus: 'failed', orderStatus: 'payment-failed' });
  if (order.listing && order.purchaseType === 'buyout') {
    const listing = await get('listings', order.listing);
    if (listing?.status === 'reserved' && listing.reservedBy === order.buyer) {
      await update('listings', listing.id, { status: 'available', reservedBy: null });
    }
  }
}

async function markPaymentPaid(transaction, payment) {
  const order = await get('orders', transaction.order);
  if (!order) return null;
  const paidAt = payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString();
  const paidTransaction = await update('payments', transaction.id, {
    status: 'paid',
    gatewayPaymentId: payment.id,
    paymentMethod: payment.method,
    paidAt
  });
  await update('orders', order.id, {
    paymentStatus: 'paid',
    orderStatus: 'processing',
    paymentMethod: 'razorpay',
    gateway: 'razorpay',
    gatewayOrderId: transaction.gatewayOrderId,
    transactionRef: payment.id,
    paidAt
  });
  if (order.listing) await update('listings', order.listing, { status: 'sold', reservedBy: null });
  return paidTransaction;
}

router.post('/auth/register', async (req, res) => { try { const { name, email, password, phone, location } = req.body; const normalizedEmail = email?.toLowerCase(); if (!name || !normalizedEmail || !password) return res.status(400).json({ message: 'Name, email and password are required' }); if ((await list('users')).some(user => user.email === normalizedEmail)) return res.status(400).json({ message: 'Email is already registered' }); const existingRequest = (await list('registrationRequests')).find(item => item.email === normalizedEmail && item.status === 'pending'); if (existingRequest) return res.status(409).json({ message: 'Your registration request is still pending admin approval.', status: 'pending' }); const request = { name, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'buyer', status: 'pending' }; if (phone) request.phone = phone; if (location) request.location = location; await insert('registrationRequests', request); res.status(202).json({ status: 'pending', message: 'Registration submitted. An admin must approve your account before you can sign in.' }); } catch (error) { res.status(400).json({ message: error.message }); } });
router.post('/auth/login', async (req, res) => { try { const email = req.body.email?.trim().toLowerCase(); const user = (await list('users')).find(item => item.email === email); if (!user) { const request = (await list('registrationRequests')).find(item => item.email === email && item.status === 'pending'); if (request) return res.status(403).json({ message: 'Your account request is still pending admin approval.', status: 'pending' }); return res.status(401).json({ message: 'Invalid email or password' }); } if (!(await bcrypt.compare(req.body.password || '', user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' }); res.json({ token: signUser(user), user: publicUser(user) }); } catch (error) { console.error('Admin/user login failed:', error); res.status(500).json({ message: 'Login service failed', detail: error.message }); } });
router.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));
router.post('/uploads/image', requireAuth, allow('fisherman'), imageUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Upload a JPG, PNG, or WEBP fish image' });
  res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
});
router.post('/fish-detection', limitFishDetection, imageUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Upload a JPG, PNG, or WEBP fish image' });
  const script = resolve(projectRoot, 'predict.py');
  const model = resolve(projectRoot, 'server/models/fish_classifier.keras');
  const labels = resolve(projectRoot, 'server/models/fish_labels.json');
  try {
    const modelIsPointer = fs.existsSync(model) && fs.statSync(model).size < 256 && fs.readFileSync(model, 'utf8').startsWith('version https://git-lfs.github.com/spec/v1');
    if (!fs.existsSync(model) || modelIsPointer) {
      return res.status(503).json({ message: 'Species identification is not set up: the fish classifier model weights are missing. Install the model file and Python/TensorFlow requirements to enable photo detection.' });
    }
    const { stdout } = await execFileAsync(process.env.PYTHON_EXECUTABLE || 'python', [script, '--image', req.file.path, '--model', model, '--labels', labels], {
      cwd: projectRoot,
      timeout: 120000,
      maxBuffer: 1024 * 1024
    });
    res.json(JSON.parse(stdout.trim()));
  } catch (error) {
    if (error.code === 'ENOENT' || /No module named ['"]?tensorflow/i.test(error.stderr || '')) {
      return res.status(503).json({ message: 'Species identification is not set up: install Python, TensorFlow, and the fish classifier model weights.' });
    }
    console.error('Fish image detection failed:', error.stderr || error.message);
    res.status(500).json({ message: 'Could not identify species from this image. Try a clear photo of one fish.' });
  } finally {
    fs.rmSync(req.file.path, { force: true });
  }
});
router.get('/market/trends', async (req, res) => {
  const requestedDays = Number(req.query.days || 7);
  if (![7, 30].includes(requestedDays)) return res.status(400).json({ message: 'Trend range must be 7 or 30 days' });

  const listings = await list('listings');
  const auctions = await list('auctions');
  const bids = await list('bids');
  const auctionById = new Map(auctions.map(auction => [auction.id, auction]));
  const auctionByListing = new Map(auctions.map(auction => [auction.listing, auction]));
  const listingById = new Map(listings.map(listing => [listing.id, listing]));
  const startTime = Date.now() - requestedDays * 86400000;
  const observationsByDayAndListing = new Map();
  const addObservation = (listing, timestamp, amount) => {
    const observedAt = new Date(timestamp || '').getTime();
    const price = Number(amount);
    if (!listing || !listing.fishType || !Number.isFinite(observedAt) || observedAt < startTime || !Number.isFinite(price) || price <= 0) return;
    const date = new Date(observedAt).toISOString().slice(0, 10);
    const key = `${date}:${listing.id}`;
    const previous = observationsByDayAndListing.get(key);
    if (!previous || observedAt > previous.observedAt) {
      observationsByDayAndListing.set(key, { date, fishType: listing.fishType, listingId: listing.id, amount: price, observedAt });
    }
  };

  for (const listing of listings) {
    const auction = auctionByListing.get(listing.id);
    const initialPrice = auction?.startPrice ?? (listing.saleMode === 'bid' ? listing.expectedPrice : listing.salePrice || listing.expectedPrice);
    addObservation(listing, listing.createdAt, initialPrice);
  }
  for (const bid of bids) {
    const auction = auctionById.get(bid.auction);
    addObservation(auction && listingById.get(auction.listing), bid.createdAt, bid.amount);
  }

  const dailyPrices = new Map();
  for (const observation of observationsByDayAndListing.values()) {
    const key = `${observation.date}:${observation.fishType}`;
    const point = dailyPrices.get(key) || { date: observation.date, fishType: observation.fishType, total: 0, observations: 0 };
    point.total += observation.amount;
    point.observations += 1;
    dailyPrices.set(key, point);
  }

  const points = [...dailyPrices.values()]
    .map(point => ({
      date: point.date,
      fishType: point.fishType,
      averagePrice: Number((point.total / point.observations).toFixed(2)),
      observations: point.observations
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.fishType.localeCompare(b.fishType));
  res.json({ days: requestedDays, generatedAt: new Date().toISOString(), points });
});
router.get('/listings', async (req, res) => { let items = (await list('listings')).filter(item => ['available', 'auction'].includes(item.status)); if (req.query.quality) items = items.filter(item => item.quality === req.query.quality); if (req.query.fishType) items = items.filter(item => item.fishType === req.query.fishType); if (req.query.q) items = items.filter(item => `${item.fishType} ${item.location}`.toLowerCase().includes(req.query.q.toLowerCase())); res.json(await Promise.all(sortNewest(items).map(listingView))); });
router.get('/listings/:id', async (req, res) => { const item = await get('listings', req.params.id); if (!item || item.status === 'removed') return res.status(404).json({ message: 'Listing not found' }); res.json(await listingView(item)); });
router.post('/listings', requireAuth, allow('fisherman'), async (req, res) => { const { fishType, quantity, quality, size, location, expectedPrice, description, imageUrl, saleMode = 'sale', salePrice } = req.body; const range = predictPrice(fishType, Number(quantity), quality, size); res.status(201).json(await insert('listings', { fisherman: req.user.id, fishType, quantity, quality, size, location, expectedPrice, salePrice: Number(salePrice || expectedPrice), saleMode, description, imageUrl, imageVerification: 'pending', predictedLow: range.low, predictedHigh: range.high, status: 'available' })); });
router.get('/fisherman/listings', requireAuth, allow('fisherman'), async (req, res) => res.json(await Promise.all(sortNewest(where(await list('listings'), { fisherman: req.user.id })).map(listingView))));
router.get('/fisherman/sales', requireAuth, allow('fisherman'), async (req, res) => { const orders = sortNewest(where(await list('orders'), { fisherman: req.user.id })); const listings = await list('listings'); res.json(orders.map(order => ({ ...order, listingDetails: listings.find(listing => listing.id === order.listing) || null }))); });
router.delete('/listings/:id', requireAuth, allow('fisherman'), async (req, res) => { const listing = await get('listings', req.params.id); if (!listing || listing.fisherman !== req.user.id) return res.status(404).json({ message: 'Listing not found' }); const linkedOrder = (await list('orders')).find(order => order.listing === listing.id); if (linkedOrder || ['sold', 'auction'].includes(listing.status)) return res.status(409).json({ message: 'This listing cannot be deleted because it has an active bid or sale record.' }); const auction = (await list('auctions')).find(item => item.listing === listing.id); if (auction) await remove('auctions', auction.id); await remove('listings', listing.id); res.json({ message: 'Listing deleted' }); });
router.post('/listings/:id/auction', requireAuth, allow('fisherman'), async (req, res) => { const listing = await get('listings', req.params.id); if (!listing || listing.fisherman !== req.user.id || listing.status !== 'available') return res.status(400).json({ message: 'Listing is unavailable' }); const auction = await insert('auctions', { listing: listing.id, startPrice: Number(req.body.startPrice), minimumIncrement: Number(req.body.minimumIncrement || 10), startTime: req.body.startTime, endTime: req.body.endTime, status: 'scheduled' }); await update('listings', listing.id, { status: 'auction' }); res.status(201).json(auction); });
router.get('/auctions/:id', async (req, res) => { let auction = await get('auctions', req.params.id); if (!auction) return res.status(404).json({ message: 'Auction not found' }); auction = await refreshAuction(auction); const listing = await get('listings', auction.listing); if (!listing || listing.status === 'removed') return res.status(404).json({ message: 'This listing is no longer available' }); const bids = sortAmount(where(await list('bids'), { auction: auction.id })).map(item => ({ ...item, buyer: sanitizeUser(null) })); for (const bid of bids) bid.buyer = sanitizeUser(await get('users', bid.buyer)); res.json({ auction, listing: await listingView(listing), bids }); });
router.post('/auctions/:id/bids', requireAuth, allow('buyer'), async (req, res) => {
  const auction = await get('auctions', req.params.id);
  if (!auction) return res.status(404).json({ message: 'Auction not found' });
  const listing = await get('listings', auction.listing);
  if (!listing || listing.status === 'removed') return res.status(404).json({ message: 'This listing is no longer available' });
  const refreshedAuction = await refreshAuction(auction);
  const bids = where(await list('bids'), { auction: auction.id });
  const high = sortAmount(bids)[0];
  const minimum = Number(high?.amount || auction.startPrice) + Number(auction.minimumIncrement);
  const amount = Number(req.body.amount);
  if (refreshedAuction.status !== 'active') return res.status(400).json({ message: 'This auction is closed' });
  if (!Number.isFinite(amount) || amount < minimum) return res.status(400).json({ message: `Bid must be at least Rs ${minimum.toFixed(2)}` });
  const createdAt = new Date().toISOString();
  const proposedBid = { auction: auction.id, buyer: req.user.id, amount, createdAt };
  const risk = assessBidRisk(proposedBid, [...bids, proposedBid], refreshedAuction);
  res.status(201).json(await insert('bids', { ...proposedBid, riskReviewNeeded: risk.reviewNeeded, riskFlags: risk.flags }));
});
router.patch('/auctions/:id/close', requireAuth, allow('fisherman'), async (req, res) => {
  const auction = await get('auctions', req.params.id);
  const listing = auction && await get('listings', auction.listing);
  if (!auction || !listing || listing.fisherman !== req.user.id) return res.status(404).json({ message: 'Auction not found' });
  if (['completed', 'cancelled'].includes(auction.status)) return res.json(await refreshAuction(auction));
  const endTime = new Date().toISOString();
  await update('auctions', auction.id, { endTime });
  const completedAuction = await refreshAuction({ ...auction, endTime });
  const winner = completedAuction.winner ? await get('users', completedAuction.winner) : null;
  res.json({ ...completedAuction, winnerName: winner?.name || null });
});
router.get('/bid-monitoring', requireAuth, allow('fisherman', 'admin'), async (req, res) => {
  const [auctions, listings, bids, users] = await Promise.all(['auctions', 'listings', 'bids', 'users'].map(list));
  const listingById = new Map(listings.map(item => [item.id, item]));
  const userById = new Map(users.map(item => [item.id, sanitizeUser(item)]));
  const visibleAuctions = auctions.filter(auction => {
    const listing = listingById.get(auction.listing);
    return req.user.role === 'admin' || listing?.fisherman === req.user.id;
  });
  res.json(visibleAuctions.map(auction => {
    const auctionBids = where(bids, { auction: auction.id });
    const listing = listingById.get(auction.listing);
    return {
      id: auction.id,
      status: auction.status,
      endTime: auction.endTime,
      winner: auction.winner || null,
      winnerName: userById.get(auction.winner)?.name || null,
      winningBid: Number(auction.winningBid || 0),
      listing: listing ? {
        id: listing.id,
        fishType: listing.fishType,
        quantity: Number(listing.quantity || 0),
        location: listing.location
      } : null,
      bids: sortNewest(auctionBids).map(bid => {
        const risk = assessBidRisk(bid, auctionBids, auction);
        const flags = bid.riskFlags?.length ? bid.riskFlags : risk.flags;
        return {
          ...bid,
          buyer: userById.get(bid.buyer) ? { id: bid.buyer, name: userById.get(bid.buyer).name } : { id: bid.buyer, name: 'Unknown buyer' },
          riskReviewNeeded: Boolean(bid.riskReviewNeeded || risk.reviewNeeded),
          riskFlags: flags
        };
      })
    };
  }).sort((a, b) => new Date(b.endTime || 0) - new Date(a.endTime || 0)));
});
router.get('/orders', requireAuth, async (req, res) => { const key = req.user.role === 'buyer' ? 'buyer' : req.user.role === 'fisherman' ? 'fisherman' : null; const orders = key ? where(await list('orders'), { [key]: req.user.id }) : await list('orders'); res.json(sortNewest(orders)); });
router.post('/payments/razorpay/webhook', async (req, res) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return res.status(503).json({ message: 'Razorpay webhook secret is not configured' });
  const signature = req.get('x-razorpay-signature');
  if (!verifyRazorpayWebhookSignature(req.body, signature)) return res.status(400).json({ message: 'Razorpay webhook signature could not be verified' });

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid Razorpay webhook payload' });
  }
  if (!['payment.captured', 'order.paid', 'payment.failed'].includes(event.event)) return res.json({ received: true });

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) return res.status(400).json({ message: 'Razorpay event is missing its payment order' });
  const transaction = (await list('payments')).find(item => item.gatewayOrderId === payment.order_id);
  if (!transaction) {
    console.warn('Ignoring Razorpay webhook for an unknown order:', payment.order_id);
    return res.status(202).json({ received: true, ignored: true });
  }
  if (transaction.status === 'paid') return res.json({ received: true });
  if (transaction.status !== 'pending') return res.json({ received: true, ignored: true });

  if (event.event === 'payment.failed') {
    await failPayment(transaction, payment.error_description || 'Razorpay payment failed');
    return res.json({ received: true });
  }
  if (payment.status !== 'captured' || Number(payment.amount) !== Math.round(Number(transaction.amount) * 100) || payment.currency !== 'INR') {
    console.error('Razorpay captured payment does not match its transaction:', transaction.id);
    return res.status(400).json({ message: 'Razorpay payment does not match the recorded order' });
  }
  if (!await markPaymentPaid(transaction, payment)) return res.status(404).json({ message: 'Order not found for Razorpay payment' });
  res.json({ received: true });
});
router.post('/payments/razorpay/orders', requireAuth, allow('buyer'), async (req, res) => {
  if (!razorpayConfigured()) return res.status(503).json({ message: 'Razorpay test mode is not configured. Add a Test Mode RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the root .env file.' });
  let order;
  if (req.body.orderId) {
    order = await get('orders', req.body.orderId);
    if (!order || order.buyer !== req.user.id) return res.status(404).json({ message: 'Order not found' });
  } else if (req.body.auctionId) {
    const auction = await get('auctions', req.body.auctionId);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });
    const refreshed = await refreshAuction(auction);
    const bids = sortAmount(where(await list('bids'), { auction: auction.id }));
    if (refreshed.status !== 'completed' || !bids[0] || bids[0].buyer !== req.user.id) return res.status(403).json({ message: 'Only the winning buyer can checkout this completed bid' });
    order = (await list('orders')).find(item => item.auction === auction.id);
    if (!order) return res.status(404).json({ message: 'Winning order not found' });
  } else if (req.body.listingId) {
    const listing = await get('listings', req.body.listingId);
    if (!listing || listing.saleMode !== 'sale') return res.status(400).json({ message: 'This fish is not available for direct purchase' });
    const existing = (await list('orders')).find(item => item.listing === listing.id && item.purchaseType === 'buyout' && item.paymentStatus === 'pending');
    if (existing && existing.buyer !== req.user.id) return res.status(409).json({ message: 'This fish is currently reserved for another buyer’s payment' });
    if (existing) {
      order = existing;
    } else {
      if (!await reserveListing(listing.id, req.user.id)) return res.status(409).json({ message: 'This fish is no longer available' });
      try {
        order = await insert('orders', {
          orderNumber: `TM-${Date.now()}`,
          listing: listing.id,
          buyer: req.user.id,
          fisherman: listing.fisherman,
          quantity: Number(listing.quantity),
          amount: Number(listing.salePrice || listing.expectedPrice) * Number(listing.quantity),
          paymentStatus: 'pending',
          orderStatus: 'awaiting-payment',
          purchaseType: 'buyout',
          ...(req.body.address ? { address: req.body.address } : {})
        });
      } catch (error) {
        await update('listings', listing.id, { status: 'available', reservedBy: null });
        throw error;
      }
    }
  } else {
    return res.status(400).json({ message: 'Provide a listingId, auctionId, or orderId' });
  }
  try {
    const payment = await beginRazorpayPayment(order, req.body.address);
    res.status(201).json(payment);
  } catch (error) {
    res.status(error.status || 502).json({ message: error.message });
  }
});
router.post('/payments/razorpay/verify', requireAuth, allow('buyer'), async (req, res) => {
  const { transactionId, razorpay_order_id: gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const transaction = await get('payments', transactionId);
  if (!transaction || transaction.buyer !== req.user.id) return res.status(404).json({ message: 'Payment attempt not found' });
  if (transaction.status === 'paid') return res.json(transaction);
  if (transaction.status !== 'pending' || transaction.gatewayOrderId !== gatewayOrderId) return res.status(409).json({ message: 'Payment attempt is no longer pending' });
  if (!verifyRazorpaySignature(gatewayOrderId, paymentId, signature)) {
    await failPayment(transaction, 'Payment signature could not be verified');
    return res.status(400).json({ message: 'Payment signature could not be verified' });
  }

  const expectedAmount = Math.round(Number(transaction.amount) * 100);
  let payment;
  try {
    payment = await getRazorpayPayment(paymentId);
  } catch (error) {
    console.error('Razorpay payment verification failed:', error.message);
    return res.status(502).json({ message: 'Payment verification is temporarily unavailable. Check transaction history before retrying.' });
  }
  if (payment.order_id !== gatewayOrderId || Number(payment.amount) !== expectedAmount || payment.currency !== 'INR') {
    return res.status(400).json({ message: 'Payment details do not match this order' });
  }
  if (payment.status === 'authorized') {
    try {
      payment = await captureRazorpayPayment(paymentId, expectedAmount);
    } catch (error) {
      console.error('Razorpay payment capture failed:', error.message);
      return res.status(502).json({ message: 'Razorpay authorized the payment but capture could not be confirmed. Check transaction history before retrying.' });
    }
  }
  if (payment.status !== 'captured') {
    await failPayment(transaction, 'Payment was not captured');
    return res.status(402).json({ message: 'Payment was not captured by Razorpay' });
  }

  const paidTransaction = await markPaymentPaid(transaction, payment);
  if (!paidTransaction) return res.status(404).json({ message: 'Order not found for this payment' });
  res.json(paidTransaction);
});
router.post('/payments/razorpay/failure', requireAuth, allow('buyer'), async (req, res) => {
  const transaction = await get('payments', req.body.transactionId);
  if (!transaction || transaction.buyer !== req.user.id) return res.status(404).json({ message: 'Payment attempt not found' });
  if (transaction.status === 'pending') {
    await failPayment(transaction, req.body.reason || 'Payment was cancelled');
  }
  res.json({ message: 'Payment attempt recorded' });
});
router.get('/transactions', requireAuth, async (req, res) => {
  const transactions = sortNewest(await list('payments'));
  const visible = req.user.role === 'admin'
    ? transactions
    : transactions.filter(item => item[req.user.role === 'buyer' ? 'buyer' : 'fisherman'] === req.user.id);
  res.json(await Promise.all(visible.map(async item => {
    const order = await get('orders', item.order);
    const listing = order?.listing ? await get('listings', order.listing) : null;
    return {
      ...item,
      fishType: listing?.fishType || 'Fish order',
      quantity: order?.quantity || 0,
      orderStatus: order?.orderStatus || 'unknown'
    };
  })));
});
router.get('/buyer/history', requireAuth, allow('buyer'), async (req, res) => {
  const [bids, auctions, listings, orders, payments] = await Promise.all([
    list('bids'),
    list('auctions'),
    list('listings'),
    list('orders'),
    list('payments')
  ]);
  const buyerBids = bids.filter(bid => bid.buyer === req.user.id);
  const buyerOrders = sortNewest(orders.filter(order => order.buyer === req.user.id));
  const buyerPayments = sortNewest(payments.filter(payment => payment.buyer === req.user.id));
  const bidHistory = buyerBids.map(bid => {
    const auction = auctions.find(item => item.id === bid.auction);
    const listing = auction && listings.find(item => item.id === auction.listing);
    const auctionBids = auction ? sortAmount(bids.filter(item => item.auction === auction.id)) : [];
    const endsAt = auction?.endTime ? new Date(auction.endTime) : null;
    const completed = auction?.status === 'completed' || (endsAt && endsAt <= new Date());
    const winningBid = auctionBids[0];
    return {
      id: bid.id,
      auctionId: auction?.id,
      fishType: listing?.fishType || 'Fish auction',
      quantity: Number(listing?.quantity || 0),
      amount: Number(bid.amount || 0),
      createdAt: bid.createdAt,
      auctionStatus: completed ? 'completed' : auction?.status || 'unknown',
      bidStatus: completed
        ? winningBid?.buyer === req.user.id && winningBid?.id === bid.id ? 'won' : 'ended'
        : winningBid?.id === bid.id ? 'leading' : 'outbid',
      highestBid: Number(winningBid?.amount || 0),
      endTime: auction?.endTime || null,
      demo: Boolean(bid.demo || listing?.demo)
    };
  });
  const orderHistory = buyerOrders.map(order => {
    const listing = listings.find(item => item.id === order.listing);
    const transactions = buyerPayments.filter(payment => payment.order === order.id);
    const verifiedPaid = order.paymentStatus === 'paid' && order.gateway === 'razorpay';
    return {
      id: order.id,
      orderNumber: order.orderNumber || order.id,
      fishType: listing?.fishType || 'Fish order',
      quantity: Number(order.quantity || listing?.quantity || 0),
      amount: Number(order.amount || 0),
      createdAt: order.createdAt,
      orderStatus: order.orderStatus || 'pending',
      paymentStatus: verifiedPaid ? 'paid' : order.paymentStatus === 'paid' ? 'unverified-demo' : order.paymentStatus || 'pending',
      paymentMethod: order.paymentMethod || null,
      demo: Boolean(order.demo),
      transactionIds: transactions.map(payment => payment.id)
    };
  });
  const paymentHistory = await Promise.all(buyerPayments.map(async payment => {
    const order = buyerOrders.find(item => item.id === payment.order);
    const listing = order && listings.find(item => item.id === order.listing);
    return {
      ...payment,
      orderNumber: order?.orderNumber || payment.orderNumber || payment.order,
      fishType: listing?.fishType || 'Fish order',
      quantity: Number(order?.quantity || listing?.quantity || 0)
    };
  }));
  res.json({ bids: sortNewest(bidHistory), orders: orderHistory, payments: paymentHistory });
});
router.patch('/orders/:id/status', requireAuth, allow('fisherman', 'admin'), async (req, res) => { const order = await get('orders', req.params.id); if (!order || (req.user.role === 'fisherman' && order.fisherman !== req.user.id)) return res.status(404).json({ message: 'Order not found' }); res.json(await update('orders', order.id, { orderStatus: req.body.status })); });
router.get('/recommendations', requireAuth, allow('buyer'), async (req, res) => { const bids = where(await list('bids'), { buyer: req.user.id }); const auctionList = await list('auctions'); const listingIds = auctionList.filter(auction => bids.some(bid => bid.auction === auction.id)).map(auction => auction.listing); const items = await list('listings'); res.json(await Promise.all(sortNewest(items.filter(item => !listingIds.length || listingIds.includes(item.id))).slice(0, 12).map(listingView))); });
router.get('/meta', (req, res) => res.json({ fishTypes: FISH_TYPES, qualities: QUALITIES, sizes: SIZES }));
export default router;
