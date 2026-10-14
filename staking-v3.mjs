// Zero-token-transfer-fee Devnet round-trip. The vault is STILL operator-controlled.
// This is not staking of SOL, not an audited program, and not a promised return.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import {
  createTransferCheckedInstruction, getAccount, getMint, getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID, transferChecked,
} from '@solana/spl-token';
import { rewardBaseUnits } from './economics-v3.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const ledgerPath = join(folder, '.v3-stake-ledger.json');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const decimals = 6;
const unit = 10n ** BigInt(decimals);
const principal = 500n * unit;
const aprBasisPoints = 800n; // Arithmetic test input only, not offered APY.
const action = process.argv[2] ?? 'status';
if (!['stake', 'unstake', 'status'].includes(action)) {
  throw new Error('Usage: node staking-v3.mjs stake|unstake|status');
}

async function loadKey(name, create = false) {
  const path = join(folder, name);
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, 'utf8'))));
  } catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    const keypair = Keypair.generate();
    await writeFile(path, JSON.stringify(Array.from(keypair.secretKey)), { flag: 'wx', mode: 0o600 });
    return keypair;
  }
}
async function readLedger() {
  try { return JSON.parse(await readFile(ledgerPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

const payer = await loadKey('.test-authority.json');
const mint = await loadKey('.v3-mint-keypair.json');
const participant = await loadKey('.v3-recipient-keypair.json');
const vault = await loadKey('.v3-vault-keypair.json', true);
const state = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (state.decimals !== decimals || state.mintAuthority !== null || state.freezeAuthority !== null) {
  throw new Error('Unexpected V3 mint configuration');
}
const treasury = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, payer.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const participantAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, participant.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const vaultAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint.publicKey, vault.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const ledger = await readLedger();

if (action === 'stake') {
  if (ledger) throw new Error('Existing V3 round-trip ledger; refusing a duplicate deposit');
  const vaultBefore = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const participantBefore = await getAccount(connection, participantAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (vaultBefore.amount !== 0n || participantBefore.amount < principal) {
    throw new Error('Vault is nonempty or participant lacks test tokens');
  }
  const signature = await transferChecked(
    connection, payer, participantAta.address, mint.publicKey, vaultAta.address,
    participant, principal, decimals, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  const vaultAfter = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const participantAfter = await getAccount(connection, participantAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (vaultAfter.amount !== principal || participantAfter.amount !== participantBefore.amount - principal) {
    throw new Error('Zero-fee deposit balances did not reconcile');
  }
  const record = {
    network: 'devnet', mint: mint.publicKey.toBase58(), status: 'staked',
    principalBaseUnits: principal.toString(), startingParticipantBaseUnits: participantBefore.amount.toString(),
    startedAt: new Date().toISOString(), depositSignature: signature,
    operatorControlledVault: vault.publicKey.toBase58(),
  };
  await writeFile(ledgerPath, JSON.stringify(record, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({
    network: 'devnet', action, mint: record.mint, signature,
    principal: Number(principal) / Number(unit), tokenTransferFee: 0,
    vaultBalance: Number(vaultAfter.amount) / Number(unit), operatorControlled: true,
  }, null, 2));
} else if (action === 'unstake') {
  if (!ledger || ledger.status !== 'staked' || ledger.mint !== mint.publicKey.toBase58()) {
    throw new Error('No open V3 test round trip');
  }
  const elapsed = BigInt(Math.max(0, Math.floor((Date.now() - Date.parse(ledger.startedAt)) / 1000)));
  if (elapsed < 15n) throw new Error('Wait at least 15 actual seconds before redemption');
  const reward = rewardBaseUnits(principal, aprBasisPoints, elapsed);
  if (reward <= 0n) throw new Error('Test reward rounded to zero; wait longer');
  const vaultBefore = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const treasuryBefore = await getAccount(connection, treasury.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (vaultBefore.amount !== principal || treasuryBefore.amount < reward) {
    throw new Error('Vault principal differs from ledger or test treasury lacks reward');
  }
  const transaction = new Transaction().add(
    createTransferCheckedInstruction(
      vaultAta.address, mint.publicKey, participantAta.address,
      vault.publicKey, principal, decimals, [], TOKEN_2022_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      treasury.address, mint.publicKey, participantAta.address,
      payer.publicKey, reward, decimals, [], TOKEN_2022_PROGRAM_ID,
    ),
  );
  const signature = await sendAndConfirmTransaction(
    connection, transaction, [payer, vault], { commitment: 'confirmed' },
  );
  const record = { ...ledger, status: 'redeemed', elapsedSeconds: elapsed.toString(),
    rewardBaseUnits: reward.toString(), redeemSignature: signature };
  await writeFile(ledgerPath, JSON.stringify(record, null, 2), { mode: 0o600 });
  const participantAfter = await getAccount(connection, participantAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const vaultAfter = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const treasuryAfter = await getAccount(connection, treasury.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const finalMint = await getMint(connection, mint.publicKey, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (vaultAfter.amount !== 0n ||
      participantAfter.amount !== BigInt(ledger.startingParticipantBaseUnits) + reward ||
      treasuryAfter.amount !== treasuryBefore.amount - reward ||
      finalMint.supply !== 10_000_000n * unit) {
    throw new Error('Round-trip accounting did not reconcile');
  }
  console.log(JSON.stringify({
    network: 'devnet', action, mint: record.mint, depositSignature: record.depositSignature,
    redeemSignature: signature, elapsedSeconds: elapsed.toString(),
    principalReturned: Number(principal) / Number(unit),
    rewardFromTestTreasury: Number(reward) / Number(unit), tokenTransferFee: 0,
    participantNetTokenChange: Number(reward) / Number(unit),
    operatorControlled: true, autonomousStakingContract: false, realMoneyValue: false,
  }, null, 2));
} else {
  const vaultAccount = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  console.log(JSON.stringify({
    network: 'devnet', action, mint: mint.publicKey.toBase58(), ledger,
    vaultBalance: Number(vaultAccount.amount) / Number(unit),
    operatorControlled: true, realMoneyValue: false,
  }, null, 2));
}
