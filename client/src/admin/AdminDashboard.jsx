import { useEffect, useState } from 'react';
import { Activity, Anchor, ArrowLeft, ArrowRight, ClipboardList, CircleDollarSign, Fish, Gavel, RefreshCw, Search, Store, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../api.js';
import BidMonitoring from '../BidMonitoring.jsx';
import TransactionHistory from '../TransactionHistory.jsx';

export default function AdminDashboard() {
  const [view, setView] = useState('fishermen');
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [removingListing, setRemovingListing] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = () => Promise.all([api.adminOverview(), api.adminUsers(), api.registrationRequests(), api.adminListings()])
    .then(([overview, people, pending, marketplaceListings]) => { setData(overview); setUsers(people); setRequests(pending); setListings(marketplaceListings); })
    .catch(err => setError(err.message));
  useEffect(() => { load(); }, []);
  const fishermen = users.filter(person => person.role === 'fisherman');
  const filteredFishermen = fishermen.filter(person => `${person.name} ${person.email} ${person.location || ''}`.toLowerCase().includes(search.toLowerCase()));
  const review = async (id, action) => { try { const result = action === 'accept' ? await api.acceptRegistration(id) : await api.rejectRegistration(id); setMessage(result.message || `Request ${action}ed.`); load(); } catch (err) { setError(err.message); } };
  const openFisherman = async person => { setError(''); try { setSelected(await api.adminFisherman(person.id)); } catch (err) { setError(err.message); } };
  const refreshDashboard = async () => { setRefreshing(true); setError(''); try { await load(); } finally { setRefreshing(false); } };
  const removeListing = async listing => {
    if (!window.confirm(`Remove ${listing.fishType || 'this species'} from the marketplace? Existing order and payment history will be preserved.`)) return;
    setError('');
    setMessage('');
    setRemovingListing(listing.id);
    try {
      const result = await api.removeAdminListing(listing.id);
      setMessage(result.message || 'Listing removed from the marketplace.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingListing('');
    }
  };
  const counts = data?.counts || {};
  const activeListingCount = listings.filter(listing => listing.status !== 'removed').length;
  const filteredListings = listings.filter(listing => `${listing.fishType || ''} ${listing.fisherman?.name || ''} ${listing.location || ''} ${listing.status || ''}`.toLowerCase().includes(listingSearch.toLowerCase()));

  if (selected) return <FishermanDetail data={selected} onBack={() => setSelected(null)} />;
  return <main className="dashboard admin-view">
    <section className="admin-hero">
      <div className="admin-hero-copy">
        <p className="kicker"><Store size={14} /> TIDEMARK · ADMIN WORKSPACE</p>
        <h1>Welcome, Admin.</h1>
        <p>Your marketplace, at a glance.</p>
        <div className="admin-hero-actions">
          <button className="button primary" onClick={() => setShowForm(true)}><UserPlus size={16} /> Create fisherman account</button>
          <button className="admin-refresh" onClick={refreshDashboard} disabled={refreshing} aria-label="Refresh dashboard">
            <RefreshCw size={15} className={refreshing ? 'admin-spinning' : ''} /> {refreshing ? 'Refreshing' : 'Refresh data'}
          </button>
        </div>
      </div>
      <div className="admin-hero-art" aria-hidden="true">
        <svg viewBox="0 0 520 300" role="presentation">
          <defs>
            <linearGradient id="admin-sunrise" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#ffe9ad" />
              <stop offset="1" stopColor="#f4a976" />
            </linearGradient>
            <linearGradient id="admin-sea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#55c3ad" stopOpacity=".78" />
              <stop offset="1" stopColor="#0d3947" stopOpacity=".28" />
            </linearGradient>
          </defs>
          <circle className="admin-art-sun" cx="365" cy="91" r="44" fill="url(#admin-sunrise)" />
          <circle cx="365" cy="91" r="62" fill="none" stroke="#ffe8b5" strokeOpacity=".2" />
          <path className="admin-art-skyline" d="M66 158 137 108l48 32 73-64 75 55 42-31 94 58" fill="none" stroke="#c3ece1" strokeOpacity=".28" strokeWidth="2" />
          <path d="M0 181c57-23 96-20 151 0s98 19 157-1 116-20 212 5v115H0z" fill="url(#admin-sea)" />
          <path className="admin-art-wave admin-art-wave-back" d="M0 212c52-20 91-20 143 0s92 20 145 0 103-21 153-2 57 19 79 15" fill="none" stroke="#a9e7d5" strokeOpacity=".67" strokeWidth="3" />
          <path className="admin-art-wave" d="M-12 241c52-20 91-20 143 0s92 20 145 0 103-21 153-2 57 19 91 12" fill="none" stroke="#c7eee2" strokeOpacity=".48" strokeWidth="2" />
          <path d="m174 177 184 0-30 37H205z" fill="#f3a56f" />
          <path d="M196 177h144l-14 18H211z" fill="#fff1d2" />
          <path d="M241 174v-52l55 52z" fill="#f5dba4" />
          <path d="m247 167 41 0-41-38z" fill="#75bca8" />
          <path d="M294 175v-39l37 39z" fill="#d8eee0" />
          <path d="M211 215h109" stroke="#ffe0ab" strokeOpacity=".7" strokeWidth="2" />
          <path className="admin-art-fish" d="M90 251c14-13 34-13 48 0-14 13-34 13-48 0Zm48 0 13-10v20z" fill="#b9e8d8" />
          <path className="admin-art-fish admin-art-fish-small" d="M371 258c10-9 25-9 35 0-10 9-25 9-35 0Zm35 0 10-8v16z" fill="#d6f1e4" />
          <path d="M385 143q8-11 16 0m18 0q8-11 16 0" fill="none" stroke="#f3dbab" strokeLinecap="round" strokeWidth="2" />
          <circle cx="100" cy="182" r="3" fill="#ffe5aa" />
          <circle cx="121" cy="190" r="2" fill="#ffe5aa" />
          <circle cx="423" cy="185" r="2.5" fill="#ffe5aa" />
        </svg>
      </div>
    </section>
    {message && <p className="success-notice">{message}</p>}{error && <p className="notice">{error}</p>}
    <div className="admin-section-heading"><div><p className="kicker">LIVE MARKET PULSE</p><h2>Stronger communities start at the water’s edge.</h2></div><span><span className="pulse" /> Live overview</span></div>
    <div className="metrics admin-metrics"><Metric icon={<Users />} label="Registered users" value={counts.users ?? '—'} detail="Growing community" /><Metric icon={<Anchor />} label="Active listings" value={counts.listings ?? '—'} detail="Fresh catch on market" /><Metric icon={<Activity />} label="Total bids" value={counts.bids ?? '—'} detail="Buyer activity" /><Metric icon={<CircleDollarSign />} label="Paid volume" value={data ? `₹${(data.paidTotal || 0).toLocaleString()}` : '—'} detail="Verified payments" /></div>
    <div className="admin-navigation-heading"><div><p className="kicker">WORKSPACE</p><h2>Manage your marketplace</h2></div><span>Choose a section to get started</span></div>
    <div className="admin-tabs" role="tablist" aria-label="Admin dashboard sections">
      <button role="tab" aria-selected={view === 'fishermen'} className={view === 'fishermen' ? 'active' : ''} onClick={() => setView('fishermen')}><Fish size={18} /> Fishermen <b>{fishermen.length}</b></button>
      <button role="tab" aria-selected={view === 'listings'} className={view === 'listings' ? 'active' : ''} onClick={() => setView('listings')}><Store size={18} /> Marketplace listings <b>{activeListingCount}</b></button>
      <button role="tab" aria-selected={view === 'requests'} className={view === 'requests' ? 'active' : ''} onClick={() => setView('requests')}><ClipboardList size={18} /> Buyer requests <b>{requests.length}</b></button>
      <button role="tab" aria-selected={view === 'bids'} className={view === 'bids' ? 'active' : ''} onClick={() => setView('bids')}><Gavel size={18} /> Bid review</button>
      <button role="tab" aria-selected={view === 'transactions'} className={view === 'transactions' ? 'active' : ''} onClick={() => setView('transactions')}><CircleDollarSign size={18} /> Transactions</button>
    </div>
    {view === 'fishermen' ? <section className="panel admin-page admin-fishermen-page">
      <div className="panel-title"><div><p className="kicker">YOUR COASTAL NETWORK</p><h2>Fishermen</h2></div><span>{fishermen.length} accounts · Select a profile to inspect sales</span></div>
      <label className="admin-search"><Search size={17} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email or port" aria-label="Search fishermen" /></label>
      {!!filteredFishermen.length && <div className="admin-fishermen-grid">{filteredFishermen.map(person => <button className="person-line person-button" key={person.id} onClick={() => openFisherman(person)}><div className="avatar">{person.name[0]}</div><div><strong>{person.name}</strong><small>{person.email} · {person.location || 'Location not set'}</small></div><span className="role">View details <ArrowRight size={14} /></span></button>)}</div>}
      {!fishermen.length && <p className="empty">No fishermen created yet. Add your first coastal partner to get started.</p>}
      {!!fishermen.length && !filteredFishermen.length && <p className="empty">No fishermen match “{search}”. Try another name, email, or port.</p>}
    </section> : view === 'listings' ? <section className="panel admin-page">
      <div className="panel-title"><div><p className="kicker">MARKETPLACE MODERATION</p><h2>Species listings</h2></div><span>{activeListingCount} in marketplace · {listings.length} total</span></div>
      <p className="admin-listing-note">Removing a listing hides it from buyers and cancels its auction. Order and payment history are retained.</p>
      <label className="admin-search"><Search size={17} /><input type="search" value={listingSearch} onChange={event => setListingSearch(event.target.value)} placeholder="Search species, fisherman or port" aria-label="Search marketplace listings" /></label>
      <div className="admin-market-listings">
        {filteredListings.map(listing => <article className={`admin-market-listing${listing.status === 'removed' ? ' is-removed' : ''}`} key={listing.id}>
          {listing.imageUrl ? <img src={listing.imageUrl} alt={listing.fishType || 'Seafood listing'} /> : <div className="admin-market-listing-placeholder"><Fish size={21} /></div>}
          <div className="admin-market-listing-info"><strong>{listing.fishType || 'Seafood listing'}</strong><span>{listing.quantity || 0} kg · {listing.quality || 'Unrated'} · {listing.location || 'Location unavailable'}</span><small>By {listing.fisherman?.name || 'Unknown fisherman'} · ₹{Number(listing.auction?.currentPrice || listing.salePrice || listing.expectedPrice || listing.auction?.startPrice || 0).toLocaleString()}/kg · {listing.saleMode === 'bid' ? `${listing.auction?.bidCount || 0} bids` : 'Fixed price'}</small></div>
          <span className={`admin-listing-status ${listing.status === 'removed' ? 'removed' : ''}`}>{listing.status === 'removed' ? 'Removed' : listing.status}</span>
          {listing.status !== 'removed' && <button className="admin-listing-remove" onClick={() => removeListing(listing)} disabled={removingListing === listing.id} aria-label={`Remove ${listing.fishType} from marketplace`} title="Remove from marketplace">{removingListing === listing.id ? 'Removing…' : <><Trash2 size={15} /> Remove</>}</button>}
        </article>)}
      </div>
      {!filteredListings.length && <p className="empty">{listings.length ? 'No listings match that search.' : 'No species listings have been uploaded yet.'}</p>}
    </section> : view === 'requests' ? <section className="panel admin-page">
      <div className="panel-title"><div><p className="kicker">COMMUNITY ONBOARDING</p><h2>Buyer registration requests</h2></div><span>{requests.length} pending review</span></div>
      {requests.map(request => <div className="request-line" key={request.id}><div><strong>{request.name}</strong><small>{request.email}{request.phone ? ` · ${request.phone}` : ''}</small></div><div className="request-actions"><button className="button small primary" onClick={() => review(request.id, 'accept')}>Accept</button><button className="button small secondary" onClick={() => review(request.id, 'reject')}>Reject</button></div></div>)}
      {!requests.length && <p className="empty">You’re all caught up. New buyer requests will appear here.</p>}
    </section> : view === 'bids' ? <BidMonitoring title="Marketplace bid history & review" /> : <TransactionHistory title="All payment transactions" />}
    {showForm && <FishermanForm onClose={() => setShowForm(false)} onCreated={name => { setShowForm(false); setMessage(`${name} can now sign in as a fisherman.`); load(); }} />}
  </main>;
}

function FishermanDetail({ data, onBack }) {
  const soldCatches = data.listings.filter(item => item.saleAmount > 0).length;
  return <main className="dashboard admin-view fisherman-detail-view">
    <button className="back-button fisherman-detail-back" onClick={onBack}><ArrowLeft size={16} /> Back to admin</button>
    <section className="fisherman-detail-hero">
      <span className="fisherman-detail-avatar"><Fish size={27} /></span>
      <div>
        <p className="kicker">FISHERMAN PROFILE</p>
        <h1>{data.fisherman.name}</h1>
        <p>{data.fisherman.email} · {data.fisherman.location || 'Location not set'}</p>
      </div>
      <span className="fisherman-detail-status"><i /> FISHERMAN ACCOUNT</span>
    </section>
    <div className="metrics admin-metrics fisherman-detail-metrics">
      <Metric icon={<Fish />} label="Fish posted" value={data.listings.length} detail="Total catch listings" />
      <Metric icon={<CircleDollarSign />} label="Total gained" value={`₹${Number(data.totalGained || 0).toLocaleString()}`} detail="Recorded earnings" />
      <Metric icon={<Activity />} label="Sold catches" value={soldCatches} detail="Completed sales" />
    </div>
    <section className="panel admin-page fisherman-detail-listings">
      <div className="panel-title"><div><p className="kicker">CATCH PERFORMANCE</p><h2>Fish sold and earnings</h2></div><span>Bid and sale history</span></div>
      {data.listings.map(item => <div className="sale-line" key={item.id}>
        {item.imageUrl ? <img src={item.imageUrl} alt={item.fishType} /> : <div className="catch-placeholder"><Fish size={22} /></div>}
        <div><strong>{item.fishType}</strong><small>{item.quantity} kg · {item.quality} · {item.location}</small><small>{item.bids} bids · highest bid ₹{item.highestBid.toLocaleString()}</small></div>
        <div className="sale-amount"><strong>₹{item.saleAmount.toLocaleString()}</strong><small>{item.saleStatus}</small></div>
      </div>)}
      {!data.listings.length && <p className="empty">This fisherman has not posted any fish.</p>}
    </section>
  </main>;
}
function Metric({ icon, label, value, detail }) { return <div className="metric"><span className="metric-icon">{icon}</span><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>; }
function FishermanForm({ onClose, onCreated }) { const [form, setForm] = useState({}); const [error, setError] = useState(''); const change = event => setForm({ ...form, [event.target.name]: event.target.value }); const submit = event => { event.preventDefault(); api.createFisherman(form).then(result => onCreated(result.name)).catch(err => setError(err.message)); }; return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}>×</button><p className="kicker">ADMIN ACCOUNT CONTROL</p><h2>Create fisherman login.</h2><form onSubmit={submit} autoComplete="on"><input name="name" placeholder="Fisherman name" autoComplete="name" onChange={change} required /><input name="email" type="email" placeholder="Login email" autoComplete="username" onChange={change} required /><input name="password" type="password" placeholder="Temporary password" autoComplete="new-password" onChange={change} required /><input name="location" placeholder="Port or location" onChange={change} /><input name="phone" placeholder="Phone number" autoComplete="tel" onChange={change} />{error && <p className="form-error">{error}</p>}<button className="button primary full" type="submit">Create fisherman account</button></form></div></div>; }
