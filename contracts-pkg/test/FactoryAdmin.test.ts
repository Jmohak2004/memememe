import { expect } from "chai";
import { ethers } from "hardhat";

describe("CreatorTokenFactory admin", () => {
  async function deploy() {
    const [owner, treasury, other, creator] = await ethers.getSigners();
    const f = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(treasury.address, 0);
    return { f, owner, treasury, other, creator };
  }
  it("only owner can change treasury and launch fee", async () => {
    const { f, other, owner } = await deploy();
    await expect(f.connect(other).setTreasury(other.address)).to.be.revertedWithCustomError(f, "OwnableUnauthorizedAccount");
    await expect(f.connect(other).setLaunchFee(1)).to.be.revertedWithCustomError(f, "OwnableUnauthorizedAccount");
    await f.connect(owner).setLaunchFee(5);
    expect(await f.launchFee()).to.equal(5);
  });
  it("rejects zero treasury", async () => {
    const { f } = await deploy();
    await expect(f.setTreasury(ethers.ZeroAddress)).to.be.revertedWith("zero");
  });
  it("paginates getTokens", async () => {
    const { f, creator } = await deploy();
    for (let i = 0; i < 5; i++) await f.connect(creator).createToken(`T${i}`, `T${i}`, ethers.parseEther("1000000"), ethers.parseEther("1"), 7 * 86400, "");
    expect((await f.getTokens(0, 3)).length).to.equal(3);
    expect((await f.getTokens(3, 10)).length).to.equal(2);
    expect((await f.getTokens(9, 10)).length).to.equal(0);
  });
});
