# NodeBridge


## Project summary

NodeBridge is a small compute marketplace. A provider publishes a job, a requester locks the payment in on-chain escrow, and an admin submits the delivered result. A Rust verifier checks that result against the job's committed hash, and the backend releases the funds only when the check passes.

**Flow:** Publish a job → Fund escrow → Submit a result → Verify the hash → Release payment.

## Summary

The chain stores a `bytes32` spec hash, not the job text. The hash is keccak256 of a canonical string:

```
title
task
expected output
```

The plaintext spec lives in the backend. On verification the Rust program recomputes that spec hash and hashes the delivered result. Express releases escrow only when the spec hash matches the chain and the result hash matches the committed output. A mismatch is logged and the funds stay locked. Admin is the only party who triggers that check.

## What each role reviews

| Role | Look here | What is being tested |
|---|---|---|
| Solidity | `contracts/contracts/EscrowMarketplace.sol` and `contracts/test/EscrowMarketplace.test.js` | Escrow state, the spec-hash commitment, who may release or refund |
| Rust | `verifier/src/main.rs` | Canonical hashing and accept/reject of a result |
| Backend | `backend/src/routes/verifyDelivery.js`, `backend/src/verifier.js` | Calling the verifier, comparing it to the chain, then releasing |
| Frontend | `frontend/` | Publishing a spec, funding a job, and the admin check |

The Solidity names stay close to the original escrow: `seller` is the provider, `buyer` is the requester, and a listing is still a `Voucher`. The interface calls them provider, requester, and job.

---

## Contents

