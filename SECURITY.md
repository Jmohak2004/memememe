# Security notes

**Status: unaudited, testnet only.** Do not deposit real funds.

## Trust model
- No owner can mint, pause, upgrade or drain a `CreatorToken`. The factory owner can only change the treasury and launch fee for *future* launches.
- Creator tokens (10%) cannot be minted up-front; they unlock linearly (min 7 days) via `claimVested`.
- Protocol fees are pull-based to the treasury address fixed at token creation.

## Invariants (tested in `contracts-pkg/test/Invariants.test.ts`)
- Contract ETH balance >= curve reserve + creator fees + protocol fees + all unclaimed holder dividends (within dust).
- Every buy and sell is bounded by user-supplied slippage limits.

## Known risks
- **Penalty bypass:** the early-sell tax tracks last *buy*; transferring to a fresh wallet avoids it.
- **Creator can be a contract** that reverts on ETH receipt; this only blocks its own fee claims.
- **Airdrop root is one-shot**: a wrong root cannot be corrected. Verify the list before publishing.
- **Dividend rounding** leaves at most dust in the contract.
- **Hand-written web ABI** is checked against the compiled contracts by `AbiSync.test.ts`.
- **`VITE_PINATA_JWT` is exposed to browsers.** Use a scoped key or a server proxy in production.
- Metadata URI is creator-controlled text; the UI does not render it as HTML.

## Before mainnet
Independent audit, fuzzing with Foundry/Echidna, a real indexer instead of RPC log scans, and legal review (token launches can be regulated securities activity in some jurisdictions).

Report issues privately to the repository owner.
