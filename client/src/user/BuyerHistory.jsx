import { useEffect, useState } from 'react';
import { Gavel, ShoppingBag } from 'lucide-react';
import { api } from '../api.js';

const money = amount => `₹${Number(amount || 0).toLocaleString()}`;
const date = value => value ? new Date(value).toLocaleString() : 'Date unavailable';

function HistoryRows({ entries, kind }) {
  if (!entries.length) return <p className="empty">No {kind} history yet.</p>;
  return entries.map(item => <article className="history-row" key={item.id}>
    <div className="history-main">
      <strong>{kind === 'bids' ? item.fishType : `${item.fishType} · ${item.orderNumber || 'Order'}`}</strong>
      <small>{date(item.createdAt)}{item.quantity ? ` · ${item.quantity} kg` : ''}</small>
      {kind === 'bids' && <small>Highest bid: {money(item.highestBid)}/kg</small>}
      {kind === 'orders' && item.paymentMethod && <small>Payment method: {item.paymentMethod}</small>}
      {item.demo && <small className="practice-history-note">Practice data · no real order or payment</small>}
    </div>
    <div className="history-side">
      <strong>{money(item.amount)}{kind === 'bids' ? '/kg' : ''}</strong>
      <span className={`transaction-status transaction-${kind === 'bids' ? item.bidStatus : kind === 'orders' ? item.paymentStatus : item.status}`}>
        {kind === 'bids' ? item.bidStatus : kind === 'orders' ? `payment ${item.paymentStatus}` : item.status}
      </span>
      {kind === 'orders' && <small>{item.orderStatus}</small>}
    </div>
  </article>);
}

export default function BuyerHistory() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.buyerHistory().then(setHistory).catch(err => setError(err.message));
  }, []);

  return <section className="panel buyer-history">
    <div className="panel-title"><h2>Your bids &amp; orders</h2><span>Private to your account</span></div>
    <p className="history-note">Payment attempts and verified payment status are shown separately in Transactions.</p>
    {error && <p className="notice">{error}</p>}
    {!history && !error && <p className="empty">Loading your account history...</p>}
    {history && <>
      <section className="history-group">
        <h3><Gavel size={17} /> My bids</h3>
        <HistoryRows entries={history.bids} kind="bids" />
      </section>
      <section className="history-group">
        <h3><ShoppingBag size={17} /> My purchases</h3>
        <HistoryRows entries={history.orders} kind="orders" />
      </section>
    </>}
  </section>;
}