- [Summary](#summary)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Walkthrough](#trying-it-end-to-end)
- [Contract](#smart-contract-reference)
- [API](#backend-api-reference)
- [Testing](#testing)

---

## Architecture

```
                     1. publish job + specHash       2. fund job (send ETH)
   ┌──────────┐  ───────────────────▶  ┌───────────────────┐  ◀────────────────  ┌───────────┐
   │ Provider │                        │  EscrowMarketplace │                     │ Requester │
   │ (wallet) │                        │   smart contract    │                     │ (wallet)  │
   └──────────┘                        │  (funds held here)  │                     └───────────┘
                                        └─────────┬──────────┘
                                                   │ 5. releaseFunds(jobId)
                                                   │    (worker-key signed tx)
                                                   │
                     3. submit result   ┌──────────┴──────────┐
   ┌──────────┐  ───────────────────▶  │  Backend (Express)  │
   │  Admin   │                        │  compares hashes    │
   └──────────┘                        └──────────┬──────────┘
                                                   │ 4. stdin JSON
                                        ┌──────────┴──────────┐
                                        │  Rust verifier      │
                                        │  specHash + result  │
                                        └─────────────────────┘
```

1. A **provider** publishes a job. The contract stores the price and the keccak256 spec hash. The title, task, and expected output stay off-chain.
2. A **requester** funds it. The exact ETH amount is locked and the job moves to `AwaitingDelivery`.
3. **Admin** pastes the delivered result and asks the backend to verify it.
4. The **Rust verifier** recomputes the spec hash and the result hash. A mismatch stops here.
5. If both hashes match, the backend signs `releaseFunds`. Only the contract owner or an authorized worker can call that. The provider is paid, the job is marked `Delivered`, and the attempt is appended to `backend/data/db.json`.

## Tech stack

| Layer | Technology |
|---|---|
| Smart contract | Solidity 0.8.24, Hardhat, OpenZeppelin (`ReentrancyGuard`, `Ownable`) |
| Verifier | Rust, keccak256 (`tiny-keccak`) |
| Backend | Node.js, Express, Ethers.js v6, JSON file store |
| Frontend | Next.js 14 (App Router), React 18, wagmi v2, RainbowKit, viem |

## Repository layout

```
contracts/                     Hardhat project
  contracts/EscrowMarketplace.sol   Escrow plus the on-chain spec hash
  scripts/deploy.js                 Deploys the contract, writes deployments/<network>.json
  scripts/authorize-worker.js       Authorizes an additional backend worker address
  scripts/seed-demo.js              Publishes the two demo jobs
  test/EscrowMarketplace.test.js    Hardhat/Chai test suite

verifier/                      Rust result checker
  src/main.rs                       Canonical spec hash and result comparison

backend/                       Express API
  src/server.js                     App entrypoint
  src/contract.js                   Ethers.js contract/wallet wiring
  src/verifier.js                   Spawns the Rust binary
  src/db.js                         JSON file store for specs and the audit log
  src/routes/verifyDelivery.js      Jobs, verification, and delivery history
  data/demo-jobs.json               Two sample jobs (also used by the seed script)

frontend/                      Next.js app
  app/page.js                       Open jobs
  app/sell/page.js                  Publish a job
  app/admin/page.js                 Admin result check
  lib/spec.js                       Same canonical hash the Rust verifier uses
```

## Prerequisites

- **Node.js 18+** and npm
- **Rust** (cargo), to build the result verifier
- **MetaMask** (or any injected wallet) browser extension, for interacting with the frontend
- No real funds or testnet ETH needed — everything below runs on a local Hardhat blockchain

## Quick start

Three terminals, run in order:

```bash
# Terminal 1 — local blockchain
cd contracts
npm install
npm run node
```

```bash
# Terminal 2 — deploy the contract, build the verifier, then start the backend
cd contracts
BACKEND_WORKER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 npm run deploy:local

cd ..
cargo build --release --manifest-path verifier/Cargo.toml

cd backend
npm install
cp .env.example .env
# edit .env: set BACKEND_PRIVATE_KEY to Hardhat's Account #1 private key
# (printed by `npm run node` in Terminal 1 — see "Trying it end-to-end" below)
npm start
```

```bash
# Terminal 3 — frontend
cd frontend
npm install
cp .env.local.example .env.local
# edit .env.local: set NEXT_PUBLIC_CONTRACT_ADDRESS to the address printed in Terminal 2
npm run dev
```

Open **http://localhost:3000**, connect MetaMask (pointed at the local Hardhat network — see below), and use NodeBridge. Optionally seed two compute jobs from `contracts/`:

```bash
npx hardhat run scripts/seed-demo.js --network localhost
```

## Running each piece in detail

### 1. Smart contract

```bash
cd contracts
npm install
npm run node          # keep running — this is your local chain on :8545
```

In a second terminal:

```bash
cd contracts
npm run deploy:local
```

This deploys `EscrowMarketplace.sol` using Hardhat's Account #0 as the owner, and writes the deployed address + ABI to `contracts/deployments/localhost.json`. The backend reads this file automatically, so no manual ABI copying is needed.

From that same terminal, return to the repository root and build the verifier:

```bash
cd ..
cargo build --release --manifest-path verifier/Cargo.toml
```

By default, only the deployer (owner) can call `releaseFunds`. To authorize a separate backend wallet up front, deploy with:

```bash
BACKEND_WORKER_ADDRESS=0xYourBackendWalletAddress npm run deploy:local
```

Or authorize one after the fact:

```bash
WORKER_ADDRESS=0xYourBackendWalletAddress npx hardhat run scripts/authorize-worker.js --network localhost
```

Optionally publish the two demo jobs (image embedding and log reduce) so the marketplace is not empty:

```bash
npx hardhat run scripts/seed-demo.js --network localhost
```

### 2. Backend API

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

```
RPC_URL=http://127.0.0.1:8545
BACKEND_PRIVATE_KEY=<private key of an authorized worker address>
CONTRACT_ADDRESS=<address printed by the deploy script>
PORT=4000
```

Then:

```bash
npm start
```

The API listens on `http://localhost:4000` and shells out to the Rust verifier for every release. Confirm it's up with:

```bash
curl http://localhost:4000/api/health
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_CONTRACT_ADDRESS=<same address as backend .env>
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<optional, from cloud.walletconnect.com>
```

Then:

```bash
npm run dev
```

Visit **http://localhost:3000**.

**Add the local network to MetaMask** (one-time setup):
- Settings → Networks → Add network manually
- Network name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

**Import a funded test account:** `npm run node` (Terminal 1) prints 20 pre-funded accounts with 10,000 test ETH each and their private keys. Import any one via MetaMask → Import Account. These keys are Hardhat's well-known public test keys — safe only on this local chain, never use them anywhere real funds could reach them.

NodeBridge has three pages, linked from the top navbar:

| Route | Purpose |
|---|---|
| `/` (Jobs) | Lists jobs from `VoucherListed` events, with the off-chain title and the on-chain spec hash. Each open card has a **Fund job** button. |
| `/sell` (Offer) | Publish a job. The page hashes the title, task, and expected output, then calls `listVoucher`. |
| `/admin` (Verify) | Admin pastes a delivered result. **Verify and release** calls `POST /api/verify-delivery`. **Reject result** leaves the funds locked. |

## Trying it end-to-end

1. Start the chain, deploy, start the backend, start the frontend (steps above).
2. Import two different funded accounts into MetaMask — one to act as seller, one as buyer (any two of the accounts printed by `npm run node`, e.g. Account #2 and Account #3).
3. As the **provider** account: go to `/sell` and publish a job (title, task, expected output, id, price). Or use the seeded jobs. Job 1 expects `0.12,0.44,0.03,0.91,0.18,0.07,0.55,0.22`. Job 2 expects `17`.
4. Switch MetaMask to the **requester** account: go to `/`, click **Fund job**, and confirm the transaction. The card now shows `In escrow`.
5. Go to `/admin`, select that job, paste the expected output, and click **Verify and release**. The backend asks the Rust verifier to check the hashes, then signs `releaseFunds`. Pasting any other result leaves the funds locked.
6. Go back to `/`: the job now shows `Released`, and the provider's wallet balance has increased by the escrowed amount.

You can also drive NodeBridge purely from the command line without the UI:

```bash
curl -X POST http://localhost:4000/api/verify-delivery \
  -H "Content-Type: application/json" \
  -d '{"voucherId": 1, "status": "DELIVERED", "delivered": "0.12,0.44,0.03,0.91,0.18,0.07,0.55,0.22"}'

curl http://localhost:4000/api/delivery-history/1
```

## Smart contract reference

`contracts/contracts/EscrowMarketplace.sol`

| Function | Caller | Effect |
|---|---|---|
| `listVoucher(voucherId, price, specHash)` | Anyone (provider) | Creates a `Listed` job and stores its spec hash. Reverts if the ID is taken, the price is zero, or the hash is empty. |
| `purchaseVoucher(voucherId)` (payable) | Anyone except the seller | Requires `msg.value == price` exactly. Locks funds in the contract, moves state to `AwaitingDelivery`. |
| `releaseFunds(voucherId)` | Owner or an authorized worker | Pays the seller the escrowed amount, moves state to `Delivered`. |
| `refundBuyer(voucherId)` | Owner or an authorized worker | Pays the buyer back instead, moves state to `Refunded`. |
| `cancelListing(voucherId)` | The seller | Cancels a listing that hasn't been purchased yet. |
| `setWorkerAuthorization(address, bool)` | Owner only | Grants/revokes an address's permission to call `releaseFunds` / `refundBuyer`. |
| `getVoucher(voucherId)` | Anyone (view) | Returns the full voucher struct. |

**Voucher states:** `Listed → AwaitingDelivery → Delivered` (happy path), or `Listed → Cancelled`, or `AwaitingDelivery → Refunded`. All transitions are enforced by `require` checks — there is no path to release or refund a voucher twice.

## Backend API reference

Base URL: `http://localhost:4000/api`

**`POST /jobs`** and **`GET /jobs`**

Registers or lists the off-chain spec (`jobId`, `title`, `task`, `expected`). The two demo jobs are included automatically from `data/demo-jobs.json`.

**`POST /verify-delivery`**

```json
{ "voucherId": 1, "status": "DELIVERED", "delivered": "0.12,0.44,0.03,0.91,0.18,0.07,0.55,0.22" }
```

`status` must be one of `PENDING | IN_TRANSIT | DELIVERED | FAILED`. Only `DELIVERED` runs the Rust verifier and, on a match, calls `releaseFunds`. Any other status is stored and leaves the escrow untouched. Every attempt is appended to `backend/data/db.json`.

**`GET /delivery-history/:voucherId?`**

Returns recorded verification attempts, optionally filtered to one voucher.

**`GET /config`**

Returns the contract address and ABI the backend is currently configured to use — useful for confirming the backend and frontend point at the same deployment.

**`GET /health`**

Basic liveness check, returns `{ "ok": true }`.

## Testing

The smart contract has a full Hardhat/Chai test suite covering the happy path and every reverting edge case (double-listing, wrong payment amount, seller buying their own voucher, unauthorized release, double-release, refund, cancellation):

```bash
cd contracts
npm test
```

```bash
# from the repository root
cargo test --manifest-path verifier/Cargo.toml
```

The contract suite is 11 tests. The verifier suite covers a matching result, a mismatch, and a spec-hash change.

## Security notes

- `releaseFunds` and `refundBuyer` are restricted to the contract owner or addresses explicitly authorized via `setWorkerAuthorization` — no arbitrary address can drain escrow.
- `ReentrancyGuard` (`nonReentrant`) guards every function that moves funds: `purchaseVoucher`, `releaseFunds`, `refundBuyer`.
- `purchaseVoucher` requires `msg.value` to exactly equal the listed price — no over/under-payment edge cases.
- Voucher state transitions are strictly enforced (`Listed → AwaitingDelivery → Delivered`/`Refunded`), which is what prevents double-release, double-purchase, or releasing funds on a voucher that was never bought.
- The backend's private key is a narrow-permission hot wallet (it can only call `releaseFunds`/`refundBuyer`); it should never be reused for a wallet holding significant value.
- The job text is not on-chain. The contract stores the spec hash, and the backend refuses to release when the Rust verifier's hash disagrees with that commitment.

## Troubleshooting

- **"Not authorized" when releasing funds** — the backend's wallet address hasn't been authorized on-chain. Run `scripts/authorize-worker.js` (or redeploy with `BACKEND_WORKER_ADDRESS` set) with the exact address matching `BACKEND_PRIVATE_KEY` in `backend/.env`.
- **Frontend shows no vouchers / wrong data** — confirm `NEXT_PUBLIC_CONTRACT_ADDRESS` in `frontend/.env.local` matches the address the backend and Hardhat node are actually using; a chain restart without redeploying invalidates the old address.
- **MetaMask transactions fail after restarting the Hardhat node** — the local chain resets on restart but MetaMask caches account nonces. Go to MetaMask Settings → Advanced → Clear activity tab data for that account.
- **"invalid BytesLike value" from the backend** — `BACKEND_PRIVATE_KEY` in `backend/.env` is malformed (must be exactly 64 hex characters, with or without the `0x` prefix).
- **"Rust verifier not found"** — build it with `cargo build --release --manifest-path verifier/Cargo.toml`, or set `VERIFIER_BIN` in `backend/.env` to the executable path.
