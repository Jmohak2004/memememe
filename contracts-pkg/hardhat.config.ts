import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const PK = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = PK ? [PK] : [];

const config: HardhatUserConfig = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" } },
  networks: {
    sepolia: { url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com", chainId: 11155111, accounts },
    baseSepolia: { url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org", chainId: 84532, accounts },
  },
};
export default config;
