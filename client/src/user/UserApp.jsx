import { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, BarChart3, CircleDollarSign, Clock3, Gavel, Heart, History, MapPin, ReceiptText, Search, ShoppingBag, Sparkles, Waves } from 'lucide-react';
import { api } from '../api.js';
import TransactionHistory from '../TransactionHistory.jsx';
import { sampleImageFor } from '../fishImages.js';
import BuyerHistory from './BuyerHistory.jsx';

const viewFromHash = () => {
  const hash = window.location.hash.slice(1);
  return ['history', 'transactions'].includes(hash) ? hash : 'market';
};

const fallback = [
  { id: 'demo-1', fishType: 'Tuna', quality: 'Premium', quantity: 100, location: 'Mangalore', expectedPrice: 380, salePrice: 380, saleMode: 'bid', status: 'auction', imageVerification: 'verified', description: 'Fresh morning catch.', auction: { id: 'demo-auction', startPrice: 380, currentPrice: 380, priceIncreasePercent: 0 } },
  { id: 'demo-2', fishType: 'Prawns', quality: 'Good', quantity: 65, location: 'Udupi', expectedPrice: 600, salePrice: 600, saleMode: 'sale', status: 'available', imageVerification: 'verified', description: 'Chilled prawns landed at sunrise.' }
];

const categories = [
  { name: 'Fish', image: '/images/category-fish-photo.jpe', matches: item => !['prawns', 'shrimp', 'crab', 'squid', 'squids', 'lobster', 'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop', 'scallops', 'shellfish'].some(type => String(item.fishType || '').toLowerCase().includes(type)) },
  { name: 'Prawns', image: '/images/category-prawns-photo.jpe', matches: item => /prawn|shrimp/i.test(String(item.fishType || '')) },
  { name: 'Crab', image: '/images/category-crab-photo.jpe', matches: item => /crab/i.test(String(item.fishType || '')) },
  { name: 'Squid', image: '/images/category-squid-photo.png', matches: item => /squid/i.test(String(item.fishType || '')) },
  { name: 'Shellfish', image: '/images/category-shellfish-photo.jpe', matches: item => /clam|mussel|oyster|scallop|shellfish/i.test(String(item.fishType || '')) },
  { name: 'Lobster', image: '/images/category-lobster-photo.jpe', matches: item => /lobster/i.test(String(item.fishType || '')) }
];

function listingImage(item) {
  const image = sampleImageFor(item);
  if (image) return image;
  return categories.find(category => category.name === categoryFor(item))?.image || '/images/category-fish.svg';
}

const itemPrice = item => Number(item.saleMode === 'bid'
  ? item.auction?.currentPrice || item.auction?.startPrice || item.expectedPrice || 0
  : item.salePrice || item.expectedPrice || 0);

function categoryFor(item) {
  return categories.find(category => category.matches(item))?.name || 'Fish';
}

