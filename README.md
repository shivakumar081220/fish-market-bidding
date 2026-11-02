# TideMarket Smart Fishing Platform

This is a React and Express smart fishing marketplace with Firebase Realtime Database, separated user/admin code, auctions, bidding, orders, and role-based access.

## MERN quick start

1. If a root `.env` does not exist, copy `.env.example` to `.env`. If it already exists, keep its existing Firebase settings and add only the missing variables.
2. In Firebase Console, open **Project settings → Service accounts** and generate a private key. Add it to the root `.env` as `FIREBASE_SERVICE_ACCOUNT_JSON`, or set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` separately.
3. For test payments, create Razorpay **Test Mode** API keys in the Razorpay Dashboard and set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env`. The server accepts only `rzp_test_` keys in this implementation. Never expose the API secret in client code. Without the API keys, checkout reports that the gateway is not configured and does not mark orders paid.
4. Run `npm install` in the root, then `npm run install:all`.
5. Start both applications with `npm run dev`.
6. Open `http://localhost:5173`.

The React user surface is in `client/src/user/` and the admin surface is in `client/src/admin/`. API modules live under `server/src/routes/`. The administrator account is seeded when the API starts:

- `tide@gmail.com` / `Tide@123`

To open the admin dashboard locally, start the project with `npm run dev`, go to `http://localhost:5173`, choose **Log in**, and enter the admin credentials above. Logging in with an admin account opens the command center for fisherman management, buyer registration requests, marketplace metrics, and transactions. Change the default development password before using this account outside a local demo.

### Save logins with a browser password manager

The login and account-creation forms use standard username/password autocomplete fields so Chrome/Google Password Manager can offer to save or autofill each account after you sign in. Accept Chrome's **Save password?** prompt and choose the Google account/profile where you want it stored. If the prompt is not shown, use the key icon in Chrome's address bar or check Chrome → **Settings → Password Manager**. TideMarket stores account passwords as bcrypt hashes; it does not send plaintext passwords to Google. Admin, buyer, and fisherman logins use the same compatible login form.

The API stores users, listings, auctions, bids, orders, and payment attempts in Firebase Realtime Database under the `users`, `listings`, `auctions`, `bids`, `orders`, and `payments` nodes. The API currently uses a transparent rule-based price estimate in `server/src/utils.js`.

### Explore the complete marketplace with demo data

For a local walkthrough, run `npm run seed:demo` from the project root, then open `http://localhost:5173`. The command is repeatable and adds labeled practice records without overwriting existing records. It creates four fisherman accounts, three buyer accounts, 15 seafood species, a mix of fixed-price and auction listings, bid history, and pending practice checkouts with practice-only transaction entries. Demo checkouts are not real payments and are never marked as verified/paid. The seed command refuses to write when Firebase credentials are configured unless you explicitly run `npm run seed:demo --prefix server -- --allow-firebase`.

All demo accounts use the password `TideDemo!2026`:

| Role | Email |
|---|---|
| Fisherman | `asha.fisherman@tidemarket.demo` |
| Fisherman | `ravi.fisherman@tidemarket.demo` |
| Fisherman | `meera.fisherman@tidemarket.demo` |
| Fisherman | `arun.fisherman@tidemarket.demo` |
| Buyer | `kiran.buyer@tidemarket.demo` |
| Buyer | `nisha.buyer@tidemarket.demo` |
| Buyer | `dev.buyer@tidemarket.demo` |

### Walkthrough

1. Sign in as a fisherman and review Inventory, Buyer orders, and Transactions. A fisherman can publish a fixed-price catch or an auction listing.
2. Sign in as a buyer and filter the marketplace by seafood, location, quantity, or sale type. Fixed-price catches use Buy now; open auctions show the current highest bid and let buyers place bids above the minimum increment.
3. Use Bids & Orders and Transactions in the buyer dashboard to review private bid, checkout, and payment-attempt history. Practice entries are visibly labeled and have not charged a payment method.
4. The public Market Pulse bar chart aggregates actual listing-price observations and bids by day and species. It refreshes when a new bid is placed; the chart does not represent completed-sale prices.
5. To test a real payment flow, configure Razorpay Test Mode as described below, then check out an eligible order with Razorpay's test payment details. Without test credentials, payment stays unavailable rather than being falsely recorded as paid.

### Auction settlement and bid review

The API checks auctions on startup and every 15 seconds. When an auction reaches its end time, it closes automatically, records the highest bidder as the winner, and creates a pending checkout order. A fisherman can also stop bidding early from Inventory; the same winner settlement runs immediately. Fishermen can review auction history in **Bid history**, and administrators can review all auctions under **Bid review**.

New bids are flagged for human review when one buyer places at least five bids in 60 seconds, or when a bid is at least twice the previous high and exceeds it by at least five minimum increments. These are review signals, not proof of fraud; bids are not blocked automatically. The bid review screens show the full bid timeline and flagged activity.

### Upload a real catch photo

When signed in as a fisherman, choose **Post a catch**, select fixed price or bidding, then choose **Identify species & upload photo**. The app attempts to identify the catch, selects the model's best species match, and uploads the photo for the listing. Confirm or change the species before publishing. Photo upload still works when the classifier is unavailable, so you can select the species manually. Accepted formats are JPG, PNG, and WEBP, up to 5 MB; uploaded listing photos are served from `server/uploads/`.

Buyers and guests can use **Search by photo** beside the marketplace search field. On mobile devices this opens the camera when supported; desktop browsers can select an image. A successful prediction filters listings to the suggested species and shows alternative model matches.

Photo identification requires the actual `server/models/fish_classifier.keras` weights and Python with TensorFlow and NumPy installed. This checkout may contain only a Git LFS pointer instead of the model weights; in that case, retrieve the model asset (or train it with `python train.py`) and install the classifier dependencies. The detector will report that setup is missing instead of pretending it identified the fish. Its model recognizes the 31 classes in `server/models/fish_labels.json`; visual predictions are suggestions and fishermen should confirm the species.

### Razorpay checkout and transaction history

The checkout uses Razorpay Checkout and must be configured with Razorpay API keys. The server creates INR payment orders, verifies the checkout signature, confirms/captures the payment with Razorpay, and only then marks an order paid. Payment attempts are recorded in the `payments` node; buyers, fishermen, and admins have role-scoped transaction-history views. Configure the Razorpay webhook at `/api/payments/razorpay/webhook` with the `RAZORPAY_WEBHOOK_SECRET` from the Razorpay Dashboard, subscribing to `payment.captured`, `order.paid`, and `payment.failed`, so payment updates are still recorded if a buyer closes the browser before returning from checkout. Test keys do not charge real money. Use Razorpay's test payment details while testing. This implementation accepts test keys only.

Orders marked paid by the old demo checkout are not treated as verified Razorpay transactions and are excluded from verified paid-volume totals.

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
