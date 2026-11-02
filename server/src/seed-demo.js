import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDirectory, '../../');
dotenv.config({ path: resolve(projectRoot, '.env') });

const firebaseConfigured = Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
  fs.existsSync(resolve(serverDirectory, '../firebase-service-account.json'))
);
const useLocalDatabase = process.argv.includes('--local');
const allowFirebase = process.argv.includes('--allow-firebase');
const resetActivity = process.argv.includes('--reset-activity');

if (useLocalDatabase && allowFirebase) {
  throw new Error('Choose either --local or --allow-firebase, not both.');
}
if (useLocalDatabase) process.env.TIDEMARKET_DATABASE = 'local';
if (firebaseConfigured && !allowFirebase && !useLocalDatabase) {
  throw new Error('Firebase credentials are configured. Use --local to seed local demo data or --allow-firebase only if you intend to add demo records to Firebase.');
}
if (allowFirebase && !firebaseConfigured) throw new Error('Firebase was requested but no Firebase Admin credentials are configured.');
if (resetActivity && !useLocalDatabase && !allowFirebase) {
  throw new Error('Activity reset requires an explicit --local or --allow-firebase target.');
}

const { insert, list, update, remove, clearCollections } = await import('./db.js');
const password = 'TideDemo!2026';
const passwordHash = await bcrypt.hash(password, 12);
const now = Date.now();
const atDay = (daysAgo, hour = 9) => new Date(now - daysAgo * 86400000).setUTCHours(hour, 0, 0, 0);
const iso = (daysAgo, hour = 9) => new Date(atDay(daysAgo, hour)).toISOString();
const users = [
  { id: 'demo-fisher-1', name: 'Asha Coastal Catch', email: 'asha.fisherman@tidemarket.demo', role: 'fisherman', location: 'Mangalore' },
  { id: 'demo-fisher-2', name: 'Ravi Sea Harvest', email: 'ravi.fisherman@tidemarket.demo', role: 'fisherman', location: 'Udupi' },
  { id: 'demo-fisher-3', name: 'Meera Blue Net', email: 'meera.fisherman@tidemarket.demo', role: 'fisherman', location: 'Karwar' },
  { id: 'demo-fisher-4', name: 'Arun Harbor Fresh', email: 'arun.fisherman@tidemarket.demo', role: 'fisherman', location: 'Honnavar' },
  { id: 'demo-buyer-1', name: 'Kiran Market Buyer', email: 'kiran.buyer@tidemarket.demo', role: 'buyer', location: 'Mangalore' },
  { id: 'demo-buyer-2', name: 'Nisha Seafood Buyer', email: 'nisha.buyer@tidemarket.demo', role: 'buyer', location: 'Udupi' },
  { id: 'demo-buyer-3', name: 'Dev Coastal Kitchen', email: 'dev.buyer@tidemarket.demo', role: 'buyer', location: 'Karwar' }
];

