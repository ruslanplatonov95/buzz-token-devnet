// Creates a fresh Devnet transfer fee for testing burn-worker.mjs.
// Each invocation transfers another 100 test BUZZT2; it is not idempotent.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  calculateEpochFee, getMint, getOrCreateAssociatedTokenAccount,
  getTransferFeeConfig, TOKEN_2022_PROGRAM_ID, transferCheckedWithFee,
} from '@solana/spl-token';

const folder = dirname(fileURLToPath(import.meta.url));
const key = async name => Keypair.fromSecretKey(Uint8Array.from(JSON.parse(
  await readFile(join(folder, name), 'utf8'),
)));
const payer = await key('.test-authority.json');
const recipient = await key('.fee-recipient-keypair.json');
const mint = new PublicKey('4cEMJy562smMVw58Ue2daziWDMiHMwdcRXzKFduCp4dV');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const from = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, recipient.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const to = await getOrCreateAssociatedTokenAccount(
  connection, payer, mint, payer.publicKey, false,
  'confirmed', undefined, TOKEN_2022_PROGRAM_ID,
);
const amount = 100n * 1_000_000n;
const config = getTransferFeeConfig(await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID));
if (!config) throw new Error('Fee config missing');
const epoch = BigInt((await connection.getEpochInfo('confirmed')).epoch);
const fee = calculateEpochFee(config, epoch, amount);
const signature = await transferCheckedWithFee(
  connection, payer, from.address, mint, to.address, recipient,
  amount, 6, fee, [], { commitment: 'confirmed' }, TOKEN_2022_PROGRAM_ID,
);
console.log(JSON.stringify({
  network: 'devnet', mint: mint.toBase58(), signature,
  transfer: Number(amount) / 1e6, withheldFee: Number(fee) / 1e6,
}, null, 2));
