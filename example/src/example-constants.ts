// File: example/src/example-constants.ts
import { Abi, AbiFunction } from 'ox';
import { arbitrumSepolia, optimism } from 'viem/chains';
import { Signers, Utils } from '@0xsequence/dapp-client';

export const ACTIVE_CHAINS = [arbitrumSepolia, optimism];

// Contract Addresses
export const USDC_ADDRESS = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'; // for Op mainnet
export const feeAddress = '0x7e08701cC9194eF4fFD82421dd0d986d1B43D521';
export const EMITTER_CONTRACT_ADDRESS =
  '0xb7bE532959236170064cf099e1a3395aEf228F44'; // Same for all chains in this example

const nftContractAddress = {
  [arbitrumSepolia.id]: '0xD25b37E2fB07f85E9ecA9d40FE3BcF60BA2dc57b',
  [optimism.id]: '0x66748E649ad70514034db85d86DFbBCFCB2E3137',
};

export const getNFTContractAddress = (chainId: number): `0x${string}` => {
  return nftContractAddress[
    chainId as keyof typeof nftContractAddress
  ] as `0x${string}`;
};

// ABIs and Functions
export const EMITTER_ABI = Abi.from([
  'function explicitEmit()',
  'function implicitEmit()',
]);

export const transfer = AbiFunction.from([
  'function transfer(address to, uint256 value)',
]);

export const mint = AbiFunction.from(['function safeMint(address to)']);

// Permissions
export const getPermissionsForNFTMint = (
  chainId: number
): Signers.Session.ExplicitParams => {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24); // 24 hours from now

  if (chainId === optimism.id) {
    return {
      chainId: chainId,
      valueLimit: 0n,
      deadline,
      permissions: [
        // Permission to mint an NFT
        Utils.PermissionBuilder.for(getNFTContractAddress(chainId))
          .forFunction(mint)
          .build(),
        // Permission to use USDC for gas fees, which triggers fee options
        Utils.PermissionBuilder.for(USDC_ADDRESS)
          .forFunction(transfer)
          .withAddressParam('to', feeAddress)
          .build(),
      ],
    };
  } else {
    // For Arbitrum Sepolia
    return {
      chainId: chainId,
      valueLimit: 0n,
      deadline,
      permissions: [
        Utils.PermissionBuilder.for(getNFTContractAddress(chainId))
          .forFunction(mint)
          .build(),
      ],
    };
  }
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
