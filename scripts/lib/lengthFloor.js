/**
 * The one rule for length floors in this repo's validators (owner ruling, 2 Nov 2026): a draft
 * fails only below 75% of its target length; being over a limit never fails.
 */
const FLOOR_RATIO = 0.75;

function minimumLength(target) {
  return Math.ceil(target * FLOOR_RATIO);
}

function isBelowFloor(length, target) {
  return length < minimumLength(target);
}

module.exports = { FLOOR_RATIO, minimumLength, isBelowFloor };
