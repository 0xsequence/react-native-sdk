import type { FeeOptionSelector } from './types';

function normalizedUnsignedDecimal(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return trimmed.replace(/^0+(?=\d)/, '');
}

function hasEnoughBalance(availableRaw: string, feeValue: string): boolean {
  const available = normalizedUnsignedDecimal(availableRaw);
  const fee = normalizedUnsignedDecimal(feeValue);
  if (available == null || fee == null) {
    return false;
  }
  if (available.length !== fee.length) {
    return available.length > fee.length;
  }
  return available >= fee;
}

const firstAvailable: FeeOptionSelector = (options) =>
  options.find(
    (option) =>
      option.availableRaw != null &&
      hasEnoughBalance(option.availableRaw, option.feeOption.value)
  )?.selection ?? null;

export const FeeOptionSelectors = Object.freeze({ firstAvailable });
