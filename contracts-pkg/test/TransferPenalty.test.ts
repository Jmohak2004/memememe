import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function setup() {
  const [, treasury, creator, a, b, c] = await ethers.getSigners();
  const f = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(treasury.address, 0);
  await f.connect(creator).createToken("T", "T", ethers.parseEther("1000000000"), ethers.parseEther("10"), 7 * 86400, "");
  const t = await ethers.getContractAt("CreatorToken", await f.allTokens(0));
  return { t, a, b, c };
}

describe("early-sell penalty follows transfers", () => {
  it("a fresh wallet that receives fresh tokens pays the same penalty (bypass closed)", async () => {
    const { t, a, b } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    expect(await t.earlySellPenaltyBps(b.address)).to.equal(0);
    await t.connect(a).transfer(b.address, await t.balanceOf(a.address));
    const pa = await t.earlySellPenaltyBps(a.address);
    const pb = await t.earlySellPenaltyBps(b.address);
    expect(pb).to.be.gt(900);
    expect(pb).to.be.closeTo(pa, 2n);
  });

  it("the penalty on the receiving wallet still decays to zero", async () => {
    const { t, a, b } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    await t.connect(a).transfer(b.address, await t.balanceOf(a.address));
    await time.increase(24 * 3600 + 1);
    expect(await t.earlySellPenaltyBps(b.address)).to.equal(0);
  });

  it("sending old tokens to a fresh wallet does not create a penalty", async () => {
    const { t, a, b } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    await time.increase(25 * 3600);
    await t.connect(a).transfer(b.address, (await t.balanceOf(a.address)) / 2n);
    expect(await t.earlySellPenaltyBps(b.address)).to.equal(0);
  });

  it("blends by balance: an old holder receiving a fresh half gets about half the penalty", async () => {
    const { t, a, b } = await setup();
    await t.connect(b).buy(0, { value: ethers.parseEther("1") });
    await time.increase(25 * 3600); // b is now penalty-free
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    const aBal = await t.balanceOf(a.address);
    const bBal = await t.balanceOf(b.address);
    const pa = await t.earlySellPenaltyBps(a.address);
    await t.connect(a).transfer(b.address, aBal);
    const expected = (pa * aBal) / (aBal + bBal);
    expect(await t.earlySellPenaltyBps(b.address)).to.be.closeTo(expected, 5n);
  });

  it("dust cannot be used to grief a long-time holder", async () => {
    const { t, a, b } = await setup();
    await t.connect(b).buy(0, { value: ethers.parseEther("1") });
    await time.increase(25 * 3600);
    await t.connect(a).buy(0, { value: ethers.parseEther("0.001") });
    await t.connect(a).transfer(b.address, 1n);
    expect(await t.earlySellPenaltyBps(b.address)).to.equal(0);
  });

  it("selling from the receiving wallet really pays the penalty to holders", async () => {
    const { t, a, b, c } = await setup();
    await t.connect(c).buy(0, { value: ethers.parseEther("1") }); // another holder to receive the penalty
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    await t.connect(a).transfer(b.address, await t.balanceOf(a.address));
    const bal = await t.balanceOf(b.address);
    const [, , penalty] = await t.quoteSell(b.address, bal);
    expect(penalty).to.be.gt(0);
    await expect(t.connect(b).sell(bal, 0)).to.emit(t, "Sold");
  });

  it("self-transfers and zero-value transfers do not change the clock", async () => {
    const { t, a } = await setup();
    await t.connect(a).buy(0, { value: ethers.parseEther("1") });
    const before = await t.lastBuyAt(a.address);
    await time.increase(3600);
    await t.connect(a).transfer(a.address, 5n);
    await t.connect(a).transfer(a.address, 0n);
    expect(await t.lastBuyAt(a.address)).to.equal(before);
  });
});
