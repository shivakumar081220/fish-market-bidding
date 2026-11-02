import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, Fish, Gavel, Trophy } from 'lucide-react';
import { api } from './api.js';

const money = amount => `₹${Number(amount || 0).toLocaleString()}`;
const date = value => value ? new Date(value).toLocaleString() : 'Date unavailable';

export default function BidMonitoring({ title = 'Bid history & review' }) {
  const [auctions, setAuctions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.bidMonitoring().then(setAuctions).catch(err => setError(err.message));
  }, []);

  const bids = auctions.flatMap(auction => auction.bids);
  const flaggedCount = bids.filter(bid => bid.riskReviewNeeded).length;

  return <section className="panel bid-monitoring">
    <div className="bid-monitor-title">
      <span className="bid-monitor-title-icon"><Gavel size={19} /></span>
      <div><p className="kicker">AUCTION OVERSIGHT</p><h2>{title}</h2><p>Review live activity and automated risk signals.</p></div>
      <div className="bid-monitor-summary">
        <span><strong>{auctions.length}</strong> auctions</span>
        <span><strong>{bids.length}</strong> bids</span>
        <span className={flaggedCount ? 'has-flags' : ''}><strong>{flaggedCount}</strong> flagged</span>
      </div>
    </div>
    <p className="history-note">Automated signals flag unusual patterns for human review; a flag is not proof of fraud and does not block a bid.</p>
    {error && <p className="notice">{error}</p>}
    {!error && auctions.length === 0 && <p className="empty">Auction and bid history will appear here.</p>}
    {auctions.map(auction => <section className="bid-monitor-auction" key={auction.id} aria-label={`${auction.listing?.fishType || 'Fish'} auction`}>
      <div className="bid-monitor-heading">
        <span className="bid-auction-icon"><Fish size={18} /></span>
        <div className="bid-auction-details">
          <strong>{auction.listing?.fishType || 'Fish auction'} <span>· {auction.listing?.quantity || 0} kg</span></strong>
          <small>{auction.listing?.location || 'Location unavailable'} · {auction.status}</small>
        </div>
        {auction.winner
          ? <span className="bid-winner"><Trophy size={15} /><span>Winner: {auction.winnerName || 'Buyer'}<strong>{money(auction.winningBid)}/kg</strong></span></span>
          : <span className="bid-auction-end"><Clock3 size={14} /><span>Ends<strong>{date(auction.endTime)}</strong></span></span>}
      </div>
      {auction.bids.length === 0
        ? <p className="empty bid-monitor-empty"><Gavel size={15} /> No bids recorded yet.</p>
        : auction.bids.map(bid => <article className={`bid-monitor-row${bid.riskReviewNeeded ? ' needs-review' : ''}`} key={bid.id}>
          <span className="bidder-avatar" aria-hidden="true">{(bid.buyer?.name || 'B').trim().charAt(0).toUpperCase()}</span>
          <div className="bid-monitor-bidder">
            <strong>{bid.buyer?.name || 'Unknown buyer'}</strong>
            <small>{date(bid.createdAt)}</small>
          </div>
          <strong className="bid-monitor-amount"><small>Bid / kg</small>{money(bid.amount)}</strong>
          {bid.riskReviewNeeded && <div className="bid-risk-flags">
            <AlertTriangle size={15} />
            <span><strong>Review signal</strong>{bid.riskFlags.map(flag => flag.detail).join(' · ')}</span>
          </div>}
        </article>)}
    </section>)}
    {!error && auctions.length > 0 && <p className="bid-monitor-footnote"><Gavel size={14} /> Risk signals: 5+ bids by one buyer within 60 seconds, or a bid at least twice and five minimum increments above the previous high.</p>}
  </section>;
}
