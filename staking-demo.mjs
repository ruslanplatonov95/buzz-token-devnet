// Operator-controlled Devnet escrow demo, NOT an audited trustless staking contract.
// Rewards are paid from the test treasury, not minted or guaranteed.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import {
  burnChecked, calculateEpochFee, createTransferCheckedWithFeeInstruction,
  getAccount, getMint, getOrCreateAssociatedTokenAccount,
  getTransferFeeAmount, getTransferFeeConfig, TOKEN_2022_PROGRAM_ID,
  transferCheckedWithFee, withdrawWithheldTokensFromAccounts,
} from '@solana/spl-token';

const folder = dirname(fileURLToPath(import.meta.url));
const ledgerPath = join(folder, '.stake-ledger.json');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const mintAddress = '4cEMJy562smMVw58Ue2daziWDMiHMwdcRXzKFduCp4dV';
const decimals = 6;
const unit = 10n ** BigInt(decimals);
const grossStake = 500n * unit;
const annualRateBasisPoints = 800n; // Test scenario only: 8% APR, no promised return.
const secondsPerYear = 365n * 24n * 60n * 60n;
const action = process.argv[2] ?? 'status';
if (!['stake', 'unstake', 'status'].includes(action)) {
  throw new Error('Usage: node staking-demo.mjs stake|unstake|status');
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
const staker = await loadKey('.fee-recipient-keypair.json');
const vault = await loadKey('.stake-vault-keypair.json', true);
const { PublicKey } = await import('@solana/web3.js');
const mint = new PublicKey(mintAddress);
const mintState = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
if (mintState.decimals !== decimals || mintState.mintAuthority !== null) {
  throw new Error('Unexpected mint configuration');
}
const feeConfig = getTransferFeeConfig(mintState);
if (!feeConfig) throw new Error('Expected transfer-fee mint');
const epoch = BigInt((await connection.getEpochInfo('confirmed')).epoch);
const transferFee = (amount) => calculateEpochFee(feeConfig, epoch, amount);
const treasury = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, payer.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const stakerAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, staker.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const vaultAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, vault.publicKey, false, 'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
let ledger = await readLedger();

if (action === 'stake') {
  if (ledger) throw new Error('A demo stake has already been recorded; refusing duplicate deposit');
  const before = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (before.amount !== 0n) throw new Error('Vault is not empty; refusing duplicate deposit');
  const fee = transferFee(grossStake);
  const signature = await transferCheckedWithFee(
    connection, payer, stakerAta.address, mint, vaultAta.address,
    staker, grossStake, decimals, fee, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  const after = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (after.amount !== grossStake - fee) throw new Error('Vault did not receive expected net stake');
  ledger = {
    network: 'devnet', mint: mintAddress, status: 'staked',
    annualRateBasisPoints: Number(annualRateBasisPoints),
    grossStakeBaseUnits: grossStake.toString(), netStakeBaseUnits: after.amount.toString(),
    startedAt: new Date().toISOString(), depositSignature: signature,
    operatorControlledVault: vault.publicKey.toBase58(),
  };
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({
    action, network: 'devnet', mint: mintAddress, depositSignature: signature,
    grossStake: Number(grossStake) / Number(unit), depositFee: Number(fee) / Number(unit),
    vaultPrincipal: Number(after.amount) / Number(unit), vault: vaultAta.address.toBase58(),
    aprAssumption: '8% test-only, time-proportional; no real monetary return',
  }, null, 2));
} else if (action === 'unstake') {
  if (!ledger || ledger.status !== 'staked' || ledger.mint !== mintAddress) {
    throw new Error('No open stake in local test ledger');
  }
  const principal = BigInt(ledger.netStakeBaseUnits);
  const inVault = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (inVault.amount !== principal) throw new Error('Vault balance differs from ledger; stop for manual review');
  const elapsedSeconds = BigInt(Math.max(0, Math.floor((Date.now() - Date.parse(ledger.startedAt)) / 1000)));
  if (elapsedSeconds < 15n) throw new Error('Wait at least 15 real seconds before unstaking');
  const reward = principal * annualRateBasisPoints * elapsedSeconds / (10_000n * secondsPerYear);
  if (reward <= 0n) throw new Error('Time-proportional test reward rounded to zero; wait longer');
  const rewardSource = await getAccount(connection, treasury.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (rewardSource.amount < reward) throw new Error('Test treasury lacks reward funds');
  const principalFee = transferFee(principal);
  const rewardFee = transferFee(reward);
  const transaction = new Transaction().add(
    createTransferCheckedWithFeeInstruction(
      vaultAta.address, mint, stakerAta.address, vault.publicKey,
      principal, decimals, principalFee, [], TOKEN_2022_PROGRAM_ID,
    ),
    createTransferCheckedWithFeeInstruction(
      treasury.address, mint, stakerAta.address, payer.publicKey,
      reward, decimals, rewardFee, [], TOKEN_2022_PROGRAM_ID,
    ),
  );
  const redeemSignature = await sendAndConfirmTransaction(
    connection, transaction, [payer, vault], { commitment: 'confirmed' },
  );
  // The two payout instructions above are atomic. If the local write fails,
  // the empty vault prevents an accidental second payout on a retry.
  ledger = {
    ...ledger, status: 'redeemed', elapsedSeconds: elapsedSeconds.toString(),
    rewardBaseUnits: reward.toString(), principalFeeBaseUnits: principalFee.toString(),
    rewardFeeBaseUnits: rewardFee.toString(), redeemSignature,
  };
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2), { mode: 0o600 });

  const recipients = [stakerAta.address, vaultAta.address];
  let feeToBurn = 0n;
  const feeAccounts = [];
  for (const address of recipients) {
    const account = await getAccount(connection, address, 'confirmed', TOKEN_2022_PROGRAM_ID);
    const amount = getTransferFeeAmount(account)?.withheldAmount ?? 0n;
    if (amount > 0n) { feeToBurn += amount; feeAccounts.push(address); }
  }
  let feeCollectionSignature = null;
  let feeBurnSignature = null;
  if (feeToBurn > 0n) {
    feeCollectionSignature = await withdrawWithheldTokensFromAccounts(
      connection, payer, mint, treasury.address, payer, [], feeAccounts,
      { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
    );
    feeBurnSignature = await burnChecked(
      connection, payer, treasury.address, mint, payer, feeToBurn, decimals,
      [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
    );
  }
  const finalVault = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const finalMint = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (finalVault.amount !== 0n) throw new Error('Vault still contains principal');
  console.log(JSON.stringify({
    action, network: 'devnet', mint: mintAddress,
    depositSignature: ledger.depositSignature, redeemSignature,
    elapsedSeconds: elapsedSeconds.toString(),
    annualRateAssumption: '8% test-only; not guaranteed',
    principalReturnedGross: Number(principal) / Number(unit),
    rewardGross: Number(reward) / Number(unit),
    payoutFees: Number(principalFee + rewardFee) / Number(unit),
    additionalWithheldFeesBurned: Number(feeToBurn) / Number(unit),
    feeCollectionSignature, feeBurnSignature,
    finalSupply: Number(finalMint.supply) / Number(unit),
    operatorControlled: true, realMoneyValue: false,
  }, null, 2));
} else {
  const vaultAccount = await getAccount(connection, vaultAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  console.log(JSON.stringify({
    action, network: 'devnet', mint: mintAddress, ledger,
    vaultPrincipal: Number(vaultAccount.amount) / Number(unit),
    operatorControlled: true, realMoneyValue: false,
  }, null, 2));
}
