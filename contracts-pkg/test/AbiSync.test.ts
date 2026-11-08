import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { artifacts } from "hardhat";

// Guards against the web app's hand-written ABI drifting from the contracts.
function parseWebAbi(name: "factoryAbi" | "tokenAbi") {
  const src = fs.readFileSync(path.join(__dirname, "../../web/src/lib/abi.ts"), "utf8");
  const block = src.split(`export const ${name} = [`)[1].split("] as const")[0];
  const items = [...block.matchAll(/name: "(\w+)", stateMutability: "(\w+)", inputs: \[([\s\S]*?)\], outputs/g)];
  return items.map((m) => ({ name: m[1], mut: m[2], nInputs: (m[3].match(/type:/g) || []).length }));
}

for (const [abiName, contract] of [["factoryAbi", "CreatorTokenFactory"], ["tokenAbi", "CreatorToken"]] as const) {
  describe(`web ${abiName}`, () => {
    it("matches compiled contract", async () => {
      const art = await artifacts.readArtifact(contract);
      const web = parseWebAbi(abiName);
      expect(web.length).to.be.gte(4);
      for (const w of web) {
        const fn = art.abi.find((x: any) => x.type === "function" && x.name === w.name && x.inputs.length === w.nInputs);
        expect(fn, `${contract}.${w.name}(${w.nInputs}) missing`).to.not.equal(undefined);
        expect((fn as any).stateMutability, w.name).to.equal(w.mut);
      }
    });
  });
}
