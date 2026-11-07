import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

const SUPPLY = ethers.parseEther("1000000000"); // 1B
const VETH = ethers.parseEther("1");
const DAY = 86400;

async function setup() {
  const [owner, treasury, creator, a, b, c] = await ethers.getSigners();
  const F = await ethers.getContractFactory("CreatorTokenFactory");
  const factory = await F.deploy(treasury.address, 0);
  await factory.connect(creator).createToken("Hype", "HYPE", SUPPLY, VETH, 30 * DAY, "ipfs://x");
  const addr = (await factory.allTokens(0)) as string;
  const token = await ethers.getContractAt("CreatorToken", addr);
  return { owner, treasury, creator, a, b, c, factory, token };
}

describe("CreatorTokenFactory", () => {
  it("validates params and tracks tokens", async () => {
    const { factory, creator } = await setup();
    await expect(factory.connect(creator).createToken("", "X", SUPPLY, VETH, 30 * DAY, "")).to.be.revertedWithCustomError(factory, "BadParams");
    await expect(factory.connect(creator).createToken("A", "A", 1n, VETH, 30 * DAY, "")).to.be.revertedWithCustomError(factory, "BadParams");
    await expect(factory.connect(creator).createToken("A", "A", SUPPLY, VETH, DAY, "")).to.be.revertedWithCustomError(factory, "BadParams");
    expect(await factory.allTokensLength()).to.equal(1);
    expect((await factory.tokensByCreator(creator.address)).length).to.equal(1);
  });
  it("charges launch fee to treasury", async () => {
    const [o, t, cr] = await ethers.getSigners();
    const factory = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(t.address, ethers.parseEther("0.01"));
    await expect(factory.connect(cr).createToken("A", "A", SUPPLY, VETH, 30 * DAY, "")).to.be.revertedWithCustomError(factory, "WrongFee");
    await expect(factory.connect(cr).createToken("A", "A", SUPPLY, VETH, 30 * DAY, "", { value: ethers.parseEther("0.01") })).to.changeEtherBalance(t, ethers.parseEther("0.01"));
  });
});

describe("CreatorToken trading", () => {
  it("buy then sell round-trips with only fees lost (after penalty window)", async () => {
    const { token, a } = await setup();
    const spend = ethers.parseEther("1");
    await token.connect(a).buy(0, { value: spend });
    const bal = await token.balanceOf(a.address);
    expect(bal).to.be.gt(0);
    await time.increase(DAY + 1);
    const before = await ethers.provider.getBalance(a.address);
    const tx = await token.connect(a).sell(bal, 0);
    const r = await tx.wait();
    const after = await ethers.provider.getBalance(a.address);
    const got = after - before + r!.gasUsed * r!.gasPrice;
    // ~2% fees roundtrip, plus own dividends claimable
    expect(got).to.be.gt((spend * 97n) / 100n);
    expect(got).to.be.lt(spend);
  });

  it("price rises with buys", async () => {
    const { token, a } = await setup();
    const p0 = await token.spotPrice();
    await token.connect(a).buy(0, { value: ethers.parseEther("0.5") });
    expect(await token.spotPrice()).to.be.gt(p0);
  });

  it("enforces slippage", async () => {
    const { token, a } = await setup();
    await expect(token.connect(a).buy(ethers.MaxUint256, { value: 1000n })).to.be.revertedWithCustomError(token, "Slippage");
  });

  it("contract always stays solvent for every liability", async () => {
    const { token, a, b, c } = await setup();
    const tokenAddr = await token.getAddress();
    for (const s of [a, b, c]) await token.connect(s).buy(0, { value: ethers.parseEther("0.7") });
    await time.increase(DAY + 1);
    await token.connect(a).sell((await token.balanceOf(a.address)) / 2n, 0);
    await token.connect(b).sell(await token.balanceOf(b.address), 0);
    const bal = await ethers.provider.getBalance(tokenAddr);
    let owed = (await token.creatorFees()) + (await token.protocolFees());
    for (const s of [a, b, c]) owed += await token.withdrawableDividendOf(s.address);
    const reserve = (await token.vEth()) - (await token.vEth0());
    expect(bal).to.be.gte(reserve + owed - 10n); // rounding dust tolerance
  });

  it("caps curve and refunds the excess", async () => {
    const { token, a } = await setup();
    const before = await ethers.provider.getBalance(a.address);
    await token.connect(a).buy(0, { value: ethers.parseEther("500000") }).catch(() => {});
    // fund a first
    await ethers.provider.send("hardhat_setBalance", [a.address, "0x" + (10n ** 24n).toString(16)]);
    await token.connect(a).buy(0, { value: ethers.parseEther("500000") });
    expect(await token.tokensSold()).to.equal(await token.curveSupply());
    await expect(token.connect(a).buy(0, { value: 1000n })).to.be.revertedWithCustomError(token, "CurveFull");
    // contract keeps no more than reserve + fees
    const bal = await ethers.provider.getBalance(await token.getAddress());
    expect(bal).to.be.lt(ethers.parseEther("500000"));
    void before;
  });
});

