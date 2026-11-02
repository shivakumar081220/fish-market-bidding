# TideMarket API

Express + Firebase Realtime Database API for the React client. Configure Firebase Admin credentials in the root `.env`, then use `npm run dev`.

To replace bids, orders, and payment records with demo activity in the local database, run:

```sh
node src/seed-demo.js --local --reset-activity
```

This recreates the demo buyer and fisherman accounts and replaces bids, orders, and payment records. Other users and existing fish listings are kept; demo marketplace listings and auctions are seeded as needed. All generated payments are practice-only and never charge a real payment gateway. The script prints the demo account emails and shared demo password.

To target Firebase instead, configure Firebase Admin credentials in the root `.env` and explicitly run `node src/seed-demo.js --allow-firebase --reset-activity`. This replaces bids, orders, and payments in that Firebase database and recreates the demo buyer and fisherman accounts; other users and listings are kept.
