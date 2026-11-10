// Verifies deployed contracts on Etherscan / Basescan. Needs ETHERSCAN_API_KEY (one key works for both via Etherscan v2).
import { run, network, ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const file = path.join(__dirname, "..", "deployments.json");
  const all = JSON.parse(fs.readFileSync(file, "utf8"));
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const d = all[chainId];
  if (!d) throw new Error(`No deployment for chain ${chainId} (${network.name})`);
  await run("verify:verify", { address: d.factory, constructorArguments: [d.treasury, 0] });
  await run("verify:verify", { address: d.lens, constructorArguments: [] });
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
