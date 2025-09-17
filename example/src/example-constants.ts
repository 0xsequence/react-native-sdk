// File: example/src/example-constants.ts
import { Abi, AbiFunction, Bytes } from 'ox';
import { optimism } from 'viem/chains';
import { Permission } from '@0xsequence/wallet-primitives';
import { Signers, Utils } from '@0xsequence/dapp-client';

export const USDC_ADDRESS = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'; // for Op mainnet
export const feeAddress = '0x7e08701cC9194eF4fFD82421dd0d986d1B43D521';
export const EMITTER_CONTRACT_ADDRESS =
  '0xb7bE532959236170064cf099e1a3395aEf228F44';

export const EMITTER_ABI = Abi.from([
  'function explicitEmit()',
  'function implicitEmit()',
]);

export const transfer = AbiFunction.from([
  'function transfer(address to, uint256 value)',
]);

export const getRestrictivePermissions = (
  chainId: number
): Signers.Session.ExplicitParams => {
  return {
    chainId: chainId,
    valueLimit: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30), // 30 days from now, in seconds
    permissions:
      chainId === optimism.id
        ? [
            Utils.PermissionBuilder.for(USDC_ADDRESS)
              .forFunction(transfer)
              .withAddressParam('to', feeAddress)
              .build(),
            {
              target: EMITTER_CONTRACT_ADDRESS,
              rules: [
                {
                  cumulative: true,
                  operation: Permission.ParameterOperation.EQUAL,
                  value: Bytes.padRight(
                    Bytes.fromHex(AbiFunction.getSelector(EMITTER_ABI[0])),
                    32
                  ),
                  offset: 0n,
                  mask: Permission.MASK.SELECTOR,
                },
              ],
            },
          ]
        : [
            {
              target: EMITTER_CONTRACT_ADDRESS,
              rules: [
                {
                  cumulative: false,
                  operation: Permission.ParameterOperation.EQUAL,
                  value: Bytes.padRight(
                    Bytes.fromHex(AbiFunction.getSelector(EMITTER_ABI[0])),
                    32
                  ),
                  offset: 0n,
                  mask: Permission.MASK.SELECTOR,
                },
              ],
            },
          ],
  };
};

// Simple EIP-712 typed data for signing
export const DEMO_TYPED_DATA = {
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1, // This will be overridden with the dynamic chainId
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  types: {
    // THIS IS THE CRITICAL FIX: The EIP712 standard requires this
    // definition for the domain itself to be validated correctly.
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  message: {
    from: {
      name: 'Cow',
      wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826',
    },
    to: {
      name: 'Bob',
      wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB',
    },
    contents: 'Hello, Bob!',
  },
};
