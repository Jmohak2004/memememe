import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function setup() {
  const [, treasury, creator, a, b] = await ethers.getSigners();
  const f = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(treasury.address, 0);
  await f.connect(creator).createToken("E", "E", ethers.parseEther("1000000000"), ethers.parseEther("10"), 7 * 86400, "");
  const t = await ethers.getContractAt("CreatorToken", await f.allTokens(0));
  return { t, treasury, creator, a, b };
}

describe("edge cases", () => {
  it("first buyer's fee share goes to creator since no holders exist", async () => {
    const { t, a } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    const fee = ethers.parseEther("0.01");
    expect(await t.protocolFees()).to.equal((fee * 2000n) / 10000n);
    expect(await t.creatorFees()).to.equal(fee - (fee * 2000n) / 10000n); // 40% + unclaimable 40% holder share
    expect(await t.totalDividendsDistributed()).to.equal(0);
  });
  it("zero-value buy and zero-token sell revert", async () => {
    const { t, a } = await setup();
    await expect(t.connect(a).buy(0, { value: 0 })).to.be.revertedWithCustomError(t, "ZeroAmount");
    await expect(t.connect(a).sell(0, 0)).to.be.revertedWithCustomError(t, "ZeroAmount");
  });
  it("cannot sell more than balance", async () => {
    const { t, a } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    await expect(t.connect(a).sell((await t.balanceOf(a.address)) + 1n, 0)).to.be.reverted;
  });
  it("protocol and creator can withdraw fees exactly once", async () => {
    const { t, a, treasury, creator } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    const pf = await t.protocolFees();
    await expect(t.claimProtocolFees()).to.changeEtherBalance(treasury, pf);
    await expect(t.claimProtocolFees()).to.be.revertedWithCustomError(t, "ZeroAmount");
    await expect(t.claimCreatorFees()).to.changeEtherBalance(creator, await t.creatorFees());
  });
  it("penalty decays linearly to zero", async () => {
    const { t, a } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    const p0 = await t.earlySellPenaltyBps(a.address);
    await time.increase(12 * 3600);
    const pHalf = await t.earlySellPenaltyBps(a.address);
    expect(pHalf).to.be.closeTo(p0 / 2n, 5n);
  });
  it("creator vested tokens are subject to the early-sell penalty", async () => {
    const { t, creator } = await setup();
    await time.increase(3 * 86400);
    await t.connect(creator).claimVested();
    expect(await t.earlySellPenaltyBps(creator.address)).to.be.gt(900);
  });
  it("airdrop cannot exceed the 10% allocation", async () => {
    const { t, creator, a } = await setup();
    const { StandardMerkleTree } = await import("@openzeppelin/merkle-tree");
    const cap = await t.airdropAllocation();
    const tree = StandardMerkleTree.of([[a.address, (cap + 1n).toString()]], ["address", "uint256"]);
    await t.connect(creator).setAirdropRoot(tree.root);
    await expect(t.connect(a).claimAirdrop(cap + 1n, tree.getProof(0))).to.be.revertedWithCustomError(t, "AirdropCapExceeded");
  });
});
