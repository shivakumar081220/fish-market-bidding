# TideMarket Smart Fishing Platform

This is a React and Express smart fishing marketplace with Firebase Realtime Database, separated user/admin code, auctions, bidding, orders, and role-based access.

## MERN quick start

1. In Firebase Console, open **Project settings → Service accounts** and generate a private key.
2. Add the service account values to the root `.env` using `FIREBASE_SERVICE_ACCOUNT_JSON`, or set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` separately.
3. Run `npm install` in the root, then `npm run install:all`.
4. Start both applications with `npm run dev`.
5. Open `http://localhost:5173`.

The React user surface is in `client/src/user/` and the admin surface is in `client/src/admin/`. API modules live under `server/src/routes/`. Demo accounts are seeded on the first Firebase connection:

- `admin@example.com` / `admin123`
- `fisherman@example.com` / `fisher123`
- `buyer@example.com` / `buyer123`

The API stores users, listings, auctions, bids, and orders in Firebase Realtime Database under the `users`, `listings`, `auctions`, `bids`, and `orders` nodes. The API currently uses a transparent rule-based price estimate in `server/src/utils.js`. Payment remains a demo flow and should be replaced with a real gateway before production use.

## Fish image classifier

The 31-class model is trained from `dataset/FishImgDataset/` with EfficientNetB0 transfer learning:

```powershell
python train.py
```

Training writes the model, class labels, and test metrics to `server/models/`. To classify a new image:

```powershell
python predict.py --image path\to\fish.jpg
```

The completed training run achieved 93.58% accuracy on the supplied test split. `predict.py` prints the top prediction and two alternatives with confidence scores.