const listings = [
  { id: 'demo-listing-tuna', fishType: 'Tuna', quality: 'Premium', size: 'Large', quantity: 45, location: 'Mangalore', price: 380, saleMode: 'sale', fisherman: 'demo-fisher-1', age: 1 },
  { id: 'demo-listing-pomfret', fishType: 'Pomfret', quality: 'Premium', size: 'Medium', quantity: 26, location: 'Udupi', price: 520, saleMode: 'bid', fisherman: 'demo-fisher-1', age: 2 },
  { id: 'demo-listing-prawns', fishType: 'Prawns', quality: 'Good', size: 'Large', quantity: 32, location: 'Malpe', price: 600, saleMode: 'bid', fisherman: 'demo-fisher-2', age: 3 },
  { id: 'demo-listing-crab', fishType: 'Crab', quality: 'Premium', size: 'Large', quantity: 18, location: 'Karwar', price: 740, saleMode: 'sale', fisherman: 'demo-fisher-2', age: 4 },
  { id: 'demo-listing-squid', fishType: 'Squid', quality: 'Good', size: 'Medium', quantity: 29, location: 'Kundapura', price: 340, saleMode: 'bid', fisherman: 'demo-fisher-3', age: 5 },
  { id: 'demo-listing-lobster', fishType: 'Lobster', quality: 'Premium', size: 'Large', quantity: 12, location: 'Mangalore', price: 1200, saleMode: 'sale', fisherman: 'demo-fisher-3', age: 6 },
  { id: 'demo-listing-mackerel', fishType: 'Mackerel', quality: 'Good', size: 'Medium', quantity: 55, location: 'Bhatkal', price: 230, saleMode: 'bid', fisherman: 'demo-fisher-4', age: 7 },
  { id: 'demo-listing-sardine', fishType: 'Sardine', quality: 'Standard', size: 'Small', quantity: 80, location: 'Honnavar', price: 190, saleMode: 'sale', fisherman: 'demo-fisher-4', age: 8 },
  { id: 'demo-listing-bangus', fishType: 'Bangus', quality: 'Premium', size: 'Large', quantity: 38, location: 'Mangalore', price: 280, saleMode: 'bid', fisherman: 'demo-fisher-1', age: 9 },
  { id: 'demo-listing-clams', fishType: 'Clams', quality: 'Good', size: 'Medium', quantity: 34, location: 'Udupi', price: 290, saleMode: 'sale', fisherman: 'demo-fisher-2', age: 10 },
  { id: 'demo-listing-kingfish', fishType: 'Kingfish', quality: 'Premium', size: 'Large', quantity: 24, location: 'Karwar', price: 480, saleMode: 'bid', fisherman: 'demo-fisher-3', age: 11 },
  { id: 'demo-listing-mussels', fishType: 'Mussels', quality: 'Good', size: 'Medium', quantity: 40, location: 'Honnavar', price: 320, saleMode: 'sale', fisherman: 'demo-fisher-4', age: 12 },
  { id: 'demo-listing-oysters', fishType: 'Oysters', quality: 'Premium', size: 'Medium', quantity: 22, location: 'Malpe', price: 520, saleMode: 'bid', fisherman: 'demo-fisher-1', age: 13 },
  { id: 'demo-listing-anchovy', fishType: 'Anchovy', quality: 'Standard', size: 'Small', quantity: 65, location: 'Bhatkal', price: 210, saleMode: 'bid', fisherman: 'demo-fisher-2', age: 14 },
  { id: 'demo-listing-seer-fish', fishType: 'Seer Fish', quality: 'Premium', size: 'Large', quantity: 20, location: 'Mangalore', price: 680, saleMode: 'sale', fisherman: 'demo-fisher-3', age: 15 }
];

const buyers = ['demo-buyer-1', 'demo-buyer-2', 'demo-buyer-3'];
const purchaseListingIndexes = [0, 3, 5, 7, 9, 11, 14, 2, 4, 6, 8, 10];
const auctions = listings.filter(item => item.saleMode === 'bid').map((item, index) => ({
  id: `demo-auction-${item.id.replace('demo-listing-', '')}`,
  listing: item.id,
  startPrice: item.price,
  minimumIncrement: 10,
  startTime: iso(item.age + 1, 8),
  endTime: new Date(now + (6 + index % 8) * 3600000).toISOString(),
  status: 'active'
}));
const orderListingIds = purchaseListingIndexes.map((_, index) => `demo-order-listing-${index + 1}`);
const auctionIds = auctions.map(auction => auction.id);

async function ensureRecord(collection, id, data, existingRecords) {
  const found = existingRecords.find(record => record.id === id);
  if (found) {
    if (!found.demo) throw new Error(`Refusing to overwrite non-demo ${collection} record ${id}`);
    return false;
  }
  await insert(collection, data, id);
  existingRecords.push({ id, ...data });
  return true;
}

