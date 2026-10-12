import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  clusterApiUrl, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType, TOKEN_2022_PROGRAM_ID, LENGTH_SIZE, TYPE_SIZE,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen, getOrCreateAssociatedTokenAccount, mintTo, transfer,
} from "@solana/spl-token";
import { createInitializeInstruction, pack, TokenMetadata } from "@solana/spl-token-metadata";
import fs from "fs";
import os from "os";

const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(os.homedir() + "/.config/solana/id.json", "utf8")))
);

const RECIPIENT = new PublicKey("9skxkCLdso3Xfab4c1Q2vfWrpgoYrogbQ7x3ygdKQ2z7");

async function main() {
  const mint = Keypair.generate();
  const decimals = 9;

  const meta: TokenMetadata = {
    mint: mint.publicKey,
    name: "Bek Client Token",
    symbol: "BCT",
    uri: "https://example.com/metadata.json",
    additionalMetadata: [],
  };

  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(meta).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mint.publicKey, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      name: meta.name,
      symbol: meta.symbol,
      uri: meta.uri,
      mintAuthority: payer.publicKey,
      updateAuthority: payer.publicKey,
    })
  );

  const createSig = await sendAndConfirmTransaction(connection, tx, [payer, mint]);
  console.log("Mint:", mint.publicKey.toBase58());
  console.log("Create tx:", createSig);

  const myAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint.publicKey, payer.publicKey,
    false, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  const mintSig = await mintTo(
    connection, payer, mint.publicKey, myAta.address, payer,
    1000n * 10n ** 9n, [], undefined, TOKEN_2022_PROGRAM_ID
  );
  console.log("Mint tx:", mintSig);

  const recAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint.publicKey, RECIPIENT,
    true, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  const transferSig = await transfer(
    connection, payer, myAta.address, recAta.address, payer,
    10n * 10n ** 9n, [], undefined, TOKEN_2022_PROGRAM_ID
  );
  console.log("Transfer tx:", transferSig);
}

main().catch(console.error);
