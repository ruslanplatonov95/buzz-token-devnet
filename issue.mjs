// BUZZ devnet demonstration only. This must never be pointed at mainnet.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  AuthorityType,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getMint,
  getMintLen,
  getOrCreateAssociatedTokenAccount,
  getTokenMetadata,
  LENGTH_SIZE,
  mintToChecked,
  burnChecked,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from '@solana/spl-token';
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';

const folder = dirname(fileURLToPath(import.meta.url));
const rpcUrl = 'https://api.devnet.solana.com';
const targetSupply = 10_000_000n;
const sampleBurn = 1n;
const decimals = 0;

async function loadOrCreateKey(name) {
  const path = join(folder, name);
  try {
    const bytes = JSON.parse(await readFile(path, 'utf8'));
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const keypair = Keypair.generate();
    await writeFile(path, JSON.stringify(Array.from(keypair.secretKey)), {
      flag: 'wx', mode: 0o600,
    });
    return keypair;
  }
}

const connection = new Connection(rpcUrl, 'confirmed');
const payer = await loadOrCreateKey('.test-authority.json');
const mint = await loadOrCreateKey('.mint-keypair.json');
console.log(`Network: devnet; authority: ${payer.publicKey.toBase58()}`);
console.log(`Mint candidate: ${mint.publicKey.toBase58()}`);

let payerBalance = await connection.getBalance(payer.publicKey, 'confirmed');
if (payerBalance < 50_000_000) {
  const airdropSignature = await connection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL / 10);
  await connection.confirmTransaction(airdropSignature, 'confirmed');
  payerBalance = await connection.getBalance(payer.publicKey, 'confirmed');
}
if (payerBalance < 50_000_000) throw new Error('Devnet SOL faucet did not fund test wallet');

const metadata = {
  updateAuthority: payer.publicKey,
  mint: mint.publicKey,
  name: 'BUZZ DEVNET TEST',
  symbol: 'BUZZT',
  uri: '',
  additionalMetadata: [['purpose', 'Test-only BUZZ utility token; no monetary value']],
};

if (!(await connection.getAccountInfo(mint.publicKey, 'confirmed'))) {
  const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
  const metadataSpace = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace + metadataSpace);
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports,
      space: mintSpace,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint.publicKey,
      updateAuthority: payer.publicKey,
      mint: mint.publicKey,
      mintAuthority: payer.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, transaction, [payer, mint], {
    commitment: 'confirmed',
  });
  console.log(`Create mint transaction: ${signature}`);
}

const treasury = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, payer.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
let mintState = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (mintState.decimals !== decimals) throw new Error('Existing mint has unexpected decimals');
if (mintState.supply === 0n && mintState.mintAuthority?.equals(payer.publicKey)) {
  const signature = await mintToChecked(
    connection, payer, mint.publicKey, treasury.address, payer,
    targetSupply, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Mint ${targetSupply} test units transaction: ${signature}`);
  mintState = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
}
if (mintState.supply !== targetSupply && mintState.supply !== targetSupply - sampleBurn) {
  throw new Error(`Unexpected supply ${mintState.supply}; refusing to issue or burn more`);
}

if (mintState.mintAuthority?.equals(payer.publicKey)) {
  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createSetAuthorityInstruction(
      mint.publicKey, payer.publicKey, AuthorityType.MintTokens,
      null, [], TOKEN_2022_PROGRAM_ID,
    )),
    [payer], { commitment: 'confirmed' },
  );
  console.log(`Revoke mint authority transaction: ${signature}`);
  mintState = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
}
if (mintState.mintAuthority !== null) throw new Error('Mint authority not revoked');

if (mintState.supply === targetSupply) {
  const signature = await burnChecked(
    connection, payer, treasury.address, mint.publicKey, payer,
    sampleBurn, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Sample burn ${sampleBurn} unit transaction: ${signature}`);
}

const verifiedMint = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
const verifiedTreasury = await getAccount(connection, treasury.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
const verifiedMetadata = await getTokenMetadata(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (verifiedMint.supply !== targetSupply - sampleBurn) throw new Error('Final supply mismatch');
if (verifiedTreasury.amount !== verifiedMint.supply) throw new Error('Treasury balance mismatch');
if (verifiedMetadata?.name !== metadata.name || verifiedMetadata?.symbol !== metadata.symbol) {
  throw new Error('Metadata mismatch');
}
console.log(JSON.stringify({
  network: 'devnet',
  mint: mint.publicKey.toBase58(),
  tokenAccount: treasury.address.toBase58(),
  name: verifiedMetadata.name,
  symbol: verifiedMetadata.symbol,
  initialMinted: targetSupply.toString(),
  sampleBurned: sampleBurn.toString(),
  currentSupply: verifiedMint.supply.toString(),
  mintAuthorityRevoked: verifiedMint.mintAuthority === null,
  freezeAuthority: verifiedMint.freezeAuthority?.toBase58() ?? null,
  publicSale: false,
}, null, 2));
