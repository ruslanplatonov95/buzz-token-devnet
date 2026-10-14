// Fixed-supply, zero-transfer-fee Devnet pilot. No sale, staking contract or price support.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import {
  AuthorityType, createInitializeMetadataPointerInstruction, createInitializeMintInstruction,
  createSetAuthorityInstruction, ExtensionType, getAccount, getMint, getMintLen,
  getOrCreateAssociatedTokenAccount, getTokenMetadata, getTransferFeeConfig, LENGTH_SIZE, mintToChecked,
  TOKEN_2022_PROGRAM_ID, transferChecked, TYPE_SIZE,
} from '@solana/spl-token';
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';
import { allocation, supply } from './economics-v3.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const decimals = 6;
const unit = 10n ** BigInt(decimals);
const allotted = allocation(supply);

async function loadOrCreateKey(name) {
  const path = join(folder, name);
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, 'utf8'))));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const keypair = Keypair.generate();
    await writeFile(path, JSON.stringify(Array.from(keypair.secretKey)), { flag: 'wx', mode: 0o600 });
    return keypair;
  }
}

const payer = await loadOrCreateKey('.test-authority.json');
const mint = await loadOrCreateKey('.v3-mint-keypair.json');
const recipient = await loadOrCreateKey('.v3-recipient-keypair.json');
const metadata = {
  updateAuthority: payer.publicKey, mint: mint.publicKey,
  name: 'BUZZ DEVNET NO-FEE TEST', symbol: 'BUZZT3', uri: '',
  additionalMetadata: [['purpose', 'Devnet-only utility and 99/1 allocation test; no monetary value']],
};

if (!(await connection.getAccountInfo(mint.publicKey, 'confirmed'))) {
  const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
  const metadataSpace = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace + metadataSpace);
  if (await connection.getBalance(payer.publicKey, 'confirmed') < lamports + 20_000_000) {
    throw new Error('Not enough free Devnet SOL. Use only a Devnet faucet; never send real SOL.');
  }
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
      lamports, space: mintSpace, programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID, metadata: mint.publicKey,
      updateAuthority: payer.publicKey, mint: mint.publicKey,
      mintAuthority: payer.publicKey, name: metadata.name, symbol: metadata.symbol,
      uri: metadata.uri,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, mint], { commitment: 'confirmed' });
  console.log(`Create no-fee Devnet mint: ${signature}`);
}

const treasuryAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, payer.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const recipientAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, recipient.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
let state = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (state.decimals !== decimals) throw new Error('Existing mint has unexpected decimals');
if (getTransferFeeConfig(state)) throw new Error('V3 unexpectedly has transfer fees');
if (state.supply === 0n && state.mintAuthority?.equals(payer.publicKey)) {
  const signature = await mintToChecked(
    connection, payer, mint.publicKey, treasuryAta.address, payer,
    supply * unit, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Mint ${supply} Devnet units: ${signature}`);
  state = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
}
if (state.supply !== supply * unit) throw new Error('Unexpected supply; refusing further issuance');

const recipientBefore = await getAccount(connection, recipientAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
let allocatedNow = false;
if (recipientBefore.amount === 0n && state.mintAuthority?.equals(payer.publicKey)) {
  const signature = await transferChecked(
    connection, payer, treasuryAta.address, mint.publicKey, recipientAta.address,
    payer, allotted.public * unit, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Allocate 1% to test recipient without token transfer fee: ${signature}`);
  allocatedNow = true;
}
state = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (state.mintAuthority?.equals(payer.publicKey)) {
  const signature = await sendAndConfirmTransaction(
    connection, new Transaction().add(createSetAuthorityInstruction(
      mint.publicKey, payer.publicKey, AuthorityType.MintTokens,
      null, [], TOKEN_2022_PROGRAM_ID,
    )), [payer], { commitment: 'confirmed' },
  );
  console.log(`Revoke mint authority: ${signature}`);
}

const finalMint = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
const treasury = await getAccount(connection, treasuryAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
const publicTest = await getAccount(connection, recipientAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
const finalMetadata = await getTokenMetadata(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (finalMint.supply !== supply * unit || finalMint.mintAuthority !== null || finalMint.freezeAuthority !== null) {
  throw new Error('Final mint configuration does not match fixed-supply plan');
}
if (allocatedNow &&
    (treasury.amount !== allotted.treasury * unit || publicTest.amount !== allotted.public * unit)) {
  throw new Error('Initial 99/1 allocation does not match plan');
}
if (finalMetadata?.symbol !== metadata.symbol) throw new Error('Metadata mismatch');
console.log(JSON.stringify({
  network: 'devnet', mint: mint.publicKey.toBase58(), symbol: metadata.symbol,
  treasuryTokenAccount: treasuryAta.address.toBase58(),
  testRecipient: recipient.publicKey.toBase58(),
  testRecipientTokenAccount: recipientAta.address.toBase58(),
  totalSupply: supply.toString(), initialTreasuryUnits: allotted.treasury.toString(),
  initialRecipientUnits: allotted.public.toString(),
  currentTreasuryBaseUnits: treasury.amount.toString(),
  currentRecipientBaseUnits: publicTest.amount.toString(), transferFeeBasisPoints: 0,
  mintAuthorityRevoked: true, freezeAuthority: null, publicSale: false,
  noPriceFloor: true, stakingContractDeployed: false,
}, null, 2));
