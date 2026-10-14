import test from 'node:test';
import assert from 'node:assert/strict';
import { allocation, grossRedemptionReserveCents, rewardBaseUnits, treasuryBurnScenario } from './economics-v3.mjs';

test('99/1 allocation sums to fixed supply', () => {
  const a = allocation();
  assert.equal(a.treasury, 9_900_000n);
  assert.equal(a.public, 100_000n);
  assert.equal(a.treasury + a.public, 10_000_000n);
});

test('burn from treasury does not change holders or create cash', () => {
  const s = treasuryBurnScenario();
  assert.equal(s.remainingTreasury, 8_900_000n);
  assert.equal(s.remainingPublic, 100_000n);
  assert.equal(s.remainingSupply, 9_000_000n);
  assert.equal(grossRedemptionReserveCents(s.remainingPublic, 100n), 10_000_000n);
});

test('zero-fee short staking keeps principal and adds only treasury-funded reward', () => {
  const principal = 500_000_000n;
  const reward = rewardBaseUnits(principal, 800n, 32n);
  assert.equal(reward, 40n);
  assert.equal(principal + reward - principal, reward);
});

test('rejects impossible burns and negative inputs', () => {
  assert.throws(() => treasuryBurnScenario({ burn: 10_000_000n }));
  assert.throws(() => grossRedemptionReserveCents(-1n, 100n));
});
