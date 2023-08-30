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

const options = AnchorProvider.defaultOptions();
const connection = new Connection(CLUSTER_URL!, options);

async function main() {
  // Load IDL for binary data decoding
  const admin = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(PAYER_KEYPAIR!, "utf-8")))
  );
  const adminWallet = new Wallet(admin);
  const provider = new AnchorProvider(connection, adminWallet, options);
  const cypherV3ReimbursementClient = new CypherV3ReimbursementClient(provider);

  // load group
  let group = (
    await cypherV3ReimbursementClient.program.account.group.all()
  ).find((group) => group.account.groupNum === GROUP_NUM);

  console.log("Printing Table " + group?.account.table.toString());

  const rows = await cypherV3ReimbursementClient.decodeTable(group.account);

  console.log("Decoded Table With " + rows.length + " Rows");

  for (const row of rows) {
    console.log(
      "Owner: " +
        row.owner +
        " Balances: " +
        row.balances.map((i) => i.toNumber())
    );
  }
}

main();
