import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function TransactionHistory({ title = 'Transaction history' }) {
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.transactions().then(setTransactions).catch(err => setError(err.message));
  }, []);

  return <section className="panel transaction-panel">
    <div className="panel-title"><h2>{title}</h2><span>{transactions.length} payment attempts</span></div>
    {error && <p className="notice">{error}</p>}
    {transactions.map(transaction => <article className="transaction-line" key={transaction.id}>
      <div className="transaction-details">
        <strong>{transaction.fishType} · Order {transaction.orderNumber || transaction.order}</strong>
        <small>{transaction.gatewayPaymentId || transaction.gatewayOrderId || transaction.id}</small>
        <small>{new Date(transaction.paidAt || transaction.createdAt).toLocaleString()} · {transaction.quantity} kg</small>
        {transaction.demo && <small className="practice-history-note">Practice data · no real payment processed</small>}
      </div>
      <div className="transaction-amount">
        <strong>₹{Number(transaction.amount || 0).toLocaleString()}</strong>
        <span className={`transaction-status transaction-${transaction.status}`}>{transaction.status}</span>
      </div>
    </article>)}
    {!error && transactions.length === 0 && <p className="empty">Payments and their status will appear here.</p>}
  </section>;
}