const existingUsers = await list('users');
for (const user of users) {
  const emailOwner = existingUsers.find(item => item.email === user.email);
  if (emailOwner && emailOwner.id !== user.id) throw new Error(`Demo account email is already in use: ${user.email}`);
  const existing = existingUsers.find(item => item.id === user.id);
  if (existing && !existing.demo) throw new Error(`Refusing to overwrite non-demo users record ${user.id}`);
}

const existingListings = await list('listings');
for (const item of [...listings.map(listing => listing.id), ...orderListingIds]) {
  const existing = existingListings.find(record => record.id === item);
  if (existing && !existing.demo) throw new Error(`Refusing to overwrite non-demo listings record ${item}`);
}

const existingAuctions = await list('auctions');
for (const id of auctionIds) {
  const existing = existingAuctions.find(record => record.id === id);
  if (existing && !existing.demo) throw new Error(`Refusing to overwrite non-demo auctions record ${id}`);
}

if (resetActivity) {
  for (const user of users) {
    const userIndex = existingUsers.findIndex(record => record.id === user.id && record.demo);
    if (userIndex >= 0) {
      await remove('users', user.id);
      existingUsers.splice(userIndex, 1);
    }
  }
  await clearCollections(['bids', 'orders', 'payments']);
}

for (const user of users) {
  const created = await ensureRecord('users', user.id, { ...user, passwordHash, demo: true, createdAt: iso(30) }, existingUsers);
  if (!created) await update('users', user.id, { passwordHash, demo: true });
}

const existingOrders = await list('orders');
for (const item of listings) {
  await ensureRecord('listings', item.id, {
    fisherman: item.fisherman,
    fishType: item.fishType,
    quality: item.quality,
    size: item.size,
    quantity: item.quantity,
    location: item.location,
    expectedPrice: item.price,
    salePrice: item.price,
    saleMode: item.saleMode,
    description: `Practice listing to explore ${item.saleMode === 'bid' ? 'auction bidding' : 'fixed-price buying'}. No real seafood order is created.`,
    imageVerification: 'verified',
    status: item.saleMode === 'bid' ? 'auction' : 'available',
    demo: true,
    createdAt: iso(item.age)
  }, existingListings);
}

if (resetActivity) {
  for (const item of listings) {
    const savedListing = existingListings.find(record => record.id === item.id);
    if (savedListing?.demo) {
      const restored = await update('listings', item.id, {
        status: item.saleMode === 'bid' ? 'auction' : 'available',
        reservedBy: null
      });
      Object.assign(savedListing, restored);
    }
  }
}

for (const index of purchaseListingIndexes) {
  const listing = listings[index];
  const existingOrder = existingOrders.find(order => order.demo && order.listing === listing.id);
  const existingListing = existingListings.find(item => item.id === listing.id);
  if (existingOrder && existingListing?.demo) {
    const restored = await update('listings', listing.id, {
      status: listing.saleMode === 'bid' ? 'auction' : 'available',
      reservedBy: null
    });
    Object.assign(existingListing, restored);
  }
}

const orderListings = [];
for (let index = 0; index < purchaseListingIndexes.length; index += 1) {
  const listing = listings[purchaseListingIndexes[index]];
  const orderListing = {
    id: `demo-order-listing-${index + 1}`,
    fisherman: listing.fisherman,
    fishType: listing.fishType,
    quality: listing.quality,
    size: listing.size,
    quantity: listing.quantity,
    location: listing.location,
    expectedPrice: listing.price,
    salePrice: listing.price,
    saleMode: 'sale',
    description: 'Practice order record; this is not an actual seafood purchase.',
    status: 'reserved',
    reservedBy: buyers[index % buyers.length],
    demo: true,
    createdAt: iso(index + 1, 13)
  };
  const created = await ensureRecord('listings', orderListing.id, orderListing, existingListings);
  if (!created && resetActivity) {
    const restored = await update('listings', orderListing.id, orderListing);
    Object.assign(existingListings.find(item => item.id === orderListing.id), restored);
  }
  orderListings.push(orderListing);
}

