// Inspectable Devnet-only scenarios. No market price or guaranteed return is computed here.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const supply = 10_000_000n;
export const treasuryShare = 99n;
export const publicShare = 1n;

export function allocation(total = supply) {
  if (total <= 0n || total % 100n !== 0n) throw new Error('Supply must be positive and divisible by 100');
  return { treasury: total * treasuryShare / 100n, public: total * publicShare / 100n };
}

export function treasuryBurnScenario({ total = supply, burn = 1_000_000n } = {}) {
  const before = allocation(total);
  if (burn < 0n || burn > before.treasury) throw new Error('Burn exceeds treasury balance');
  return {
    before, burned: burn, remainingTreasury: before.treasury - burn,
    remainingPublic: before.public, remainingSupply: total - burn,
  };
}

export function grossRedemptionReserveCents(tokensToRedeem, floorCents) {
  if (tokensToRedeem < 0n || floorCents < 0n) throw new Error('Inputs must be nonnegative');
  return tokensToRedeem * floorCents;
}

export function rewardBaseUnits(principalBaseUnits, aprBasisPoints, elapsedSeconds) {
  if (principalBaseUnits < 0n || aprBasisPoints < 0n || elapsedSeconds < 0n) {
    throw new Error('Inputs must be nonnegative');
  }
  return principalBaseUnits * aprBasisPoints * elapsedSeconds / (10_000n * 365n * 24n * 60n * 60n);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const x = treasuryBurnScenario();
  const exampleFloorCents = 100n;
  console.log(JSON.stringify({
    network: 'Devnet scenario only',
    totalSupply: supply.toString(),
    treasuryBefore: x.before.treasury.toString(),
    publicBefore: x.before.public.toString(),
    treasuryBurned: x.burned.toString(),
    treasuryAfter: x.remainingTreasury.toString(),
    publicAfter: x.remainingPublic.toString(),
    hypotheticalDeclaredFloor: 'EUR 1.00',
    grossCashNeededToRedeemAllPublicAtDeclaredFloor: `EUR ${(grossRedemptionReserveCents(x.remainingPublic, exampleFloorCents) / 100n).toString()}`,
    actualCashReserveInThisScenario: 'EUR 0',
    conclusion: 'Burning treasury units does not create a bid or prevent a holder from selling below EUR 1.00.',
    exampleThirtyDayRewardFor500TokensAt8PctAPR: (Number(rewardBaseUnits(500_000_000n, 800n, 30n * 24n * 60n * 60n)) / 1e6).toFixed(6),
    rewardSource: 'Existing test treasury, not external yield',
  }, null, 2));
}
