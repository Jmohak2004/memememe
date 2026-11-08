import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, baseSepolia, hardhat } from "wagmi/chains";
import { http } from "wagmi";

export const WC_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id";

// Set VITE_ENABLE_LOCAL=true to add a local Hardhat node (chain 31337) for end-to-end testing.
const LOCAL = import.meta.env.VITE_ENABLE_LOCAL === "true";

export const wagmiConfig = getDefaultConfig({
  appName: "CreatorCoin",
  projectId: WC_ID,
  chains: LOCAL ? [sepolia, baseSepolia, hardhat] : [sepolia, baseSepolia],
  transports: { [sepolia.id]: http(), [baseSepolia.id]: http(), [hardhat.id]: http("http://127.0.0.1:8545") },
});

export const FACTORIES: Record<number, `0x${string}` | undefined> = {
  [sepolia.id]: (import.meta.env.VITE_FACTORY_SEPOLIA || undefined) as `0x${string}` | undefined,
  [baseSepolia.id]: (import.meta.env.VITE_FACTORY_BASE_SEPOLIA || undefined) as `0x${string}` | undefined,
  [hardhat.id]: (import.meta.env.VITE_FACTORY_LOCAL || undefined) as `0x${string}` | undefined,
};

export const FAUCETS: Record<number, { label: string; url: string }[]> = {
  [sepolia.id]: [
    { label: "Google Cloud Sepolia faucet", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
    { label: "Alchemy Sepolia faucet", url: "https://www.alchemy.com/faucets/ethereum-sepolia" },
  ],
  [baseSepolia.id]: [
    { label: "Coinbase Base Sepolia faucet", url: "https://portal.cdp.coinbase.com/products/faucet" },
    { label: "Alchemy Base Sepolia faucet", url: "https://www.alchemy.com/faucets/base-sepolia" },
  ],
};