const existingBids = await list('bids');
for (const auction of auctions) {
  const existingAuction = existingAuctions.find(item => item.id === auction.id);
  const firstDemoBid = existingBids
    .filter(bid => bid.auction === auction.id && bid.demo)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  if (existingAuction?.demo && firstDemoBid && new Date(existingAuction.startTime) > new Date(firstDemoBid.createdAt)) {
    const restored = await update('auctions', auction.id, {
      startTime: new Date(new Date(firstDemoBid.createdAt).getTime() - 3600000).toISOString()
    });
    Object.assign(existingAuction, restored);
  }
  const created = await ensureRecord('auctions', auction.id, { ...auction, demo: true, createdAt: auction.startTime }, existingAuctions);
  if (!created && resetActivity) {
    const restored = await update('auctions', auction.id, {
      ...auction,
      demo: true,
      winner: null,
      winningBid: null
    });
    Object.assign(existingAuction, restored);
  }
}

for (const [auctionIndex, auction] of auctions.entries()) {
  const listing = listings.find(item => item.id === auction.listing);
  const count = 2 + auctionIndex % 2;
  for (let bidIndex = 0; bidIndex < count; bidIndex += 1) {
    const bidId = `demo-bid-${listing.id.replace('demo-listing-', '')}-${bidIndex + 1}`;
    await ensureRecord('bids', bidId, {
      auction: auction.id,
      buyer: buyers[(auctionIndex + bidIndex) % buyers.length],
      amount: listing.price + (bidIndex + 1) * 10,
      demo: true,
      createdAt: iso(Math.max(0, listing.age - bidIndex), 10 + bidIndex)
    }, existingBids);
  }
}

const existingPayments = await list('payments');
for (let index = 0; index < purchaseListingIndexes.length; index += 1) {
  const listing = listings[purchaseListingIndexes[index]];
  const orderListing = orderListings[index];
  const buyer = buyers[index % buyers.length];
  const orderId = `demo-order-${index + 1}`;
  const amount = listing.price * listing.quantity;
  const order = {
    orderNumber: `TM-DEMO-${String(index + 1).padStart(3, '0')}`,
    listing: orderListing.id,
    buyer,
    fisherman: listing.fisherman,
    quantity: listing.quantity,
    amount,
    paymentStatus: 'pending',
    orderStatus: 'awaiting-payment',
    purchaseType: 'practice',
    paymentMethod: 'Practice checkout',
    demo: true,
    createdAt: iso(index + 1, 13)
  };
  const savedOrder = await ensureRecord('orders', orderId, order, existingOrders);
  if (!savedOrder) await update('orders', orderId, { listing: orderListing.id });
  const payment = {
    order: orderId,
    orderNumber: `TM-DEMO-${String(index + 1).padStart(3, '0')}`,
    buyer,
    fisherman: listing.fisherman,
    listing: orderListing.id,
    amount,
    currency: 'INR',
    gateway: 'demo',
    mode: 'practice',
    status: 'practice',
    demo: true,
    createdAt: iso(index + 1, 13)
  };
  const savedPayment = await ensureRecord('payments', `demo-payment-${index + 1}`, payment, existingPayments);
  if (!savedPayment) await update('payments', `demo-payment-${index + 1}`, { listing: orderListing.id });
}

console.log(`Demo marketplace ready: ${users.filter(user => user.role === 'fisherman').length} fishermen, ${buyers.length} buyers, ${listings.length} seafood listings across ${new Set(listings.map(item => item.fishType)).size} species, ${auctions.length} auctions, ${existingBids.filter(bid => bid.demo).length} demo bids, and ${purchaseListingIndexes.length} practice orders and transactions.`);
console.log(`Demo account password: ${password}`);
for (const user of users) console.log(`${user.role}: ${user.email}`);
