import fs from "fs";
import * as path from "path";
import * as csv from "fast-csv";
import {
  Cluster,
  Config,
  CypherClient,
} from "@chugach-foundation/cypher-client";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { ID, CypherV3ReimbursementClient } from "./client";
import { CypherV3Reimbursement, IDL } from "./cypher_v3_reimbursement";

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

  console.log("Creating Table " + tableAccount.toString());

  const sig = await program.methods
    .createTable(TABLE_NUM!)
    .accountsStrict({
      table: tableAccount,
      payer: admin.publicKey,
      authority: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  if (sig) {
    console.log("Transaction Signature: " + sig);
  } else {
    console.log("Failed Transaction Submission: " + sig);
  }
}

main();
