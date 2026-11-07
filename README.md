# CreatorCoin

Meme coins for influencers where **holders get paid, not just the creator**. Runs on Ethereum Sepolia and Base Sepolia.

## Why it is different from pump-and-dump
| Mechanism | Effect |
|---|---|
| Bonding-curve market, no LP | Nothing to rug; always liquid; price is deterministic |
| 1% trade fee: 40% creator / **40% all holders** / 20% protocol | Every holder earns from volume, pro-rata, claimable any time |
| Creator 10% vests linearly (min 7 days) | Creator cannot dump day one; stays aligned |
| Early-sell penalty (10% decaying to 0 over 24h) | Flippers fund the holders who stay |
| 10% community allocation via Merkle airdrop | Creator rewards real subscribers |
| Creator chooses supply (1M–1T) and launch price | Full creator control, no pre-mine |

The creator still earns: 40% of all fees forever, plus appreciation on vested tokens.

## Layout
- `contracts-pkg/` Hardhat: `CreatorToken`, `CreatorTokenFactory`, tests, deploy script
- `web/` Vite + React + wagmi + RainbowKit (MetaMask, Coinbase, WalletConnect, Rainbow, Rabby, Phantom, Trust, Ledger, …)

## Run
```bash
cd contracts-pkg && npm i --legacy-peer-deps && npx hardhat test
cp .env.example .env   # add a funded testnet key
npm run deploy:sepolia && npm run deploy:base-sepolia   # writes deployments.json
cd ../web && cp .env.example .env   # paste factory addresses + WalletConnect project id
npm i --legacy-peer-deps && npm run dev
```
Faucets: Sepolia (Google Cloud / Alchemy), Base Sepolia (Coinbase CDP / Alchemy); links shown in-app.

## Known limits (testnet-grade, unaudited)
- Early-sell penalty keys off last *buy*; moving tokens to a fresh wallet bypasses it.
- Curve never "graduates" to a DEX; it is the permanent market.
- Airdrop tree JSON is shared off-chain (stored in creator's browser); a backend/IPFS pin is a next step.
- Not audited. Do not use real funds.
