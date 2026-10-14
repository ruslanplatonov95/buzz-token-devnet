// Devnet-only operator worker. Run `node burn-worker.mjs --once` or `--watch`.
// It automates sweep + burn while running; the chain itself does NOT enforce burn.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  burnChecked, getAccount, getMint, getOrCreateAssociatedTokenAccount,
  getTransferFeeAmount, TOKEN_2022_PROGRAM_ID,
  withdrawWithheldTokensFromAccounts,
} from '@solana/spl-token';

const folder = dirname(fileURLToPath(import.meta.url));
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const mint = new PublicKey('4cEMJy562smMVw58Ue2daziWDMiHMwdcRXzKFduCp4dV');
const mode = process.argv[2] ?? '--once';
if (!['--once', '--watch'].includes(mode)) throw new Error('Use --once or --watch');

async function loadKey(name, create = false) {
  const path = join(folder, name);
  try { return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(await readFile(path, 'utf8')))); }
  catch (error) {
    if (error.code !== 'ENOENT' || !create) throw error;
    const keypair = Keypair.generate();
    await writeFile(path, JSON.stringify(Array.from(keypair.secretKey)), { flag: 'wx', mode: 0o600 });
    return keypair;
  }
}
const payer = await loadKey('.test-authority.json');
const collector = await loadKey('.fee-collector-keypair.json', true);
const recipient = await loadKey('.fee-recipient-keypair.json');
const vault = await loadKey('.stake-vault-keypair.json');
const collectorAta = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, collector.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
// The public Devnet RPC does not index every Token-2022 account by mint.
// This demo tracks the known wallets only; production needs an account indexer.
const trackedOwners = [payer.publicKey, recipient.publicKey, vault.publicKey];

async function burnCollectorBalance() {
  const account = await getAccount(connection, collectorAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (account.amount === 0n) return null;
  const signature = await burnChecked(
    connection, payer, collectorAta.address, mint, collector,
    account.amount, 6, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
  );
  return { amount: account.amount.toString(), signature };
}

async function tick() {
  // Burn a previously collected balance first: safe to rerun after a crash.
  const recoveredBurn = await burnCollectorBalance();
  const sources = [];
  let foundWithheld = 0n;
  for (const owner of trackedOwners) {
    const ata = await getOrCreateAssociatedTokenAccount(
      connection, payer, mint, owner, false,
      'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
    );
    const tokenAccount = await getAccount(connection, ata.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
    const amount = getTransferFeeAmount(tokenAccount)?.withheldAmount ?? 0n;
    if (amount > 0n) { sources.push(ata.address); foundWithheld += amount; }
  }
  const sweepSignatures = [];
  const burnSignatures = [];
  if (recoveredBurn) burnSignatures.push(recoveredBurn);
  for (let i = 0; i < sources.length; i += 8) {
    const batch = sources.slice(i, i + 8);
    const signature = await withdrawWithheldTokensFromAccounts(
      connection, payer, mint, collectorAta.address, payer, [], batch,
      { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
    );
    sweepSignatures.push(signature);
    const burned = await burnCollectorBalance();
    if (burned) burnSignatures.push(burned);
  }
  const finalMint = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const finalCollector = await getAccount(connection, collectorAta.address, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (finalCollector.amount !== 0n) throw new Error('Collector still holds fees; manual check needed');
  return {
    network: 'devnet', mint: mint.toBase58(), collector: collectorAta.address.toBase58(),
    scannedAccounts: trackedOwners.length, feeAccounts: sources.length,
    withheldFoundBaseUnits: foundWithheld.toString(),
    sweepSignatures, burnSignatures,
    supplyBaseUnits: finalMint.supply.toString(),
    chainEnforcedAutomaticBurn: false, operatorMustRunWorker: true,
    scansOnlyKnownWallets: true,
  };
}

if (mode === '--once') {
  console.log(JSON.stringify(await tick(), null, 2));
} else {
  console.log('Watching Devnet every 30 seconds. Stop with Ctrl+C.');
  while (true) {
    try { console.log(JSON.stringify(await tick(), null, 2)); }
    catch (error) { console.error(`Burn worker tick failed: ${error.message}`); }
    await new Promise(resolve => setTimeout(resolve, 30_000));
  }
}
