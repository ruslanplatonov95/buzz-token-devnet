// Devnet-only Token-2022 transfer-fee and fee-burn proof of concept.
// This is not a mainnet deployment, a sale, or a price-support mechanism.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Connection, Keypair, sendAndConfirmTransaction, SystemProgram, Transaction,
} from '@solana/web3.js';
import {
  AuthorityType, burnChecked, createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction, createInitializeTransferFeeConfigInstruction,
  createSetAuthorityInstruction, ExtensionType, getAccount, getMint, getMintLen,
  getOrCreateAssociatedTokenAccount, getTokenMetadata, getTransferFeeAmount,
  getTransferFeeConfig, LENGTH_SIZE, mintToChecked, TOKEN_2022_PROGRAM_ID,
  transferCheckedWithFee, TYPE_SIZE, withdrawWithheldTokensFromAccounts,
} from '@solana/spl-token';
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';

const folder = dirname(fileURLToPath(import.meta.url));
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const decimals = 6;
const unit = 10n ** BigInt(decimals);
const initialSupply = 10_000_000n * unit;
const demoTransfer = 1_000n * unit;
const feeBasisPoints = 100; // 1% demo assumption; not a production decision.
const demoFee = demoTransfer * BigInt(feeBasisPoints) / 10_000n;
const maxFee = 100_000n * unit;

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
const mint = await loadOrCreateKey('.fee-mint-keypair.json');
const recipient = await loadOrCreateKey('.fee-recipient-keypair.json');
console.log(`Devnet fee-demo mint candidate: ${mint.publicKey.toBase58()}`);
console.log(`Devnet test recipient: ${recipient.publicKey.toBase58()}`);

const metadata = {
  updateAuthority: payer.publicKey,
  mint: mint.publicKey,
  name: 'BUZZ DEVNET FEE TEST',
  symbol: 'BUZZT2',
  uri: '',
  additionalMetadata: [['purpose', 'Devnet-only fee and burn test; no monetary value']],
};

if (!(await connection.getAccountInfo(mint.publicKey, 'confirmed'))) {
  const mintSpace = getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.MetadataPointer]);
  const metadataSpace = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintSpace + metadataSpace);
  const payerBalance = await connection.getBalance(payer.publicKey, 'confirmed');
  if (payerBalance < lamports + 20_000_000) {
    throw new Error('Not enough free Devnet SOL for test mint rent and fees');
  }
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey, newAccountPubkey: mint.publicKey,
      lamports, space: mintSpace, programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey, payer.publicKey, payer.publicKey,
      feeBasisPoints, maxFee, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMetadataPointerInstruction(
      mint.publicKey, payer.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeMintInstruction(
      mint.publicKey, decimals, payer.publicKey, null, TOKEN_2022_PROGRAM_ID,
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID, metadata: mint.publicKey,
      updateAuthority: payer.publicKey, mint: mint.publicKey,
      mintAuthority: payer.publicKey, name: metadata.name,
      symbol: metadata.symbol, uri: metadata.uri,
    }),
  );
  const signature = await sendAndConfirmTransaction(connection, tx, [payer, mint], { commitment: 'confirmed' });
  console.log(`Create transfer-fee mint: ${signature}`);
}

const treasury = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, payer.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const recipientAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, recipient.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);

let mintState = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (mintState.decimals !== decimals) throw new Error('Unexpected mint decimals');
const feeConfig = getTransferFeeConfig(mintState);
if (!feeConfig || feeConfig.olderTransferFee.transferFeeBasisPoints !== feeBasisPoints) {
  throw new Error('Transfer fee extension is absent or misconfigured');
}
if (mintState.supply === 0n && mintState.mintAuthority?.equals(payer.publicKey)) {
  const signature = await mintToChecked(
    connection, payer, mint.publicKey, treasury.address, payer,
    initialSupply, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Mint ${initialSupply / unit} test tokens: ${signature}`);
  mintState = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
}
if (mintState.supply !== initialSupply && mintState.supply !== initialSupply - demoFee) {
  throw new Error(`Unexpected supply ${mintState.supply}; refusing to continue`);
}
if (mintState.mintAuthority?.equals(payer.publicKey)) {
  const signature = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(createSetAuthorityInstruction(
      mint.publicKey, payer.publicKey, AuthorityType.MintTokens,
      null, [], TOKEN_2022_PROGRAM_ID,
    )), [payer], { commitment: 'confirmed' },
  );
  console.log(`Revoke additional minting: ${signature}`);
}

let recipientState = await getAccount(connection, recipientAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (recipientState.amount === 0n && mintState.supply === initialSupply) {
  const signature = await transferCheckedWithFee(
    connection, payer, treasury.address, mint.publicKey,
    recipientAta.address, payer, demoTransfer, decimals, demoFee,
    [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Transfer ${demoTransfer / unit} tokens with ${demoFee / unit} withheld fee: ${signature}`);
  recipientState = await getAccount(connection, recipientAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
}
if (recipientState.amount !== demoTransfer - demoFee) {
  throw new Error(`Recipient amount ${recipientState.amount} differs from expected ${demoTransfer - demoFee}`);
}

const withheld = getTransferFeeAmount(recipientState)?.withheldAmount ?? 0n;
if (withheld > 0n) {
  if (withheld !== demoFee) throw new Error(`Unexpected withheld amount ${withheld}`);
  const signature = await withdrawWithheldTokensFromAccounts(
    connection, payer, mint.publicKey, treasury.address, payer,
    [], [recipientAta.address], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Collect withheld fee for burn: ${signature}`);
}

mintState = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (mintState.supply === initialSupply) {
  const signature = await burnChecked(
    connection, payer, treasury.address, mint.publicKey, payer,
    demoFee, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  console.log(`Burn collected transfer fee: ${signature}`);
}

const verifiedMint = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
const verifiedRecipient = await getAccount(connection, recipientAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
const verifiedMetadata = await getTokenMetadata(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (verifiedMint.supply !== initialSupply - demoFee) throw new Error('Final supply mismatch');
if (verifiedMint.mintAuthority !== null) throw new Error('Mint authority still active');
if ((getTransferFeeAmount(verifiedRecipient)?.withheldAmount ?? 0n) !== 0n) {
  throw new Error('Demo fee was not fully collected');
}
if (verifiedMetadata?.symbol !== metadata.symbol) throw new Error('Metadata mismatch');
console.log(JSON.stringify({
  network: 'devnet', mint: mint.publicKey.toBase58(), symbol: metadata.symbol,
  treasury: treasury.address.toBase58(), recipient: recipient.publicKey.toBase58(),
  recipientTokenAccount: recipientAta.address.toBase58(),
  feeBasisPoints, transfer: (demoTransfer / unit).toString(),
  withheldAndBurned: (demoFee / unit).toString(),
  currentSupply: (verifiedMint.supply / unit).toString(),
  mintAuthorityRevoked: true, freezeAuthority: verifiedMint.freezeAuthority?.toBase58() ?? null,
  feeCollectionRequiresOperator: true, publicSale: false,
}, null, 2));
