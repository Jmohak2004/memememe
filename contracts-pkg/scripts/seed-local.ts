// Spins up demo data on a local node: `npx hardhat node` then `npx hardhat run scripts/seed-local.ts --network localhost`
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer, creator1, creator2, ...fans] = await ethers.getSigners();
  const factory = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(deployer.address, 0);
  await factory.waitForDeployment();
  const lens = await (await ethers.getContractFactory("CreatorTokenLens")).deploy();
  await lens.waitForDeployment();

  const mk = async (s: any, name: string, sym: string) => {
    await (await factory.connect(s).createToken(name, sym, ethers.parseEther("1000000000"), ethers.parseEther("20"), 30 * 86400, "")).wait();
    return ethers.getContractAt("CreatorToken", await factory.allTokens((await factory.allTokensLength()) - 1n));
  };
  const a = await mk(creator1, "Pixel Pup", "PUP");
  const b = await mk(creator2, "Moon Chef", "CHEF");
  for (const t of [a, b]) for (const f of fans.slice(0, 6)) await (await t.connect(f).buy(0, { value: ethers.parseEther((0.5 + Math.random() * 3).toFixed(3)) })).wait();

  const out = { chainId: 31337, factory: await factory.getAddress(), lens: await lens.getAddress(), tokens: [await a.getAddress(), await b.getAddress()] };
  fs.writeFileSync(path.join(__dirname, "..", "deployments.local.json"), JSON.stringify(out, null, 2));
  console.log(out);
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
