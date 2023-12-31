import fs from "fs";
import * as path from "path";
import * as csv from "fast-csv";
import {
  Cluster,
  Config,
  CypherClient,
} from "@chugach-foundation/cypher-client";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
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

// // Mango v3 client setup
// const config = Config.ids();
// const groupIds = config.getGroup(CYPHER_V3_CLUSTER, MANGO_V3_GROUP_NAME);
// if (!groupIds) {
//   throw new Error(`Group ${MANGO_V3_GROUP_NAME} not found`);
// }
// const mangoProgramId = groupIds.mangoProgramId;
// const mangoGroupKey = groupIds.publicKey;

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

  //
  // Read table
  //
  const tableAccountNumRowsOffset = 12;
  const tableAccountHeaderSize = 48;
  const tableRowSize = 160;

  const tableNumBuffer = Buffer.alloc(4);
  tableNumBuffer.writeUInt32LE(TABLE_NUM!);
  const [tableAccount] = await PublicKey.findProgramAddress(
    [Buffer.from("Table"), tableNumBuffer],
    program.programId
  );

  const tableAccountInfo = await connection.getAccountInfo(tableAccount);

  if (tableAccountInfo) {
    // at this point we have successfully loaded a non null table, so let's load the csv and proceed
    const tableNumRows = tableAccountInfo.data.readUint32LE(
      tableAccountNumRowsOffset
    );
    console.log(`Loaded table account with ${tableNumRows} rows.`);

    const tableRowsData = tableAccountInfo.data.subarray(
      tableAccountHeaderSize
    );

    const rowsFromCsv = [];
    fs.createReadStream(
      path.resolve(
        __dirname,
        "assets",
        "../../../../assets/reimbursement-20230807.csv"
      )
    )
      .pipe(csv.parse({ headers: true }))
      .on("data", (row) => rowsFromCsv.push(row))
      .on("end", async (rowCount: number) => {
        if (rowCount != rowsFromCsv.length) {
          throw new Error("Error in aggregating all rows from the csv!");
        }
        console.log(`Loaded ${rowCount} rows from csv file`);

        //
        // Collect accounts together, map is indexed by owner
        //
        const rowsFromCsvMapByOwner = new Map();
        for (const row of rowsFromCsv) {
          !rowsFromCsvMapByOwner.get(row.owner) &&
            rowsFromCsvMapByOwner.set(row.owner, []);
          rowsFromCsvMapByOwner.get(row.owner).push(row);
        }
        console.log(
          `Created map for ${
            Array.from(rowsFromCsvMapByOwner.keys()).length
          } owner from csv file`
        );

        // const tableHeaderSize = 3;
        // const rowsFromBinaryTable = [
        //   ...Array((table.length - tableHeaderSize) / rowSize).keys(),
        // ].map((i) => {
        //   const start = tableHeaderSize + i * rowSize;
        //   const end = start + rowSize;
        //   return (program as any)._coder.types.typeLayouts
        //     .get("Row")
        //     .decode(table.subarray(start, end));
        // });
        // console.log(
        //   `Loaded ${rowsFromBinaryTable.length} rows from binary file`
        // );

        // const groupTokens = (await mangoV3Client.getMangoGroup(mangoGroupKey))
        //   .tokens;
        // //
        // // Compare for a owner
        // //
        // let errorCount = 0;
        // for (const rowFromBinaryTable of rowsFromBinaryTable) {
        //   const balancesFromBinaryTable = rowFromBinaryTable.balances;
        //   const accountsFromCsv = rowsFromCsvMapByOwner.get(
        //     rowFromBinaryTable.owner.toBase58()
        //   );

        //   Array.from(groupTokens.entries())
        //     .filter((entry) => entry[1].oracleInactive === false)
        //     .filter((entry) => !entry[1].mint.equals(PublicKey.default))
        //     .forEach((entry) => {
        //       const tokenIndex = entry[0];

        //       const symbol = groupIds?.tokens.find((token) =>
        //         token.mintKey.equals(entry[1].mint)
        //       ).symbol;

        //       const balanceFromBinaryTable =
        //         balancesFromBinaryTable[tokenIndex].toNumber();

        //       const sumOfbalancesAcrossAccountsFromBinaryCsv = accountsFromCsv
        //         .map((account) => account[symbol])
        //         .reduce((a, b) => {
        //           return a + parseInt(b);
        //         }, 0);

        //       if (
        //         balanceFromBinaryTable !==
        //         sumOfbalancesAcrossAccountsFromBinaryCsv
        //       ) {
        //         console.error(
        //           `Error: Entries mismatched for ${symbol} ${rowFromBinaryTable.owner} ${balanceFromBinaryTable} ${sumOfbalancesAcrossAccountsFromBinaryCsv}`
        //         );
        //         errorCount += 1;
        //       } else {
        //         // console.log(
        //         //   `Success: Entries matched for ${symbol} ${rowFromBinaryTable.owner} ${balanceFromBinaryTable} ${sumOfbalancesAcrossAccountsFromBinaryCsv}`
        //         // );
        //       }
        //     });
        // }
        // console.log(`Finished comparing errorCount - ${errorCount}!`);
      });
  }
}

main();
