import fs from "fs";
import * as path from "path";
import * as csv from "fast-csv";
import {
  Cluster,
  Config,
  CypherClient,
} from "@chugach-foundation/cypher-client";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Wallet, AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { ID, CypherV3ReimbursementClient } from "./client";
import { CypherV3Reimbursement, IDL } from "./cypher_v3_reimbursement";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

/// Env
const CLUSTER_URL =
  process.env.CLUSTER_URL_OVERRIDE || process.env.MB_CLUSTER_URL;
const PAYER_KEYPAIR =
  process.env.PAYER_KEYPAIR_OVERRIDE || process.env.MB_PAYER_KEYPAIR;
const GROUP_NUM = Number(process.env.GROUP_NUM || 20);
const CYPHER_V3_CLUSTER: Cluster =
  (process.env.CYPHER_V3_CLUSTER_OVERRIDE as Cluster) || "mainnet-beta";
const TABLE_NUM = Number(process.env.TABLE_NUM || 0);
const TOKEN_INDEX = new BN(process.env.TOKEN_INDEX || 0);
const MINT = process.env.MINT;

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
  const [claimMint] = await PublicKey.findProgramAddress(
    [
      Buffer.from("Mint"),
      groupAccount.toBuffer(),
      TOKEN_INDEX.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );
  console.log("Claim Token Mint: " + claimMint.toString());

  const mint = new PublicKey(MINT!);
  console.log("Token Mint: " + mint.toString());

  const vaultAddress = await getAssociatedTokenAddress(
    mint,
    groupAccount,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log("Creating Vault: " + vaultAddress.toString());

  const claimTransferTokenAccount = await getAssociatedTokenAddress(
    claimMint,
    admin.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const sig = await program.methods
    .createVault(TOKEN_INDEX!)
    .accountsStrict({
      group: groupAccount,
      authority: admin.publicKey,
      vault: vaultAddress,
      claimTransferTokenAccount,
      claimTransferDestination: admin.publicKey,
      claimMint,
      mint,
      payer: admin.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
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
