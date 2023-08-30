import fs from "fs";
import * as path from "path";
import * as csv from "fast-csv";
import {
  Cluster,
  Config,
  CypherClient,
} from "@chugach-foundation/cypher-client";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Wallet, AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { ID, CypherV3ReimbursementClient } from "./client";
import { CypherV3Reimbursement, IDL } from "./cypher_v3_reimbursement";
import { TypeDef } from "@project-serum/anchor/dist/cjs/program/namespace/types";

/// Env
const CLUSTER_URL =
  process.env.CLUSTER_URL_OVERRIDE || process.env.MB_CLUSTER_URL;
const PAYER_KEYPAIR =
  process.env.PAYER_KEYPAIR_OVERRIDE || process.env.MB_PAYER_KEYPAIR;
const GROUP_NUM = Number(process.env.GROUP_NUM || 20);
const CYPHER_V3_CLUSTER: Cluster =
  (process.env.CYPHER_V3_CLUSTER_OVERRIDE as Cluster) || "mainnet-beta";
const TABLE_NUM = Number(process.env.TABLE_NUM || 0);

const options = AnchorProvider.defaultOptions();
const connection = new Connection(CLUSTER_URL!, options);
const cypherClient = new CypherClient(CYPHER_V3_CLUSTER!, CLUSTER_URL!);

async function main() {
  // Load IDL for binary data decoding
  const admin = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(PAYER_KEYPAIR!, "utf-8")))
  );
  const adminWallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, adminWallet, options);
  const program = new Program<CypherV3Reimbursement>(
    IDL as CypherV3Reimbursement,
    ID,
    provider
  );

  const tableNumBuffer = Buffer.alloc(4);
  tableNumBuffer.writeUInt32LE(TABLE_NUM!);
  const [tableAccount] = await PublicKey.findProgramAddress(
    [Buffer.from("Table"), tableNumBuffer],
    program.programId
  );

  const groupNumBuffer = Buffer.alloc(4);
  groupNumBuffer.writeUInt32LE(GROUP_NUM!);
  const [groupAccount] = await PublicKey.findProgramAddress(
    [Buffer.from("Group"), groupNumBuffer],
    program.programId
  );

  console.log("Table: " + tableAccount.toString());

  const tableAccountNumRowsOffset = 12;
  const tableAccountHeaderSize = 48;
  const tableRowSize = 160;

  const rowsFromCsv = [];
  fs.createReadStream(
    path.resolve(__dirname, "assets", "../../../../assets/devnet-test.csv")
  )
    .pipe(csv.parse({ headers: true }))
    .on("data", (row) => rowsFromCsv.push(row))
    .on("end", async (rowCount: number) => {
      if (rowCount != rowsFromCsv.length) {
        throw new Error("Error in aggregating all rows from the csv!");
      }
      console.log(`Loaded ${rowCount} rows from csv file`);

      const rowsToAdd = rowsFromCsv.map((r) => {
        const props = Object.keys(r);
        const balances = [...Array(props.length - 2).keys()].map((i) => {
          return new BN(r[props[i + 2]]);
        });
        return {
          owner: new PublicKey(r.owner),
          balances,
        } as TypeDef<CypherV3Reimbursement["types"][0], CypherV3Reimbursement>;
      });

      // the add rows tx receives 4 accounts
      // tx size without data and signatures is 4 * 32 + 8 + 4 = 140
      // to get tx size with data and signature it is 4 * 32 + 8 + 4 + rows * 160 + 64 = 204 + rows * 160
      // we can only add 6 rows at a time = 6 * 160 + 204 = 1164

      const totalTransactions = Math.round(rowsToAdd.length / 6);

      for (let i = 0; i < rowsToAdd.length; i += 6) {
        const chunk = rowsToAdd.slice(i, i + 6);
        // do whatever
        console.log(chunk);
        const sig = await program.methods
          .addRows(chunk)
          .accountsStrict({
            table: tableAccount,
            payer: admin.publicKey,
            authority: admin.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        const currTx = i + 1;

        console.log(
          "Transaction " +
            currTx +
            " of " +
            totalTransactions +
            " Signature: " +
            sig
        );
      }
    });
}

main();
