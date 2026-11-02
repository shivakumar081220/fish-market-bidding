import { get, insert, list, update, where, sortAmount } from './db.js';

export const FISH_TYPES = [
  'Tuna', 'Pomfret', 'Mackerel', 'Sardine', 'Prawns', 'Kingfish', 'Crab', 'Squid', 'Lobster', 'Clams', 'Mussels', 'Oysters', 'Anchovy', 'Seer Fish',
  'Bangus', 'Big Head Carp', 'Black Spotted Barb', 'Catfish', 'Climbing Perch', 'Fourfinger Threadfin', 'Freshwater Eel', 'Glass Perchlet',
  'Goby', 'Gold Fish', 'Gourami', 'Grass Carp', 'Green Spotted Puffer', 'Indian Carp', 'Indo-Pacific Tarpon', 'Jaguar Gapote',
  'Janitor Fish', 'Knifefish', 'Long-Snouted Pipefish', 'Mosquito Fish', 'Mudfish', 'Mullet', 'Pangasius', 'Perch',
  'Scat Fish', 'Silver Barb', 'Silver Carp', 'Silver Perch', 'Snakehead', 'Tenpounder', 'Tilapia'
];
export const QUALITIES = ['Premium', 'Good', 'Standard'];
export const SIZES = ['Small', 'Medium', 'Large'];
export function predictPrice(fishType, quantity, quality, size) {
  const base = { Tuna: 360, Pomfret: 520, Mackerel: 220, Sardine: 180, Prawns: 600, Kingfish: 450, Bangus: 260, Crab: 720, Squid: 340, Lobster: 1200, Clams: 280, Mussels: 320, Oysters: 500, Anchovy: 200, 'Seer Fish': 680 }[fishType] || 250;
  const estimate = base * ({ Premium: 1.18, Good: 1, Standard: 0.84 }[quality] || 1) * ({ Large: 1.12, Medium: 1, Small: 0.9 }[size] || 1) * (quantity > 200 ? 0.98 : 1);
  return { low: +(estimate * 0.92).toFixed(2), high: +(estimate * 1.08).toFixed(2) };
}

export function assessBidRisk(bid, auctionBids, auction) {
  const bidTime = Date.parse(bid.createdAt || new Date().toISOString());
  const previousBids = auctionBids.filter(item => {
    if (item.id === bid.id) return false;
    const itemTime = Date.parse(item.createdAt || '');
    return Number.isFinite(itemTime) && itemTime < bidTime;
  });
  const previousHigh = Math.max(Number(auction.startPrice) || 0, ...previousBids.map(item => Number(item.amount) || 0));
  const increment = Number(auction.minimumIncrement) || 0;
  const amount = Number(bid.amount) || 0;
  const flags = [];
  const bidderBidsInWindow = auctionBids.filter(item => {
    if (item.buyer !== bid.buyer) return false;
    const itemTime = Date.parse(item.createdAt || '');
    return Number.isFinite(itemTime) && itemTime <= bidTime && itemTime >= bidTime - 60_000;
  });

  if (bidderBidsInWindow.length >= 5) {
    flags.push({
      code: 'rapid_bidding',
      severity: 'medium',
      detail: `${bidderBidsInWindow.length} bids from this buyer within 60 seconds`
    });
  }
  if (previousHigh > 0 && amount >= previousHigh * 2 && amount - previousHigh >= increment * 5) {
    flags.push({
      code: 'large_bid_jump',
      severity: 'high',
      detail: `Bid is at least twice the previous high of ₹${previousHigh.toLocaleString()}/kg`
    });
  }

  return { reviewNeeded: flags.length > 0, flags };
}

export async function refreshAuction(auction) {
  if (auction.status === 'cancelled') return auction;
  const now = new Date();
  const status = now < new Date(auction.startTime) ? 'scheduled' : now < new Date(auction.endTime) ? 'active' : 'completed';
  const changed = { status };
  if (status === 'completed') {
    const bids = sortAmount(where(await list('bids'), { auction: auction.id }));
    const best = bids[0];
    if (best) {
      const listing = await get('listings', auction.listing);
      changed.winner = best.buyer;
      changed.winningBid = best.amount;
      if (listing) {
        await update('listings', listing.id, { status: listing.saleMode === 'bid' ? 'auction' : 'sold' });
        const existing = (await list('orders')).find(order => order.auction === auction.id);
        if (!existing) await insert('orders', { orderNumber: `TM-${Date.now()}`, auction: auction.id, listing: listing.id, buyer: best.buyer, fisherman: listing.fisherman, quantity: listing.quantity, amount: best.amount * listing.quantity, paymentStatus: 'pending', orderStatus: 'awaiting-checkout', purchaseType: '', address: '', paymentMethod: '' }, `auction_${auction.id}`);
      }
    } else {
      changed.result = 'no-bids';
    }
  }
  const updated = await update('auctions', auction.id, changed);
  return { ...auction, ...updated };
}
