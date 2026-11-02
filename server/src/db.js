import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let app;
const localDbPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/local-db.json');

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
  const localPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../firebase-service-account.json');
  if (fs.existsSync(localPath)) return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  throw new Error('Firebase Admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.');
}

function useLocalDatabase() {
  if (process.env.TIDEMARKET_DATABASE === 'local') return true;
  try {
    serviceAccount();
    return false;
  } catch {
    return true;
  }
}

function readLocalDb() {
  if (!fs.existsSync(localDbPath)) {
    fs.mkdirSync(path.dirname(localDbPath), { recursive: true });
    fs.writeFileSync(localDbPath, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
}

export function initFirebase() {
  if (useLocalDatabase()) return null;
  if (!app) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount()),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
  }
  return admin.database();
}

export function makeId(prefix) {
  if (useLocalDatabase()) return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${initFirebase().ref().push().key}`;
}

export async function get(collection, id) {
  if (useLocalDatabase()) {
    const store = readLocalDb();
    const record = store[collection]?.[id];
    return record ? { id, ...record } : null;
  }
  const snapshot = await initFirebase().ref(`${collection}/${id}`).get();
  return snapshot.exists() ? { id, ...snapshot.val() } : null;
}

export async function list(collection) {
  if (useLocalDatabase()) {
    const store = readLocalDb();
    const value = store[collection] || {};
    return Object.entries(value).map(([id, item]) => ({ id, ...item }));
  }
  const snapshot = await initFirebase().ref(collection).get();
  const value = snapshot.val() || {};
  return Object.entries(value).map(([id, item]) => ({ id, ...item }));
}

function removeUndefined(value) { if (Array.isArray(value)) return value.map(removeUndefined); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, removeUndefined(item)])); return value; }
function cleanRecord(data) { return JSON.parse(JSON.stringify(removeUndefined(data))); }

export async function insert(collection, data, id = null) {
  if (useLocalDatabase()) {
    const store = readLocalDb();
    const key = id || makeId(collection.replace(/s$/, ''));
    const record = cleanRecord({ ...data, createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    store[collection] ??= {};
    store[collection][key] = record;
    writeLocalDb(store);
    return { id: key, ...record };
  }
  const key = id || initFirebase().ref(collection).push().key;
  const record = cleanRecord({ ...data, createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  await initFirebase().ref(`${collection}/${key}`).set(record);
  return { id: key, ...record };
}

export async function update(collection, id, data) {
  if (useLocalDatabase()) {
    const store = readLocalDb();
    const existing = store[collection]?.[id];
    if (!existing) return null;
    const record = cleanRecord({ ...existing, ...data, updatedAt: new Date().toISOString() });
    store[collection][id] = record;
    writeLocalDb(store);
    return { id, ...record };
  }
  const record = cleanRecord({ ...data, updatedAt: new Date().toISOString() });
  await initFirebase().ref(`${collection}/${id}`).update(record);
  return get(collection, id);
}

export async function reserveListing(id, buyerId) {
  const updatedAt = new Date().toISOString();
  if (useLocalDatabase()) {
    const store = readLocalDb();
    const listing = store.listings?.[id];
    if (!listing || listing.status !== 'available') return false;
    store.listings[id] = { ...listing, status: 'reserved', reservedBy: buyerId, updatedAt };
    writeLocalDb(store);
    return true;
  }
  const result = await initFirebase().ref(`listings/${id}`).transaction(listing => {
    if (!listing || listing.status !== 'available') return;
    return { ...listing, status: 'reserved', reservedBy: buyerId, updatedAt };
  });
  return result.committed;
}

export async function remove(collection, id) {
  if (useLocalDatabase()) {
    const store = readLocalDb();
    if (store[collection]) delete store[collection][id];
    writeLocalDb(store);
    return;
  }
  await initFirebase().ref(`${collection}/${id}`).remove();
}

export async function clearCollections(collections) {
  if (useLocalDatabase()) {
    const store = readLocalDb();
    for (const collection of collections) delete store[collection];
    writeLocalDb(store);
    return;
  }
  await initFirebase().ref().update(Object.fromEntries(collections.map(collection => [collection, null])));
}

export function where(items, filters = {}) { return items.filter(item => Object.entries(filters).every(([key, value]) => item[key] === value)); }
export function sortNewest(items) { return [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); }
export function sortAmount(items) { return [...items].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)); }
export function sortEnd(items) { return [...items].sort((a, b) => new Date(a.endTime || 0) - new Date(b.endTime || 0)); }
export function sanitizeUser(user) { if (!user) return null; const { passwordHash, ...safe } = user; return safe; }
