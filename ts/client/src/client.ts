import { Program, Provider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { CypherV3Reimbursement, IDL } from "./cypher_v3_reimbursement";

export const ID = new PublicKey("c3eRRbjqWr3CKNpnYGJsy3MK98hbsJyhRziy46EvQkN");

export class CypherV3ReimbursementClient {
  public program: Program<CypherV3Reimbursement>;
  constructor(provider: Provider) {
    this.program = new Program<CypherV3Reimbursement>(
      IDL as CypherV3Reimbursement,
      ID,
      provider
    );
  }

  public async decodeTable(group) {
    const ai = await this.program.provider.connection.getAccountInfo(
      group.table
    );

    if (!ai) {
      throw new Error(`Table ai cannot be undefined!`);
    }

    const rowSize = (this.program as any)._coder.types.typeLayouts.get(
      "Row"
    ).span;
    const tableHeaderSize = 48;
    const rows = (ai.data.length - tableHeaderSize) / rowSize;
    return [...Array(rows).keys()].map((i) => {
      const start = tableHeaderSize + i * rowSize;
      const end = start + rowSize;
      return (this.program as any)._coder.types.typeLayouts
        .get("Row")
        .decode(ai.data.subarray(start, end));
    });
  }

  public reimbursed(reimbursementAccount, tokenIndex): boolean {
    return (reimbursementAccount.reimbursed & (1 << tokenIndex)) !== 0;
  }

  public calimTransferred(reimbursementAccount, tokenIndex): boolean {
    return (reimbursementAccount.calimTransferred & (1 << tokenIndex)) !== 0;
  }
}
