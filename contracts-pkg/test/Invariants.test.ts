import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Randomised trading with deterministic seed: checks solvency + dividend conservation after every step.
function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

describe("invariants (randomised)", () => {
  for (const seed of [1, 7, 42]) {
    it(`solvent and dividend-conserving, seed ${seed}`, async () => {
      const signers = await ethers.getSigners();
      const [, treasury, creator, ...users] = signers;
      const factory = await (await ethers.getContractFactory("CreatorTokenFactory")).deploy(treasury.address, 0);
      await factory.connect(creator).createToken("R", "R", ethers.parseEther("1000000000"), ethers.parseEther("200"), 30 * 86400, "");
      const token = await ethers.getContractAt("CreatorToken", await factory.allTokens(0));
      const addr = await token.getAddress();
      const r = rng(seed);
      const actors = users.slice(0, 8);

      for (let step = 0; step < 60; step++) {
        const u = actors[Math.floor(r() * actors.length)];
        const roll = r();
        if (roll < 0.5) {
          await token.connect(u).buy(0, { value: ethers.parseEther((0.05 + r() * 2).toFixed(4)) });
        } else if (roll < 0.75) {
          const bal = await token.balanceOf(u.address);
          if (bal > 0n) await token.connect(u).sell((bal * BigInt(1 + Math.floor(r() * 100))) / 100n, 0);
        } else if (roll < 0.85) {
          const bal = await token.balanceOf(u.address);
          const to = actors[Math.floor(r() * actors.length)];
          if (bal > 0n) await token.connect(u).transfer(to.address, bal / 3n);
        } else if (roll < 0.95) {
          if ((await token.withdrawableDividendOf(u.address)) > 0n) await token.connect(u).claimDividends();
        } else {
          await time.increase(Math.floor(r() * 36000));
        }

        let owed = (await token.creatorFees()) + (await token.protocolFees());
        for (const a of actors) owed += await token.withdrawableDividendOf(a.address);
        const reserve = (await token.vEth()) - (await token.vEth0());
        const bal = await ethers.provider.getBalance(addr);
        // contract must hold at least the curve reserve plus everything owed (minus rounding dust)
        expect(bal + 1000n).to.be.gte(reserve + owed);
        // no one can have a negative / absurd claim
        expect(owed).to.be.lte(bal);
      }
    });
  }
});
