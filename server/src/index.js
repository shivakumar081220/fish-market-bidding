import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import { initFirebase, insert, list } from './db.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const app = express();
app.use('/uploads', express.static(path.resolve(dirname(fileURLToPath(import.meta.url)), '../uploads')));
app.use(helmet()); app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' })); app.use(express.json({ limit: '2mb' })); app.use(morgan('dev'));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'smart-fishing-api' }));
app.use('/api', userRoutes); app.use('/api/admin', adminRoutes);
app.use((error, req, res, next) => { console.error('Unhandled API error:', error); res.status(500).json({ message: 'Unexpected server error', detail: error.message }); });
async function seed() { const users = await list('users'); const admin = users.find(user => user.email === 'tide@gmail.com'); const adminData = { name: 'Tide Admin', email: 'tide@gmail.com', passwordHash: await bcrypt.hash('Tide@123', 12), role: 'admin' }; if (admin) await (await import('./db.js')).update('users', admin.id, adminData); else await insert('users', adminData); }
const port = process.env.PORT || 5000;
console.log('Firebase Realtime Database: connecting...');
try { initFirebase(); await seed(); console.log('Firebase Realtime Database: connected'); app.listen(port, () => console.log(`API listening on http://localhost:${port}`)); } catch (error) { console.error('Firebase Realtime Database: failed:', error.message); process.exit(1); }
