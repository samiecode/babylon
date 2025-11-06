# Babylon Auto-Savings Platform

Babylon monitors user wallets, calculates auto-save amounts for each incoming transfer, and funds a non-custodial vault smart contract once the user approves. Users can later trigger withdrawals subject to the cooldown they configured.

## Architecture Overview

- **QuickNode webhook** (`POST /api/quicknode-webhook`) ingests ERC-20 `Transfer` logs, identifies active wallets, persists inbound transfer metadata, and books a provisional savings ledger entry.
- **Savings authorization** (`POST /api/savings/authorize`) is invoked after a user grants the deduction. It calls the on-chain vault to deposit the approved amount, then marks the transaction as funded.
- **Withdrawal management** (`POST /api/savings/withdraw`) supports requesting, cancelling, and executing withdrawals via the relayer wallet, syncing state with the vault and persistence layer.
- **Configuration** (`POST /api/savings/config`) stores per-user saving preferences and mirrors them on-chain.
- **SavingsVault.sol** holds balances per saver, enforces withdrawal cooldowns, and allows the relayer/controller to act on behalf of users where needed.

## Prerequisites

- Node.js 18+
- pnpm / npm
- PostgreSQL database
- Foundry (for Solidity testing)  
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `QUICKNODE_SIGNATURE` | Keccak-256 topic for ERC-20 `Transfer` (defaults to standard signature) |
| `SAVINGS_RPC_URL` | RPC endpoint used by the relayer (QuickNode, Infura, etc.) |
| `SAVINGS_CHAIN_ID` | Chain ID of the deployed vault contract |
| `SAVINGS_VAULT_ADDRESS` | Deployed `SavingsVault` contract address |
| `SAVINGS_RELAYER_PRIVATE_KEY` | Relayer private key (without `0x` prefix) used to call the vault |

The relayer account should be funded with native tokens to cover gas fees.

## Database & Prisma

```bash
npx prisma migrate dev       # create migration (edit schema first)
npx prisma generate          # regenerate Prisma client
npm run seed                 # optional: add seed data
```

Generated Prisma client lives under `src/app/generated/prisma`.

## Running the App

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## On-Chain Contracts

- Contracts live under `src/contract`.
- `SavingsVault.sol` stores saver balances, configurable withdrawal delays, and exposes controller helpers (`configureFor`, `depositFor`, request/cancel/execute withdrawals).
- Run Forge tests from `src/contract`:
  ```bash
  cd src/contract
  forge test
  ```

### Deployment

1. Build and deploy `SavingsVault.sol` (e.g. using `forge create`).
2. Set the deployed address as `SAVINGS_VAULT_ADDRESS`.
3. Point `SAVINGS_RELAYER_PRIVATE_KEY` to the controller account used when deploying/operating the vault.

## API Reference (Server Only)

These endpoints assume server-side authentication/authorization middleware upstream.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/quicknode-webhook` | `POST` | Ingest QuickNode webhook payloads, log detected transfers, stage savings ledger entries |
| `/api/savings/config` | `POST` | Update a user's savings percentage/cooldown and mirror settings on-chain |
| `/api/savings/authorize` | `POST` | Approve/reject a pending savings transaction; funds vault on approval |
| `/api/savings/withdraw` | `POST` | Request, cancel, or execute withdrawals against the vault |
| `/api/wallets` | `GET/POST` | CRUD helper for watched wallets |

## Testing Checklist

- `forge test` for Solidity vault logic (configure, deposit, withdraw happy paths and reverts).
- Add REST integration tests (e.g. using Vitest) that mock `vaultClient` to cover approval/withdrawal flows.
- Seed database with representative data and hit webhook endpoint using `test-webhook-payload.json`.

## Notes

- All addresses are normalised to lowercase to avoid duplicates.
- Monetary values are stored as 78-digit `Decimal` strings to preserve full `uint256` precision when persisted.
- Ledger entries track every auto-save, approval, and withdrawal to ease reconciliation and auditability.
