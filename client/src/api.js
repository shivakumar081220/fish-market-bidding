const API = '/api';

export async function request(path, options = {}) {
  const token = localStorage.getItem('tide_token');
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  detectFish: file => { const form = new FormData(); form.append('image', file); return request('/fish-detection', { method: 'POST', body: form }); },
  listings: (params = '') => request(`/listings${params}`),
  listing: id => request(`/listings/${id}`),
  login: body => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: body => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  orders: () => request('/orders'),
  recommendations: () => request('/recommendations'),
  bid: (id, amount) => request(`/auctions/${id}/bids`, { method: 'POST', body: JSON.stringify({ amount }) }),
  buyout: (id, body) => request(`/listings/${id}/buyout`, { method: 'POST', body: JSON.stringify(body) }),
  checkout: (id, body) => request(`/auctions/${id}/checkout`, { method: 'POST', body: JSON.stringify(body) }),
  adminOverview: () => request('/admin/overview'),
  adminUsers: () => request('/admin/users'),
  adminFisherman: id => request(`/admin/fishermen/${id}`),
  registrationRequests: () => request('/admin/registration-requests'),
  acceptRegistration: id => request(`/admin/registration-requests/${id}/accept`, { method: 'PATCH' }),
  rejectRegistration: id => request(`/admin/registration-requests/${id}/reject`, { method: 'PATCH' }),
  createFisherman: body => request('/admin/fishermen', { method: 'POST', body: JSON.stringify(body) }),
  fishermanListings: () => request('/fisherman/listings'),
  fishermanSales: () => request('/fisherman/sales'),
  deleteListing: id => request(`/listings/${id}`, { method: 'DELETE' }),
  meta: () => request('/meta'),
  createListing: body => request('/listings', { method: 'POST', body: JSON.stringify(body) }),
  createAuction: (id, body) => request(`/listings/${id}/auction`, { method: 'POST', body: JSON.stringify(body) }),
  closeAuction: id => request(`/auctions/${id}/close`, { method: 'PATCH' })
};
