function validateDecimals(decimals: number): void {
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error('decimals must be a non-negative safe integer');
  }
}

function parseSign(value: string): { negative: boolean; unsigned: string } {
  if (value.startsWith('-')) {
    return { negative: true, unsigned: value.slice(1) };
  }
  if (value.startsWith('+')) {
    return { negative: false, unsigned: value.slice(1) };
  }
  return { negative: false, unsigned: value };
}

function isDigits(value: string): boolean {
  return /^[0-9]*$/.test(value);
}

function trimLeadingZeros(value: string): string {
  const trimmed = value.replace(/^0+/, '');
  return trimmed.length === 0 ? '0' : trimmed;
}

export function parseUnits(value: string, decimals = 18): string {
  validateDecimals(decimals);

  const trimmedValue = value.trim();
  const sign = parseSign(trimmedValue);
  const unsignedValue = sign.unsigned;
  if (unsignedValue.length === 0) {
    throw new Error(`Invalid decimal number: ${value}`);
  }

  const parts = unsignedValue.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid decimal number: ${value}`);
  }

  const wholePart = parts[0] ?? '';
  const fractionalPart = parts[1] ?? '';
  if (wholePart.length === 0 && fractionalPart.length === 0) {
    throw new Error(`Invalid decimal number: ${value}`);
  }
  if (!isDigits(wholePart) || !isDigits(fractionalPart)) {
    throw new Error(`Invalid decimal number: ${value}`);
  }

  let normalizedFraction = fractionalPart;
  if (normalizedFraction.length > decimals) {
    const extra = normalizedFraction.slice(decimals);
    if (!/^0*$/.test(extra)) {
      throw new Error(
        `Fractional component exceeds ${decimals} decimals: ${value}`
      );
    }
    normalizedFraction = normalizedFraction.slice(0, decimals);
  }

  normalizedFraction = normalizedFraction.padEnd(decimals, '0');
  const rawValue = trimLeadingZeros(`${wholePart}${normalizedFraction}`);
  if (rawValue === '0') {
    return '0';
  }
  return sign.negative ? `-${rawValue}` : rawValue;
}

export function formatUnits(value: string | bigint, decimals = 18): string {
  validateDecimals(decimals);

  const trimmedValue = value.toString().trim();
  const sign = parseSign(trimmedValue);
  const unsignedValue = sign.unsigned;
  if (unsignedValue.length === 0 || !isDigits(unsignedValue)) {
    throw new Error(`Invalid integer value: ${value.toString()}`);
  }

  const normalizedValue = trimLeadingZeros(unsignedValue);
  if (normalizedValue === '0') {
    return '0';
  }

  if (decimals === 0) {
    return sign.negative ? `-${normalizedValue}` : normalizedValue;
  }

  const paddedValue =
    normalizedValue.length <= decimals
      ? `${'0'.repeat(decimals - normalizedValue.length + 1)}${normalizedValue}`
      : normalizedValue;
  const wholePart = paddedValue.slice(0, -decimals);
  const fractionalPart = paddedValue.slice(-decimals).replace(/0+$/, '');
  const formatted =
    fractionalPart.length === 0 ? wholePart : `${wholePart}.${fractionalPart}`;

  return sign.negative ? `-${formatted}` : formatted;
}