describe("holder dividends", () => {
  it("fees are shared pro-rata by all holders, not just the creator", async () => {
    const { token, a, b, c } = await setup();
    await token.connect(a).buy(0, { value: ethers.parseEther("1") });
    await token.connect(b).buy(0, { value: ethers.parseEther("1") });
    await token.connect(c).buy(0, { value: ethers.parseEther("2") }); // fee flows to a and b
    const da = await token.withdrawableDividendOf(a.address);
    const db = await token.withdrawableDividendOf(b.address);
    expect(da).to.be.gt(db); // a held through more trades
    expect(await token.withdrawableDividendOf(c.address)).to.equal(0);
    await expect(token.connect(a).claimDividends()).to.changeEtherBalance(a, da);
    await expect(token.connect(a).claimDividends()).to.be.revertedWithCustomError(token, "ZeroAmount");
  });

  it("transfers move future dividends but not past ones", async () => {
    const { token, a, b, c } = await setup();
    await token.connect(a).buy(0, { value: ethers.parseEther("1") });
    await token.connect(c).buy(0, { value: ethers.parseEther("1") });
    const earned = await token.withdrawableDividendOf(a.address);
    expect(earned).to.be.gt(0);
    await token.connect(a).transfer(b.address, await token.balanceOf(a.address));
    expect(await token.withdrawableDividendOf(a.address)).to.be.closeTo(earned, 2);
    expect(await token.withdrawableDividendOf(b.address)).to.equal(0);
  });
});

describe("anti-dump", () => {
  it("early sells pay a penalty redistributed to holders; late sells pay none", async () => {
    const { token, a, b } = await setup();
    await token.connect(a).buy(0, { value: ethers.parseEther("1") });
    await token.connect(b).buy(0, { value: ethers.parseEther("1") });
    expect(await token.earlySellPenaltyBps(a.address)).to.be.gt(900);
    const divBefore = await token.withdrawableDividendOf(b.address);
    await token.connect(a).sell(await token.balanceOf(a.address), 0);
    expect((await token.withdrawableDividendOf(b.address)) - divBefore).to.be.gt(ethers.parseEther("0.09"));
    await time.increase(DAY + 1);
    expect(await token.earlySellPenaltyBps(b.address)).to.equal(0);
  });
});

describe("creator vesting", () => {
  it("unlocks linearly and only to the creator", async () => {
    const { token, creator, a } = await setup();
    await expect(token.connect(a).claimVested()).to.be.revertedWithCustomError(token, "NotCreator");
    await time.increase(15 * DAY);
    await token.connect(creator).claimVested();
    const half = await token.balanceOf(creator.address);
    expect(half).to.be.closeTo((await token.creatorAllocation()) / 2n, ethers.parseEther("1000000"));
    await time.increase(20 * DAY);
    await token.connect(creator).claimVested();
    expect(await token.balanceOf(creator.address)).to.equal(await token.creatorAllocation());
  });
});

describe("community airdrop", () => {
  it("lets subscribers claim via merkle proof, once, within cap", async () => {
    const { token, creator, a, b } = await setup();
    const amt = ethers.parseEther("1000");
    const tree = StandardMerkleTree.of([[a.address, amt], [b.address, amt]], ["address", "uint256"]);
    // contract hashes abi.encode(addr, amount) twice == OZ StandardMerkleTree leaf format
    await expect(token.connect(a).setAirdropRoot(tree.root)).to.be.revertedWithCustomError(token, "NotCreator");
    await token.connect(creator).setAirdropRoot(tree.root);
    await expect(token.connect(creator).setAirdropRoot(tree.root)).to.be.revertedWithCustomError(token, "RootAlreadySet");
    await token.connect(a).claimAirdrop(amt, tree.getProof(0));
    expect(await token.balanceOf(a.address)).to.equal(amt);
    await expect(token.connect(a).claimAirdrop(amt, tree.getProof(0))).to.be.revertedWithCustomError(token, "AlreadyClaimed");
    await expect(token.connect(b).claimAirdrop(amt + 1n, tree.getProof(1))).to.be.revertedWithCustomError(token, "BadProof");
  });
});

describe("CreatorTokenLens", () => {
  it("batches token and user info", async () => {
    const { token, factory, a } = await setup();
    const lens = await (await ethers.getContractFactory("CreatorTokenLens")).deploy();
    await token.connect(a).buy(0, { value: ethers.parseEther("1") });
    const infos = await lens.page(await factory.getAddress(), 0, 10);
    expect(infos.length).to.equal(1);
    expect(infos[0].symbol).to.equal("HYPE");
    const [ports, total] = await lens.portfolio([await token.getAddress()], a.address);
    expect(ports[0].balance).to.be.gt(0);
    expect(total).to.equal(ports[0].pendingDividends);
  });
});