function storedWishlist(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function countdown(endTime, now) {
  if (!endTime) return 'End time unavailable';
  const remaining = new Date(endTime).getTime() - now;
  if (remaining <= 0) return 'Auction ended';
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return days ? `${days}d ${hours}h left` : `${hours}h ${minutes}m ${seconds}s left`;
}

function FishCard({ item, onSelect, onBid, isWishlisted, onToggleWishlist, now }) {
  const closed = item.saleMode === 'bid' && (item.auction?.status === 'completed' || (item.auction?.endTime && new Date(item.auction.endTime).getTime() <= now));
  const auction = item.saleMode === 'bid';
  const price = itemPrice(item);
  const image = listingImage(item);
  return <article className="market-product-card">
    <div className="market-product-visual">
      <img className="market-product-image" src={image} alt={item.imageUrl ? `${item.fishType} catch` : `${item.fishType} sample image`} />
      <span className={`market-product-mode${auction && !closed ? ' is-live' : ''}`}>{auction ? closed ? 'Auction ended' : 'Live auction' : 'Fixed price'}</span>
      <button className={`wishlist-button${isWishlisted ? ' is-saved' : ''}`} aria-label={isWishlisted ? `Remove ${item.fishType} from wishlist` : `Add ${item.fishType} to wishlist`} aria-pressed={isWishlisted} onClick={() => onToggleWishlist(item.id)}><Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="market-product-body">
      {item.demo && <span className="market-practice-badge">Practice listing</span>}
      <div className="market-product-title">
        <div><span className="market-product-category">{categoryFor(item)}</span><h3>{item.fishType}</h3></div>
        <span className="market-freshness" title="Seller-reported quality grade; not an independent freshness or food-safety assessment."><BadgeCheck size={15} /><span><small>Seller quality</small>{item.quality || 'Not set'}</span></span>
      </div>
      <p className="market-seller">By {item.fisherman?.name || 'Local fisherman'}</p>
      <div className="market-product-facts">
        <span><MapPin size={14} /> {item.location || 'Location unavailable'}</span>
        <span><ShoppingBag size={14} /> {Number(item.quantity || 0).toLocaleString()} kg available</span>
      </div>
      {auction && <div className="market-auction-fact">
        <span><Clock3 size={14} /> {closed ? 'Auction closed' : countdown(item.auction?.endTime, now)}</span>
        <span><Gavel size={14} /> {Number(item.auction?.bidCount || 0) ? 'Highest bid' : 'Starting bid'} · ₹{price.toLocaleString()}/kg</span>
      </div>}
      <div className="market-product-price"><span>{auction ? Number(item.auction?.bidCount || 0) ? 'Current highest bid' : 'Starting bid' : 'Price per kg'}</span><strong>₹{price.toLocaleString()}<small>/kg</small></strong></div>
      <div className="market-product-actions">
        <button className="market-details-button" onClick={() => onSelect(item)}>View details</button>
        <button className="market-buy-button" disabled={auction && closed} onClick={() => auction ? onBid(item) : onSelect(item)}>{auction ? closed ? 'Auction ended' : 'Place bid' : 'Buy now'}</button>
      </div>
    </div>
  </article>;
}

function MarketTrendChart({ data, loading, error, days, onDaysChange, fishType, onFishTypeChange, items, now }) {
  const points = data?.points || [];
  const totalsByFish = points.reduce((totals, point) => {
    totals[point.fishType] = (totals[point.fishType] || 0) + point.observations;
    return totals;
  }, {});
  const availableFish = Object.keys(totalsByFish).sort((a, b) => totalsByFish[b] - totalsByFish[a] || a.localeCompare(b));
  const selectedFish = fishType === 'all' ? availableFish.slice(0, 4) : [fishType];
  const chartPoints = points.filter(point => selectedFish.includes(point.fishType));
  const dates = [...new Set(chartPoints.map(point => point.date))].sort();
  const pointByDateFish = new Map(chartPoints.map(point => [`${point.date}:${point.fishType}`, point]));
  const maxPrice = Math.max(0, ...chartPoints.map(point => point.averagePrice));
  const step = maxPrice <= 500 ? 100 : maxPrice <= 2000 ? 500 : 1000;
  const yMax = Math.max(step, Math.ceil(maxPrice / step) * step);
  const chart = { width: 840, height: 250, left: 62, right: 22, top: 18, bottom: 42 };
  const plotWidth = chart.width - chart.left - chart.right;
  const plotHeight = chart.height - chart.top - chart.bottom;
  const colors = ['#0b9a91', '#f06b68', '#8065df', '#e4a62c'];
  const dateLabel = value => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const activeAuctions = items.filter(item => item.saleMode === 'bid' && item.auction?.status !== 'completed' && (!item.auction?.endTime || new Date(item.auction.endTime).getTime() > now));
  const activeBidCount = activeAuctions.reduce((total, item) => total + Number(item.auction?.bidCount || 0), 0);

  return <section className="market-trend-panel" aria-label="Market price trend">
    <div className="market-trend-heading">
      <div className="market-trend-title">
        <span className="market-trend-icon"><BarChart3 size={19} /></span>
        <div><p className="kicker">LIVE OCEAN MARKET PULSE</p><h2>Seafood prices &amp; trends</h2><p>Current market activity and daily average prices from listings and bids.</p></div>
      </div>
      <div className="market-trend-controls">
        <label><span>Period</span><select value={days} onChange={event => onDaysChange(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label>
        {availableFish.length > 1 && <label><span>Seafood</span><select value={fishType} onChange={event => onFishTypeChange(event.target.value)}><option value="all">Top seafood</option>{availableFish.map(type => <option key={type} value={type}>{type}</option>)}</select></label>}
      </div>
    </div>
    <div className="market-pulse-stats" aria-label="Current marketplace activity">
      <article><span>Available lots</span><strong>{items.length}</strong></article>
      <article><span>Live auctions</span><strong>{activeAuctions.length}</strong></article>
      <article><span>Bids on live auctions</span><strong>{activeBidCount}</strong></article>
      {data?.generatedAt && <span className="market-pulse-updated">Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
    </div>
    {error && <p className="notice market-trend-message">{error}</p>}
    {loading && <p className="empty market-trend-message">Loading recorded market prices…</p>}
    {!loading && !error && !chartPoints.length && <p className="empty market-trend-message">Price trends will appear as fishermen publish listings and buyers place bids during this period.</p>}
    {!loading && !error && chartPoints.length > 0 && <>
      <div className="market-trend-chart-wrap">
        <svg className="market-trend-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`Daily recorded seafood prices over the last ${days} days`}>
          {[0, 1, 2, 3, 4].map(tick => {
            const value = yMax * tick / 4;
            const y = chart.top + plotHeight * (1 - tick / 4);
            return <g key={tick}>
              <line x1={chart.left} y1={y} x2={chart.width - chart.right} y2={y} className="trend-gridline" />
              <text x={chart.left - 10} y={y + 4} textAnchor="end" className="trend-axis-label">₹{Math.round(value).toLocaleString()}</text>
            </g>;
          })}
          {dates.map((date, dateIndex) => {
            const slotWidth = plotWidth / dates.length;
            const seriesCount = selectedFish.length;
            const groupWidth = Math.min(slotWidth * .66, seriesCount * 32);
            const barWidth = Math.max(8, Math.min(24, (groupWidth / Math.max(seriesCount, 1)) - 5));
            const groupStart = chart.left + slotWidth * dateIndex + (slotWidth - groupWidth) / 2;
            return <g key={date}>
              {selectedFish.map((type, seriesIndex) => {
                const point = pointByDateFish.get(`${date}:${type}`);
                if (!point) return null;
                const barHeight = Math.max(2, plotHeight * point.averagePrice / yMax);
                const x = groupStart + seriesIndex * (groupWidth / seriesCount) + (groupWidth / seriesCount - barWidth) / 2;
                const y = chart.top + plotHeight - barHeight;
                return <g key={type}>
                  <rect x={x} y={y} width={barWidth} height={barHeight} rx="5" fill={colors[seriesIndex % colors.length]} className="trend-bar">
                    <title>{`${type} · ${dateLabel(date)} · ₹${point.averagePrice.toLocaleString()}/kg · ${point.observations} recorded ${point.observations === 1 ? 'price' : 'prices'}`}</title>
                  </rect>
                </g>;
              })}
              {(dateIndex % Math.ceil(dates.length / 8) === 0 || dateIndex === dates.length - 1) && <text x={chart.left + slotWidth * dateIndex + slotWidth / 2} y={chart.height - 19} textAnchor="middle" className="trend-axis-label">{dateLabel(date)}</text>}
            </g>;
          })}
        </svg>
      </div>
      <div className="market-trend-legend">{selectedFish.map((type, index) => <span key={type}><i style={{ backgroundColor: colors[index % colors.length] }} />{type}</span>)}</div>
      <p className="market-trend-footnote">These are observed listing prices and auction bids, not completed-sale prices. Only dates with recorded price activity are shown.</p>
    </>}
  </section>;
}

export default function UserApp({ user, onAuth }) {
  const wishlistStorageKey = `tide_wishlist_${user?.id || 'guest'}`;
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showBiddingGuide, setShowBiddingGuide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [bidAmount, setBidAmount] = useState('');
  const [checkout, setCheckout] = useState(null);
  const [transactionRefresh, setTransactionRefresh] = useState(0);
  const [dashboardView, setDashboardView] = useState(viewFromHash);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [wishlist, setWishlist] = useState(() => storedWishlist(wishlistStorageKey));
  const [now, setNow] = useState(Date.now());
  const [trendDays, setTrendDays] = useState(7);
  const [trendFishType, setTrendFishType] = useState('all');
  const [trendData, setTrendData] = useState(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');
  const [trendRefresh, setTrendRefresh] = useState(0);
  const [buyerHistory, setBuyerHistory] = useState(null);
  const [buyerHistoryLoading, setBuyerHistoryLoading] = useState(false);
  const [buyerHistoryError, setBuyerHistoryError] = useState('');
  const [recommendationCategory, setRecommendationCategory] = useState('All');
  const [recommendationBudget, setRecommendationBudget] = useState('');
  const [recommendationLocation, setRecommendationLocation] = useState('');
  const [recommendationQuality, setRecommendationQuality] = useState('');
  const [recommendationSaleMode, setRecommendationSaleMode] = useState('all');
  const [recommendationWishlistOnly, setRecommendationWishlistOnly] = useState(false);
  const [listingError, setListingError] = useState('');

  useEffect(() => {
    let active = true;
    const refreshListings = async () => {
      try {
        const listings = await api.listings();
        if (!active) return;
        setItems(listings);
        setListingError('');
      } catch (error) {
        if (!active) return;
        setListingError(error.message);
        setItems(current => current.length ? current : fallback);
      } finally {
        if (active) setLoading(false);
      }
    };
    refreshListings();
    const interval = window.setInterval(refreshListings, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setTrendLoading(true);
    setTrendError('');
    api.marketTrends(trendDays)
      .then(data => { if (active) setTrendData(data); })
      .catch(error => { if (active) setTrendError(error.message); })
      .finally(() => { if (active) setTrendLoading(false); });
    return () => { active = false; };
  }, [trendDays, trendRefresh]);

  useEffect(() => {
    if (user?.role !== 'buyer') {
      setBuyerHistory(null);
      return undefined;
    }
    let active = true;
    setBuyerHistoryLoading(true);
    setBuyerHistoryError('');
    api.buyerHistory()
      .then(history => { if (active) setBuyerHistory(history); })
      .catch(error => { if (active) setBuyerHistoryError(error.message); })
      .finally(() => { if (active) setBuyerHistoryLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, transactionRefresh]);

  useEffect(() => {
    const interval = window.setInterval(() => setTrendRefresh(value => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setWishlist(storedWishlist(wishlistStorageKey));
  }, [wishlistStorageKey]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateView = () => setDashboardView(viewFromHash());
    window.addEventListener('hashchange', updateView);
    return () => window.removeEventListener('hashchange', updateView);
  }, []);

  const locationOptions = [...new Set(items.map(item => item.location).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const priceHighlights = [...items].sort((a, b) => itemPrice(a) - itemPrice(b)).slice(0, 3);
  const visible = items.filter(item => {
    const category = categories.find(option => option.name === selectedCategory);
    return selectedCategory === 'All' || category?.matches(item);
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const activeAuctions = items.filter(item => item.saleMode === 'bid' && item.auction?.status !== 'completed' && (!item.auction?.endTime || new Date(item.auction.endTime).getTime() > now)).length;
  const landingLocations = new Set(items.map(item => item.location).filter(Boolean)).size;
  const purchaseCounts = [...(buyerHistory?.orders || []), ...(buyerHistory?.bids || [])].reduce((counts, activity) => {
    const fishType = String(activity.fishType || '').toLowerCase();
    if (fishType) counts[fishType] = (counts[fishType] || 0) + 1;
    return counts;
  }, {});
  const recommendedItems = items
    .filter(item => {
      const category = categories.find(option => option.name === recommendationCategory);
      return (recommendationCategory === 'All' || category?.matches(item))
        && (!recommendationBudget || itemPrice(item) <= Number(recommendationBudget))
        && (!recommendationLocation || item.location === recommendationLocation)
        && (!recommendationQuality || item.quality === recommendationQuality)
        && (recommendationSaleMode === 'all' || (recommendationSaleMode === 'auction' ? item.saleMode === 'bid' : item.saleMode !== 'bid'))
        && (!recommendationWishlistOnly || wishlist.includes(item.id));
    })
    .map(item => ({ item, historyMatches: purchaseCounts[String(item.fishType || '').toLowerCase()] || 0 }))
    .sort((a, b) => b.historyMatches - a.historyMatches || itemPrice(a.item) - itemPrice(b.item))
    .slice(0, 3);
  const freshCatchItems = visible.filter(item => item.saleMode !== 'bid' || item.auction?.status === 'completed' || (item.auction?.endTime && new Date(item.auction.endTime).getTime() <= now));
  const liveAuctionItems = visible.filter(item => item.saleMode === 'bid' && item.auction?.status !== 'completed' && (!item.auction?.endTime || new Date(item.auction.endTime).getTime() > now));
  const nearbyFishermen = [...items.reduce((fishermen, item) => {
    const name = item.fisherman?.name;
    if (!name) return fishermen;
    const id = item.fisherman.id || name;
    const fisherman = fishermen.get(id) || { id, name, locations: new Set(), listingCount: 0 };
    if (item.location) fisherman.locations.add(item.location);
    fisherman.listingCount += 1;
    fishermen.set(id, fisherman);
    return fishermen;
  }, new Map()).values()].slice(0, 4);
  const toggleWishlist = id => setWishlist(current => {
    const next = current.includes(id) ? current.filter(itemId => itemId !== id) : [...current, id];
    localStorage.setItem(wishlistStorageKey, JSON.stringify(next));
    return next;
  });
  const beginBid = item => {
    if (!user) return onAuth('login');
    setSelected(item);
    setBidAmount(String(itemPrice(item) + Number(item.auction?.minimumIncrement || 1)));
    setMessage('');
  };
  const placeBid = async () => {
    if (!user) return onAuth('login');
    try {
      await api.bid(selected.auction.id, Number(bidAmount));
      setTransactionRefresh(value => value + 1);
      setMessageType('success');
      setMessage('Your bid is live.');
      setTrendRefresh(value => value + 1);
      const updated = await api.listing(selected.id);
      setSelected(updated);
      setItems(current => current.map(item => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessageType('error');
      setMessage(error.message);
    }
  };

  const startPayment = async form => {
    if (!user) return onAuth('login');
    let payment;
    try {
      payment = await api.createPayment({
        ...(checkout.type === 'auction' ? { auctionId: selected.auction.id } : { listingId: selected.id }),
        address: form.address
      });
      setTransactionRefresh(value => value + 1);

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      await new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve();
        script.onload = resolve;
        script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your internet connection and try again.'));
        document.body.appendChild(script);
      });
      const checkoutOptions = {
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: payment.name,
        description: payment.description,
        order_id: payment.gatewayOrderId,
        prefill: { name: user.name, email: user.email },
        theme: { color: '#f47a58' },
        handler: async result => {
          try {
            await api.verifyPayment({ transactionId: payment.transactionId, ...result });
            setTransactionRefresh(value => value + 1);
            setMessageType('success');
            setMessage(`Payment confirmed. Order ${payment.orderNumber} is being processed.`);
            setCheckout(null);
            setSelected(null);
          } catch (error) {
            setTransactionRefresh(value => value + 1);
            setMessageType('error');
            setMessage(error.message);
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              await api.recordPaymentFailure({ transactionId: payment.transactionId, reason: 'Checkout was closed before payment completed' });
              setTransactionRefresh(value => value + 1);
              setMessageType('error');
              setMessage('Checkout closed. No payment was confirmed; you can retry from the listing.');
            } catch (error) {
              setMessageType('error');
              setMessage(error.message);
            }
          }
        }
      };
      const razorpay = new window.Razorpay(checkoutOptions);
      razorpay.on('payment.failed', async event => {
        try {
          await api.recordPaymentFailure({
            transactionId: payment.transactionId,
            reason: event.error?.description || 'Payment was not completed'
          });
          setTransactionRefresh(value => value + 1);
          setMessageType('error');
          setMessage(event.error?.description || 'Payment was not completed. You can retry checkout.');
        } catch (error) {
          setMessageType('error');
          setMessage(error.message);
        }
      });
      setCheckout(null);
      razorpay.open();
    } catch (error) {
      let displayError = error.message;
      if (payment?.transactionId) {
        try {
          await api.recordPaymentFailure({ transactionId: payment.transactionId, reason: 'Checkout could not be opened' });
        } catch (recordError) {
          displayError = `${displayError} Payment history update failed: ${recordError.message}`;
        }
      }
      setTransactionRefresh(value => value + 1);
      setMessageType('error');
      setMessage(displayError);
      throw new Error(displayError);
    }
  };

  const bidClosed = selected?.saleMode === 'bid' && (selected?.auction?.status === 'completed' || (selected?.auction?.endTime && new Date(selected.auction.endTime).getTime() <= now));
  const buyerView = user?.role === 'buyer';
  const currentView = buyerView ? dashboardView : 'market';
  return <div className={`user-shell${buyerView ? ' buyer-dashboard' : ''}`}>
    {buyerView && <>
      <section className="buyer-overview">
        <div className="buyer-welcome">
          <div>
            <p className="kicker">BUYER WORKSPACE</p>
            <h1>Welcome back, {user.name?.split(' ')[0] || 'there'}.</h1>
            <p>Find today's catch, follow your bids, and keep track of every payment.</p>
          </div>
          <span className="buyer-live-pill"><span /> MARKET OPEN</span>
        </div>
        <div className="buyer-stat-grid">
          <article className="buyer-stat"><span>Available lots</span><strong>{loading ? '—' : items.length}</strong><small>Fresh catches listed</small></article>
          <article className="buyer-stat"><span>Live auctions</span><strong>{loading ? '—' : activeAuctions}</strong><small>Open for bidding</small></article>
          <article className="buyer-stat"><span>Landing locations</span><strong>{loading ? '—' : landingLocations}</strong><small>Coastal ports covered</small></article>
        </div>
      </section>
      <nav className="buyer-dashboard-nav" aria-label="Buyer dashboard">
        <a className={currentView === 'market' ? 'active' : ''} href="#market"><Search size={17} /> Marketplace</a>
        <a className={currentView === 'history' ? 'active' : ''} href="#history"><History size={17} /> Bids &amp; orders</a>
        <a className={currentView === 'transactions' ? 'active' : ''} href="#transactions"><ReceiptText size={17} /> Transactions</a>
      </nav>
    </>}
    {currentView === 'market' && <>
      {!user && <section className="guest-hero">
        <div className="guest-hero-copy">
          <span className="guest-eyebrow"><Waves size={15} /> TIDEMARKET · YOUR COASTAL MARKETPLACE</span>
          <h1>From Our Coast,<br /><em>Fresh to Your Table.</em></h1>
          <p>Discover responsibly sourced seafood, connect with local fishers, and bring the day’s finest catch straight to your table.</p>
          <div className="guest-hero-actions">
            <a className="button guest-primary" href="#categories">Explore seafood <ArrowUpRight size={18} /></a>
            <button className="guest-secondary" onClick={() => setShowBiddingGuide(true)}>How bidding works</button>
          </div>
          <div className="guest-trust"><span><i /> Fresh catches, listed daily</span><span><i /> Fair trade, coast to coast</span></div>
        </div>
        <div className="guest-hero-art">
          <img className="guest-hero-image" src="/images/seafood-hero.svg" alt="Illustration of a fresh fish above ocean waves" />
          <div className="guest-market-status"><span className="guest-live-dot" /> LIVE MARKET <b>{loading ? '…' : `${items.length} ${items.length === 1 ? 'catch' : 'catches'}`}</b></div>
          <div className="guest-art-caption"><strong>Today's catch,<br />straight from the coast.</strong><span>Local fishermen · fair prices</span></div>
        </div>
      </section>}
      <section className="market buyer-market" id="market">
        {listingError && <p className="notice market-listing-error" role="status">Could not refresh marketplace listings: {listingError}. Showing the latest available listings.</p>}
        <section className="market-pulse-section" aria-label="Live market pulse">
          <MarketTrendChart
            data={trendData}
            loading={trendLoading}
            error={trendError}
            days={trendDays}
            onDaysChange={setTrendDays}
            fishType={trendFishType}
            onFishTypeChange={setTrendFishType}
            items={items}
            now={now}
          />
        </section>
        <section className="market-price-highlights" aria-label="Today's seafood price highlights">
          <div className="market-section-title"><div><p className="kicker">TODAY'S MARKET</p><h2>Seafood price highlights</h2></div><span>Prices shown per kg</span></div>
          <div className="market-price-grid">
            {loading ? <p className="empty">Loading today's prices…</p> : priceHighlights.length ? priceHighlights.map((item, index) => <article className="market-price-card" key={item.id}>
              <span className={`market-price-index market-price-index-${index + 1}`}>{index === 0 ? 'BEST PRICE' : item.saleMode === 'bid' ? 'LIVE BID' : 'FRESH CATCH'}</span>
              <div><strong>{item.fishType}</strong><span>{item.location || 'Coastal catch'}</span></div>
              <b>₹{itemPrice(item).toLocaleString()}<small>/kg</small></b>
            </article>) : <p className="empty">New catch prices will appear here as fishermen list seafood.</p>}
          </div>
        </section>
        <section className="seafood-categories" id="categories" aria-label="Seafood categories">
          <div className="market-section-title"><div><p className="kicker">PICK YOUR CATCH</p><h2>Shop by category</h2></div><button className={`category-all-button${selectedCategory === 'All' ? ' selected' : ''}`} onClick={() => setSelectedCategory('All')}>All seafood</button></div>
          <div className="seafood-category-grid">
            {categories.map(category => {
              const categoryListings = items.filter(category.matches);
              const categoryPhoto = categoryListings.find(item => item.imageUrl)?.imageUrl || category.image;
              const count = categoryListings.length;
              return <button key={category.name} className={`seafood-category-card${selectedCategory === category.name ? ' selected' : ''}`} aria-pressed={selectedCategory === category.name} onClick={() => { setSelectedCategory(selectedCategory === category.name ? 'All' : category.name); window.requestAnimationFrame(() => document.querySelector('#fresh-catch-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>
                <img src={categoryPhoto} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = category.image; }} />
                <span className="seafood-category-shade" aria-hidden="true" />
                <span className="seafood-category-topline"><span>FRESH FROM THE COAST</span><ArrowUpRight size={16} aria-hidden="true" /></span>
                <span className="seafood-category-copy"><strong>{category.name}</strong><small>{count} {count === 1 ? 'catch' : 'catches'} available</small></span>
              </button>;
            })}
          </div>
        </section>
        {buyerView && <section className="recommendation-panel" aria-label="Personalized seafood recommendations">
          <div className="recommendation-heading">
            <div><p className="kicker">PICKS FOR YOU</p><h2>Personalized Recommendations</h2><p>Preference-based suggestions use your seafood category, budget, and previous bids and orders.</p></div>
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <div className="recommendation-controls">
            <label><span>Seafood preference</span><select value={recommendationCategory} onChange={event => setRecommendationCategory(event.target.value)}><option>All</option>{categories.map(category => <option key={category.name}>{category.name}</option>)}</select></label>
            <label><span>Maximum price per kg</span><input type="number" min="0" step="10" placeholder="Any budget" value={recommendationBudget} onChange={event => setRecommendationBudget(event.target.value)} /></label>
            <label><span>Location</span><select value={recommendationLocation} onChange={event => setRecommendationLocation(event.target.value)}><option value="">All locations</option>{locationOptions.map(location => <option key={location} value={location}>{location}</option>)}</select></label>
            <label><span>Seller-reported quality</span><select value={recommendationQuality} onChange={event => setRecommendationQuality(event.target.value)}><option value="">All grades</option>{[...new Set(items.map(item => item.quality).filter(Boolean))].map(quality => <option key={quality} value={quality}>{quality}</option>)}</select></label>
            <label><span>Sale type</span><select value={recommendationSaleMode} onChange={event => setRecommendationSaleMode(event.target.value)}><option value="all">Auction &amp; fixed price</option><option value="auction">Auction</option><option value="fixed">Fixed price</option></select></label>
            <label className="recommendation-wishlist-filter"><input type="checkbox" checked={recommendationWishlistOnly} onChange={event => setRecommendationWishlistOnly(event.target.checked)} /><Heart size={15} /> Wishlist only <span>{wishlist.length}</span></label>
          </div>
          {buyerHistoryError && <p className="notice recommendation-message" role="alert">Could not load your purchase and bidding history: {buyerHistoryError}</p>}
          {buyerHistoryLoading && <p className="empty recommendation-message">Finding catches that fit your preferences…</p>}
          {!buyerHistoryLoading && !buyerHistoryError && recommendedItems.length > 0 && <div className="recommendation-grid">
            {recommendedItems.map(({ item, historyMatches }) => <article className="recommendation-card" key={item.id}>
              <p>{historyMatches ? `Similar to seafood in your history (${historyMatches} ${historyMatches === 1 ? 'activity' : 'activities'})` : 'Matches your seafood preference and budget'}</p>
              <FishCard item={item} onSelect={listing => { setSelected(listing); setMessage(''); setBidAmount(''); }} onBid={beginBid} isWishlisted={wishlist.includes(item.id)} onToggleWishlist={toggleWishlist} now={now} />
            </article>)}
          </div>}
          {!buyerHistoryLoading && !buyerHistoryError && recommendedItems.length === 0 && <p className="empty recommendation-message">No available catches match these preferences. Try another category or a higher budget.</p>}
          <p className="recommendation-note">These are preference-based suggestions, not food-safety or freshness assessments.</p>
        </section>}
        {message && <p className={messageType === 'error' ? 'notice' : 'success-notice'}>{message}</p>}
        <section className="market-listing-section" aria-labelledby="fresh-catch-title">
          <div className="market-section-title"><div><p className="kicker">JUST LANDED</p><h2 id="fresh-catch-title">Today's Fresh Catch</h2></div><span>{freshCatchItems.length} available</span></div>
          <p className="market-section-description">Available fixed-price catches and completed auction listings from local fishermen.</p>
          <div className="fish-grid">
            {loading ? <p className="empty">Scanning the morning catch...</p> : freshCatchItems.map(item => <FishCard key={item.id} item={item} onSelect={listing => { setSelected(listing); setMessage(''); setBidAmount(''); }} onBid={beginBid} isWishlisted={wishlist.includes(item.id)} onToggleWishlist={toggleWishlist} now={now} />)}
            {!loading && !freshCatchItems.length && <p className="empty buyer-no-results">No fresh catches are available in this category right now.</p>}
          </div>
        </section>
        <section className="market-listing-section" aria-labelledby="live-auctions-title">
          <div className="market-section-title"><div><p className="kicker">BID BEFORE THEY'RE GONE</p><h2 id="live-auctions-title">Live Auctions</h2></div><span>{liveAuctionItems.length} live</span></div>
          <p className="market-section-description">Follow current bids and place an offer before each auction closes.</p>
          <div className="fish-grid">
            {liveAuctionItems.map(item => <FishCard key={item.id} item={item} onSelect={listing => { setSelected(listing); setMessage(''); setBidAmount(''); }} onBid={beginBid} isWishlisted={wishlist.includes(item.id)} onToggleWishlist={toggleWishlist} now={now} />)}
            {!liveAuctionItems.length && <p className="empty buyer-no-results">No live auctions are available in this category right now.</p>}
          </div>
        </section>
        <p className="market-quality-disclaimer"><strong>Quality &amp; food safety:</strong> Grades are provided by sellers. AI image checks identify seafood species only; images and listing grades are not freshness estimates and do not replace proper food-safety inspection.</p>
        <section className="nearby-fishermen-section" aria-label="Nearby fishermen">
          <div className="market-section-title"><div><p className="kicker">LOCAL SELLERS</p><h2>Nearby Fishermen</h2></div><span>{nearbyFishermen.length} fishermen</span></div>
          <p className="market-section-description">Find fishermen with active catches at the landing locations listed in this marketplace.</p>
          {nearbyFishermen.length ? <div className="nearby-fishermen-grid">{nearbyFishermen.map(fisherman => <article className="nearby-fisherman-card" key={fisherman.id}>
            <span className="nearby-fisherman-avatar"><Waves size={19} /></span>
            <div><strong>{fisherman.name}</strong><span><MapPin size={13} /> {fisherman.locations.size ? [...fisherman.locations].join(', ') : 'Coastal location'}</span></div>
            <small>{fisherman.listingCount} {fisherman.listingCount === 1 ? 'catch' : 'catches'}</small>
          </article>)}</div> : <p className="empty">Fishermen will appear here when they publish available catches.</p>}
        </section>
      </section>
    </>}
    {buyerView && currentView === 'history' && <main className="buyer-view" id="history">
      <div className="buyer-page-heading"><div><p className="kicker">YOUR ACTIVITY</p><h2>Bids &amp; orders</h2><p>Review your auction activity and purchase status.</p></div><History size={23} /></div>
      <BuyerHistory key={transactionRefresh} />
    </main>}
    {buyerView && currentView === 'transactions' && <main className="buyer-view" id="transactions">
      <div className="buyer-page-heading"><div><p className="kicker">PAYMENT ACTIVITY</p><h2>Transactions</h2><p>View payment attempts and verified payment status.</p></div><CircleDollarSign size={23} /></div>
      <TransactionHistory key={transactionRefresh} title="Payment transactions" />
    </main>}
    {showBiddingGuide && <div className="modal-backdrop bidding-guide-backdrop" onClick={() => setShowBiddingGuide(false)}>
      <section className="modal bidding-guide-modal" role="dialog" aria-modal="true" aria-labelledby="market-bidding-title" onClick={event => event.stopPropagation()}>
        <button className="close" aria-label="Close bidding guide" onClick={() => setShowBiddingGuide(false)}>×</button>
        <div className="bidding-guide-heading">
          <p className="kicker">SIMPLE, FAIR, TRANSPARENT</p>
          <h2 id="market-bidding-title">How Bidding Works</h2>
          <p>Found a catch you love? Here’s how to go from your first bid to fresh fish.</p>
        </div>
        <div className="bidding-steps">
          <article className="bidding-step"><span className="bidding-step-number">01</span><span className="bidding-step-icon"><Search size={19} /></span><h3>Choose a live catch</h3><p>Open a listing marked <strong>Live auction</strong> to see its starting and current price.</p></article>
          <article className="bidding-step"><span className="bidding-step-number">02</span><span className="bidding-step-icon"><Gavel size={19} /></span><h3>Place your bid</h3><p>Enter a price per kilogram higher than the current bid. You can bid again as the auction moves.</p></article>
          <article className="bidding-step"><span className="bidding-step-number">03</span><span className="bidding-step-icon"><ShoppingBag size={19} /></span><h3>Win, then check out</h3><p>When the fisherman closes bidding, the winning buyer can complete checkout and track the order.</p></article>
        </div>
      </section>
    </div>}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <button className="close" onClick={() => setSelected(null)}>×</button>
        <img className="detail-photo" src={listingImage(selected)} alt={`${selected.fishType} catch`} />
        <p className="kicker">{selected.saleMode === 'bid' ? bidClosed ? 'BID CLOSED' : 'LIVE BIDDING' : 'DIRECT SALE'}</p>
        <h2>{selected.fishType}, {String(selected.quality || 'ungraded').toLowerCase()} seller grade</h2>
        <p>{selected.quantity} kg from {selected.location}. {selected.description || 'Fresh catch details supplied by the fisherman.'}</p>
        <p className="quality-safety-note">The quality grade is seller-provided. Any AI image result identifies species only and does not estimate freshness or replace food-safety inspection.</p>
        {selected.saleMode === 'bid' && <div className="price-readout">
          <span>Initial price</span><strong>₹{selected.auction?.startPrice || selected.expectedPrice}/kg</strong>
          <span>Current price</span><strong>₹{selected.auction?.currentPrice || selected.expectedPrice}/kg <small>+{selected.auction?.priceIncreasePercent || 0}%</small></strong>
        </div>}
        {selected.saleMode === 'bid' && !bidClosed
          ? <div className="bid-box"><input type="number" min={(selected.auction?.currentPrice || selected.expectedPrice) + 1} placeholder="Increase price / kg" value={bidAmount} onChange={event => setBidAmount(event.target.value)} /><button className="button primary" onClick={placeBid}><Gavel size={17} /> Bid</button></div>
          : selected.saleMode === 'sale' && selected.status === 'available'
            ? <button className="button primary full" onClick={() => user ? setCheckout({ type: 'buyout' }) : onAuth('login')}><ShoppingBag size={17} /> Buy now · ₹{selected.salePrice || selected.expectedPrice}/kg</button>
            : bidClosed
              ? <button className="button primary full" onClick={() => user ? setCheckout({ type: 'auction' }) : onAuth('login')}>Checkout winning bid</button>
              : <p className="form-hint">Bidding has stopped. The winning buyer can complete checkout.</p>}
        {selected.imageVerification === 'verified' && <p className="verification">Image verification marked complete · not a freshness or food-safety check</p>}
        {message && <p className="form-error">{message}</p>}
      </div>
    </div>}
    {checkout && <CheckoutForm type={checkout.type} onClose={() => setCheckout(null)} onSubmit={startPayment} />}
  </div>;
}

function CheckoutForm({ type, onClose, onSubmit }) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async event => {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ address });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" onClick={event => event.stopPropagation()}>
      <button className="close" onClick={onClose}>×</button>
      <p className="kicker">{type === 'buyout' ? 'BUYOUT ORDER' : 'AUCTION CHECKOUT'}</p>
      <h2>Pay securely with Razorpay.</h2>
      <form onSubmit={submit}>
        <textarea name="address" placeholder="Delivery or pickup address" value={address} onChange={event => setAddress(event.target.value)} rows="3" required />
        {error && <p className="form-error">{error}</p>}
        <button className="button primary full" type="submit" disabled={loading}>{loading ? 'Preparing secure checkout…' : 'Continue to payment'}</button>
      </form>
    </div>
  </div>;
}
