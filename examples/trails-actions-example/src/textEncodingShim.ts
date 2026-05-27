/* eslint-disable no-bitwise */

type EncodeResult = {
  read: number;
  written: number;
};

function getCodePoint(input: string, index: number) {
  const first = input.charCodeAt(index);

  if (first >= 0xd800 && first <= 0xdbff && index + 1 < input.length) {
    const second = input.charCodeAt(index + 1);
    if (second >= 0xdc00 && second <= 0xdfff) {
      return {
        codePoint: ((first - 0xd800) << 10) + (second - 0xdc00) + 0x10000,
        read: 2,
      };
    }
  }

  if (first >= 0xd800 && first <= 0xdfff) {
    return { codePoint: 0xfffd, read: 1 };
  }

  return { codePoint: first, read: 1 };
}

function encodeCodePoint(codePoint: number): number[] {
  if (codePoint <= 0x7f) {
    return [codePoint];
  }

  if (codePoint <= 0x7ff) {
    return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)];
  }

  if (codePoint <= 0xffff) {
    return [
      0xe0 | (codePoint >> 12),
      0x80 | ((codePoint >> 6) & 0x3f),
      0x80 | (codePoint & 0x3f),
    ];
  }

  return [
    0xf0 | (codePoint >> 18),
    0x80 | ((codePoint >> 12) & 0x3f),
    0x80 | ((codePoint >> 6) & 0x3f),
    0x80 | (codePoint & 0x3f),
  ];
}

function encodeUtf8(input: string): Uint8Array {
  const bytes: number[] = [];

  for (let index = 0; index < input.length; ) {
    const next = getCodePoint(input, index);
    bytes.push(...encodeCodePoint(next.codePoint));
    index += next.read;
  }

  return new Uint8Array(bytes);
}

function toUint8Array(input: unknown): Uint8Array {
  if (input == null) {
    return new Uint8Array();
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  throw new TypeError('TextDecoder.decode input must be an ArrayBuffer view.');
}

function isContinuationByte(byte: number | undefined): byte is number {
  return byte !== undefined && (byte & 0xc0) === 0x80;
}

function decodeUtf8(input: Uint8Array): string {
  let output = '';

  for (let index = 0; index < input.length; ) {
    const first = input[index];

    if (first === undefined) {
      break;
    }

    if (first <= 0x7f) {
      output += String.fromCharCode(first);
      index += 1;
      continue;
    }

    const second = input[index + 1];
    const third = input[index + 2];
    const fourth = input[index + 3];

    if (first >= 0xc2 && first <= 0xdf && isContinuationByte(second)) {
      output += String.fromCharCode(((first & 0x1f) << 6) | (second & 0x3f));
      index += 2;
      continue;
    }

    if (
      first >= 0xe0 &&
      first <= 0xef &&
      isContinuationByte(second) &&
      isContinuationByte(third)
    ) {
      const codePoint =
        ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      output += String.fromCharCode(codePoint);
      index += 3;
      continue;
    }

    if (
      first >= 0xf0 &&
      first <= 0xf4 &&
      isContinuationByte(second) &&
      isContinuationByte(third) &&
      isContinuationByte(fourth)
    ) {
      const codePoint =
        ((first & 0x07) << 18) |
        ((second & 0x3f) << 12) |
        ((third & 0x3f) << 6) |
        (fourth & 0x3f);
      const adjusted = codePoint - 0x10000;
      output += String.fromCharCode(
        0xd800 + (adjusted >> 10),
        0xdc00 + (adjusted & 0x3ff)
      );
      index += 4;
      continue;
    }

    output += '\ufffd';
    index += 1;
  }

  return output;
}

class DemoTextEncoder {
  readonly encoding = 'utf-8';

  encode(input = ''): Uint8Array {
    return encodeUtf8(String(input));
  }

  encodeInto(input: string, destination: Uint8Array): EncodeResult {
    let read = 0;
    let written = 0;

    for (let index = 0; index < input.length; ) {
      const next = getCodePoint(input, index);
      const bytes = encodeCodePoint(next.codePoint);

      if (written + bytes.length > destination.length) {
        break;
      }

      destination.set(bytes, written);
      written += bytes.length;
      read += next.read;
      index += next.read;
    }

    return { read, written };
  }
}

class DemoTextDecoder {
  readonly encoding = 'utf-8';
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;

  constructor(
    label = 'utf-8',
    options: { fatal?: boolean; ignoreBOM?: boolean } = {}
  ) {
    const normalizedLabel = label.toLowerCase();
    if (normalizedLabel !== 'utf-8' && normalizedLabel !== 'utf8') {
      throw new RangeError('Only utf-8 TextDecoder is supported.');
    }

    this.fatal = options.fatal ?? false;
    this.ignoreBOM = options.ignoreBOM ?? false;
  }

  decode(input?: unknown): string {
    return decodeUtf8(toUint8Array(input));
  }
}

const globalScope = globalThis as Record<string, unknown>;

if (typeof globalScope.TextEncoder === 'undefined') {
  globalScope.TextEncoder = DemoTextEncoder;
}

if (typeof globalScope.TextDecoder === 'undefined') {
  globalScope.TextDecoder = DemoTextDecoder;
}

export {};
