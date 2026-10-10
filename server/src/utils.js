import { get, insert, list, update, where, sortAmount } from './db.js';

export const FISH_TYPES = ['Tuna', 'Pomfret', 'Mackerel', 'Sardine', 'Prawns', 'Kingfish'];
export const QUALITIES = ['Premium', 'Good', 'Standard'];
export const SIZES = ['Small', 'Medium', 'Large'];
export function predictPrice(fishType, quantity, quality, size) {
  const base = { Tuna: 360, Pomfret: 520, Mackerel: 220, Sardine: 180, Prawns: 600, Kingfish: 450 }[fishType] || 250;
  const estimate = base * ({ Premium: 1.18, Good: 1, Standard: 0.84 }[quality] || 1) * ({ Large: 1.12, Medium: 1, Small: 0.9 }[size] || 1) * (quantity > 200 ? 0.98 : 1);
  return { low: +(estimate * 0.92).toFixed(2), high: +(estimate * 1.08).toFixed(2) };
}
export async function refreshAuction(auction) {
  if (auction.status === 'completed') return auction;
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
        if (!existing) await insert('orders', { orderNumber: `TM-${Date.now()}`, auction: auction.id, listing: listing.id, buyer: best.buyer, fisherman: listing.fisherman, quantity: listing.quantity, amount: best.amount * listing.quantity, paymentStatus: 'pending', orderStatus: 'awaiting-checkout', purchaseType: '', address: '', paymentMethod: '' });
      }
    }
  }
  return { ...auction, ...(await update('auctions', auction.id, changed)) };
}
