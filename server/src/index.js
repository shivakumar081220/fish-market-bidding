import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import { initFirebase, insert, list } from './db.js';
import { refreshAuction } from './utils.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const app = express();
app.use('/uploads', express.static(path.resolve(dirname(fileURLToPath(import.meta.url)), '../uploads')));
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  connectSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  formAction: ["'self'"],
  frameAncestors: ["'self'"],
  frameSrc: ["'self'", 'https://api.razorpay.com', 'https://*.razorpay.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  objectSrc: ["'none'"],
  scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
  scriptSrcAttr: ["'none'"],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  upgradeInsecureRequests: null
} } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' })); app.use(morgan('dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'smart-fishing-api' }));
app.use('/api', userRoutes); app.use('/api/admin', adminRoutes);
app.use((error, req, res, next) => { console.error('Unhandled API error:', error); res.status(500).json({ message: 'Unexpected server error', detail: error.message }); });
async function seed() { const users = await list('users'); const admin = users.find(user => user.email === 'tide@gmail.com'); const adminData = { name: 'Tide Admin', email: 'tide@gmail.com', passwordHash: await bcrypt.hash('Tide@123', 12), role: 'admin' }; if (admin) await (await import('./db.js')).update('users', admin.id, adminData); else await insert('users', adminData); }
const port = process.env.PORT || 5000;
console.log('Firebase Realtime Database: connecting...');
let auctionSettlementRunning = false;
async function settleAuctions() {
  if (auctionSettlementRunning) return;
  auctionSettlementRunning = true;
  try {
    const auctions = await list('auctions');
    const pending = auctions.filter(auction => !['completed', 'cancelled'].includes(auction.status));
    for (const auction of pending) {
      try {
        await refreshAuction(auction);
      } catch (error) {
        console.error(`Auction settlement failed for ${auction.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Auction settlement sweep failed:', error);
  } finally {
    auctionSettlementRunning = false;
  }
}
try {
  initFirebase();
  await seed();
  console.log('Firebase Realtime Database: connected');
  await settleAuctions();
  setInterval(settleAuctions, 15_000);
  app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
} catch (error) {
  console.error('Firebase Realtime Database: failed:', error.message);
  process.exit(1);
}
