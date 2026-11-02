import express from 'express';
import bcrypt from 'bcryptjs';
import { get, insert, list, update, where, sortNewest, sanitizeUser } from '../db.js';
import { allow, requireAuth } from '../auth.js';
const router = express.Router();
router.use(requireAuth, allow('admin'));
router.get('/registration-requests', async (req, res) => res.json(sortNewest((await list('registrationRequests')).filter(item => item.status === 'pending').map(item => ({ ...item, passwordHash: undefined })) )));
router.patch('/registration-requests/:id/accept', async (req, res) => { const request = await get('registrationRequests', req.params.id); if (!request || request.status !== 'pending') return res.status(404).json({ message: 'Pending request not found' }); if ((await list('users')).some(user => user.email === request.email)) return res.status(409).json({ message: 'Email is already registered' }); const userData = { name: request.name, email: request.email, passwordHash: request.passwordHash, role: 'buyer' }; if (request.phone) userData.phone = request.phone; if (request.location) userData.location = request.location; const user = await insert('users', userData); await update('registrationRequests', request.id, { status: 'accepted', reviewedAt: new Date().toISOString(), reviewedBy: req.user.id }); res.json({ message: 'Buyer account approved', user: sanitizeUser(user) }); });
router.patch('/registration-requests/:id/reject', async (req, res) => { const request = await get('registrationRequests', req.params.id); if (!request || request.status !== 'pending') return res.status(404).json({ message: 'Pending request not found' }); res.json(await update('registrationRequests', request.id, { status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: req.user.id })); });
router.post('/fishermen', async (req, res) => { try { const { name, email, password, phone, location } = req.body; if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' }); const normalizedEmail = email.toLowerCase(); const existing = (await list('users')).find(user => user.email === normalizedEmail); if (existing) return res.status(400).json({ message: 'Email is already registered' }); const fishermanData = { name, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'fisherman' }; if (phone) fishermanData.phone = phone; if (location) fishermanData.location = location; const fisherman = await insert('users', fishermanData); res.status(201).json(sanitizeUser(fisherman)); } catch (error) { res.status(400).json({ message: error.message }); } });
router.get('/fishermen/:id', async (req, res) => { const fisherman = await get('users', req.params.id); if (!fisherman || fisherman.role !== 'fisherman') return res.status(404).json({ message: 'Fisherman not found' }); const listings = (await list('listings')).filter(item => item.fisherman === fisherman.id); const auctions = await list('auctions'); const bids = await list('bids'); const orders = (await list('orders')).filter(item => item.fisherman === fisherman.id); const paidOrders = orders.filter(order => order.paymentStatus === 'paid' && order.gateway === 'razorpay'); const fish = listings.map(listing => { const auction = auctions.find(item => item.listing === listing.id); const fishBids = auction ? bids.filter(item => item.auction === auction.id) : []; const sale = orders.find(item => item.listing === listing.id); const paidSale = paidOrders.find(item => item.listing === listing.id); return { ...listing, auction: auction || null, bids: fishBids.length, highestBid: Math.max(0, ...fishBids.map(item => Number(item.amount || 0))), saleAmount: Number(paidSale?.amount || 0), saleStatus: sale ? `${sale.orderStatus} · payment ${sale.paymentStatus}` : listing.status }; }); res.json({ fisherman: sanitizeUser(fisherman), listings: fish, orders, totalGained: paidOrders.reduce((total, order) => total + Number(order.amount || 0), 0) }); });
router.get('/listings', async (req, res) => {
  const [listings, users, auctions, bids] = await Promise.all(['listings', 'users', 'auctions', 'bids'].map(list));
  const usersById = new Map(users.map(user => [user.id, sanitizeUser(user)]));
  const auctionByListing = new Map(auctions.map(auction => [auction.listing, auction]));
  const bidCounts = bids.reduce((counts, bid) => {
    counts[bid.auction] = (counts[bid.auction] || 0) + 1;
    return counts;
  }, {});
  res.json(sortNewest(listings).map(item => {
    const auction = auctionByListing.get(item.id);
    return {
      ...item,
      fisherman: usersById.get(item.fisherman) || null,
      auction: auction ? { ...auction, bidCount: bidCounts[auction.id] || 0 } : null
    };
  }));
});
router.delete('/listings/:id', async (req, res) => {
  const listing = await get('listings', req.params.id);
  if (!listing || listing.status === 'removed') return res.status(404).json({ message: 'Marketplace listing not found' });
  const auction = (await list('auctions')).find(item => item.listing === listing.id);
  if (auction && auction.status !== 'completed' && auction.status !== 'cancelled') {
    await update('auctions', auction.id, { status: 'cancelled', endTime: new Date().toISOString(), cancelledBy: req.user.id });
  }
  const removedListing = await update('listings', listing.id, {
    status: 'removed',
    removedAt: new Date().toISOString(),
    removedBy: req.user.id
  });
  res.json({ message: `${listing.fishType || 'Listing'} removed from the marketplace`, listing: removedListing });
});
router.get('/overview', async (req, res) => { const [users, listings, auctions, bids, orders] = await Promise.all(['users', 'listings', 'auctions', 'bids', 'orders'].map(list)); const paidTotal = orders.filter(order => order.paymentStatus === 'paid' && order.gateway === 'razorpay').reduce((total, order) => total + Number(order.amount || 0), 0); res.json({ counts: { users: users.length, listings: listings.filter(item => ['available', 'auction'].includes(item.status)).length, auctions: auctions.length, bids: bids.length, orders: orders.length }, paidTotal, recentOrders: sortNewest(orders).slice(0, 8) }); });
router.get('/users', async (req, res) => res.json(sortNewest((await list('users')).map(sanitizeUser))));
export default router;
