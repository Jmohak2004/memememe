import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("Set DEPLOYER_PRIVATE_KEY in contracts-pkg/.env");
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  console.log(`Deploying to ${network.name} from ${deployer.address}`);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const factory = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(treasury, 0);
  await factory.waitForDeployment();
  const address = await factory.getAddress();
  console.log("CreatorTokenFactory:", address);

  const lens = await (await ethers.getContractFactory("CreatorTokenLens")).deploy();
  await lens.waitForDeployment();
  const lensAddress = await lens.getAddress();
  console.log("CreatorTokenLens:", lensAddress);

  const file = path.join(__dirname, "..", "deployments.json");
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  all[chainId] = { network: network.name, factory: address, lens: lensAddress, treasury, block: await ethers.provider.getBlockNumber() };
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
