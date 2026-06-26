const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');
const clientModulePath = path.join(rootDir, 'lib/commonjs/client.native.js');
const nativeModulePath = path.join(
  rootDir,
  'lib/commonjs/NativeOmsClientReactNativeSdk.js'
);

const config = {
  publishableKey: 'test-publishable-key',
};

function wallet(id = 'wallet-1') {
  return {
    id,
    type: 'ethereum',
    address: `0x${id.replace(/\D/g, '').padStart(40, '0')}`,
    reference: null,
  };
}

function credential(id = 'credential-1') {
  return {
    credentialId: id,
    expiresAt: '2026-06-17T00:00:00.000Z',
    isCaller: true,
  };
}

function walletSelectedResult() {
  const selectedWallet = wallet();
  return {
    type: 'walletSelected',
    walletAddress: selectedWallet.address,
    wallet: selectedWallet,
    wallets: [selectedWallet],
    credential: credential(),
  };
}

function pendingWalletSelectionResult(id = 'pending-1') {
  const pendingWallet = wallet();
  return {
    type: 'walletSelection',
    walletAddress: null,
    wallet: null,
    wallets: [pendingWallet],
    credential: credential(),
    pendingSelection: {
      id,
      walletType: 'ethereum',
      wallets: [pendingWallet],
      credential: credential(),
    },
  };
}

function walletActivationResult(id = 'wallet-2') {
  const activatedWallet = wallet(id);
  return {
    walletAddress: activatedWallet.address,
    wallet: activatedWallet,
  };
}

function sessionExpiredEvent(id = 'expired') {
  return {
    session: {
      walletAddress: `0x${id.replace(/\D/g, '').padStart(40, '1')}`,
      expiresAt: '2026-06-10T00:00:00.000Z',
      loginType: 'Email',
      sessionEmail: `${id}@example.com`,
    },
    expiredAt: '2026-06-10T00:00:00.000Z',
  };
}

function makeRecorder(calls, name, implementation) {
  calls[name] = [];
  return (...args) => {
    calls[name].push(args);
    return implementation(...args);
  };
}

function loadClient(overrides = {}) {
  const clientModuleId = require.resolve(clientModulePath);
  const nativeModuleId = require.resolve(nativeModulePath);
  delete require.cache[clientModuleId];
  delete require.cache[nativeModuleId];

  const calls = {};
  const native = {};
  native.onSessionExpired = makeRecorder(
    calls,
    'onSessionExpired',
    (listener) => {
      native.sessionExpiredListener = listener;
      return {
        remove() {
          native.sessionExpiredListener = null;
        },
      };
    }
  );
  native.onFeeOptionSelectionRequest = makeRecorder(
    calls,
    'onFeeOptionSelectionRequest',
    (listener) => {
      native.feeOptionSelectionListener = listener;
      return {
        remove() {
          native.feeOptionSelectionListener = null;
        },
      };
    }
  );
  native.createClient = makeRecorder(
    calls,
    'createClient',
    overrides.createClient ?? (async () => undefined)
  );
  native.getSession = makeRecorder(
    calls,
    'getSession',
    overrides.getSession ??
      (async () => ({
        walletAddress: null,
        expiresAt: null,
        loginType: null,
        sessionEmail: null,
      }))
  );
  native.startEmailAuth = makeRecorder(
    calls,
    'startEmailAuth',
    overrides.startEmailAuth ?? (async () => undefined)
  );
  native.completeEmailAuth = makeRecorder(
    calls,
    'completeEmailAuth',
    overrides.completeEmailAuth ?? (async () => walletSelectedResult())
  );
  native.signInWithOidcIdToken = makeRecorder(
    calls,
    'signInWithOidcIdToken',
    overrides.signInWithOidcIdToken ?? (async () => walletSelectedResult())
  );
  native.startOidcRedirectAuth = makeRecorder(
    calls,
    'startOidcRedirectAuth',
    overrides.startOidcRedirectAuth ??
      (async () => ({
        authorizationUrl: 'https://auth.example.com',
        state: 'state',
        challenge: 'challenge',
      }))
  );
  native.handleOidcRedirectCallback = makeRecorder(
    calls,
    'handleOidcRedirectCallback',
    overrides.handleOidcRedirectCallback ??
      (async () => ({ type: 'completed', wallet: wallet() }))
  );
  native.useWallet = makeRecorder(
    calls,
    'useWallet',
    overrides.useWallet ?? (async () => walletActivationResult())
  );
  native.createWallet = makeRecorder(
    calls,
    'createWallet',
    overrides.createWallet ?? (async () => walletActivationResult())
  );
  native.selectWalletForPendingSelection = makeRecorder(
    calls,
    'selectWalletForPendingSelection',
    overrides.selectWalletForPendingSelection ??
      (async () => walletActivationResult())
  );
  native.createAndSelectWalletForPendingSelection = makeRecorder(
    calls,
    'createAndSelectWalletForPendingSelection',
    overrides.createAndSelectWalletForPendingSelection ??
      (async () => walletActivationResult())
  );
  native.signOut = makeRecorder(
    calls,
    'signOut',
    overrides.signOut ?? (async () => undefined)
  );
  native.sendTransaction = makeRecorder(
    calls,
    'sendTransaction',
    overrides.sendTransaction ??
      (async () => ({
        txnId: 'txn-1',
        status: 'sent',
        txnHash: '0xtxn',
      }))
  );
  native.getBalances = makeRecorder(
    calls,
    'getBalances',
    overrides.getBalances ??
      (async () => ({
        status: 200,
        page: null,
        nativeBalances: [],
        balances: [],
      }))
  );
  native.getTransactionHistory = makeRecorder(
    calls,
    'getTransactionHistory',
    overrides.getTransactionHistory ??
      (async () => ({ status: 200, page: null, transactions: [] }))
  );
  native.respondToFeeOptionSelection = makeRecorder(
    calls,
    'respondToFeeOptionSelection',
    overrides.respondToFeeOptionSelection ?? (async () => undefined)
  );

  require.cache[nativeModuleId] = {
    id: nativeModuleId,
    filename: nativeModuleId,
    loaded: true,
    exports: {
      __esModule: true,
      default: native,
    },
  };

  return {
    calls,
    client: require(clientModuleId),
    native,
  };
}

function createOms(client) {
  return new client.OMSClient(config);
}

function emitSessionExpired(native, clientId, event) {
  assert.equal(typeof native.sessionExpiredListener, 'function');
  native.sessionExpiredListener({ clientId, ...event });
}

function subscribe(oms) {
  const events = [];
  const subscription = oms.wallet.onSessionExpired((event) => {
    events.push(event);
  });
  return { events, subscription };
}

async function expectReplayCleared(action) {
  const { client, native } = loadClient();
  const oms = createOms(client);
  const staleEvent = sessionExpiredEvent('stale');
  emitSessionExpired(native, 'oms-client-1', staleEvent);

  await action(oms, native);

  const { events } = subscribe(oms);
  assert.deepEqual(events, []);
}

test('creates a native client and routes instance calls with its client id', async () => {
  const { calls, client } = loadClient();
  const oms = createOms(client);

  await oms.wallet.getSession();

  assert.deepEqual(calls.createClient[0], [
    'oms-client-1',
    'test-publishable-key',
  ]);
  assert.deepEqual(calls.getSession[0], ['oms-client-1']);
  assert.equal(
    oms.supportedNetworks.some((network) => network.chainId === '137'),
    true
  );
});

test('exposes supported network metadata aligned with native SDKs', () => {
  const { client } = loadClient();
  const oms = createOms(client);

  assert.equal(
    oms.supportedNetworks.find((network) => network.chainId === '43114')
      ?.explorerUrl,
    'https://subnets.avax.network/c-chain'
  );
  assert.equal(
    oms.supportedNetworks.find((network) => network.chainId === '43113')
      ?.explorerUrl,
    'https://subnets-test.avax.network/c-chain'
  );
  assert.equal(
    oms.supportedNetworks.find((network) => network.chainId === '747474')
      ?.explorerUrl,
    'https://katanascan.com'
  );
});

test('replays native session expiry only to matching client subscribers', () => {
  const { client, native } = loadClient();
  const firstOms = createOms(client);
  const secondOms = createOms(client);
  const firstEvent = sessionExpiredEvent('first');
  const secondEvent = sessionExpiredEvent('second');
  const thirdEvent = sessionExpiredEvent('third');

  emitSessionExpired(native, 'oms-client-1', firstEvent);

  const firstSubscriber = subscribe(firstOms);
  const secondSubscriber = subscribe(secondOms);
  assert.deepEqual(firstSubscriber.events, [firstEvent]);
  assert.deepEqual(secondSubscriber.events, []);

  emitSessionExpired(native, 'oms-client-1', secondEvent);
  assert.deepEqual(firstSubscriber.events, [firstEvent, secondEvent]);
  assert.deepEqual(secondSubscriber.events, []);

  emitSessionExpired(native, 'oms-client-2', thirdEvent);
  assert.deepEqual(secondSubscriber.events, [thirdEvent]);

  firstSubscriber.subscription.remove();
  emitSessionExpired(native, 'oms-client-1', thirdEvent);
  assert.deepEqual(firstSubscriber.events, [firstEvent, secondEvent]);
});

test('clears cached session expiry when auth or session state is reset', async () => {
  await expectReplayCleared((oms) =>
    oms.wallet.startEmailAuth('user@example.com')
  );
  await expectReplayCleared((oms) =>
    oms.wallet.startOidcRedirectAuth({
      provider: {
        issuer: 'issuer',
        clientId: 'client',
        authorizationUrl: 'url',
      },
      redirectUri: 'example://auth',
    })
  );
  await expectReplayCleared((oms) =>
    oms.wallet.signInWithOidcIdToken({
      idToken: 'id-token',
      issuer: 'https://issuer.example.com',
      audience: 'audience',
    })
  );
  await expectReplayCleared((oms) =>
    oms.wallet.completeEmailAuth({ code: '123456' })
  );
  await expectReplayCleared((oms) =>
    oms.wallet.handleOidcRedirectCallback({
      callbackUrl: 'example://auth?code=abc',
    })
  );
  await expectReplayCleared((oms) => oms.wallet.useWallet('wallet-1'));
  await expectReplayCleared((oms) => oms.wallet.createWallet());
  await expectReplayCleared((oms) => oms.wallet.signOut());
});

test('routes pending wallet selection activation with the owning client id', async () => {
  for (const selectionAction of ['selectWallet', 'createAndSelectWallet']) {
    const { calls, client, native } = loadClient({
      completeEmailAuth: async () => pendingWalletSelectionResult(),
    });
    const oms = createOms(client);

    const result = await oms.wallet.completeEmailAuth({
      code: '123456',
      walletSelection: 'manual',
    });
    const staleEvent = sessionExpiredEvent(selectionAction);
    emitSessionExpired(native, 'oms-client-1', staleEvent);

    if (selectionAction === 'selectWallet') {
      await result.pendingSelection.selectWallet('wallet-1');
      assert.deepEqual(calls.selectWalletForPendingSelection[0], [
        'oms-client-1',
        'pending-1',
        'wallet-1',
      ]);
    } else {
      await result.pendingSelection.createAndSelectWallet('reference');
      assert.deepEqual(calls.createAndSelectWalletForPendingSelection[0], [
        'oms-client-1',
        'pending-1',
        'reference',
      ]);
    }

    const { events } = subscribe(oms);
    assert.deepEqual(events, []);
  }
});

test('does not clear cached session expiry for ignored OIDC redirect callbacks', async () => {
  for (const type of ['notOidcRedirectCallback', 'noPendingAuth']) {
    const { client, native } = loadClient({
      handleOidcRedirectCallback: async () => ({ type }),
    });
    const oms = createOms(client);
    const staleEvent = sessionExpiredEvent(type);
    emitSessionExpired(native, 'oms-client-1', staleEvent);

    assert.deepEqual(await oms.wallet.handleOidcRedirectCallback(), { type });

    const { events } = subscribe(oms);
    assert.deepEqual(events, [staleEvent]);
  }
});

test('passes auth session lifetime and login hint parameters to native', async () => {
  const { calls, client } = loadClient();
  const oms = createOms(client);

  await oms.wallet.completeEmailAuth({
    code: '123456',
    walletSelection: 'manual',
    walletType: 'ethereum',
    sessionLifetimeSeconds: 3600,
  });
  await oms.wallet.completeEmailAuth({ code: '654321' });

  assert.deepEqual(calls.completeEmailAuth[0], [
    'oms-client-1',
    '123456',
    'manual',
    'ethereum',
    '3600',
  ]);
  assert.deepEqual(calls.completeEmailAuth[1], [
    'oms-client-1',
    '654321',
    null,
    null,
    null,
  ]);

  await oms.wallet.signInWithOidcIdToken({
    idToken: 'id-token',
    issuer: 'https://issuer.example.com',
    audience: 'audience',
    walletSelection: 'automatic',
    walletType: 'ethereum',
    sessionLifetimeSeconds: 7200,
  });
  assert.deepEqual(calls.signInWithOidcIdToken[0], [
    'oms-client-1',
    'id-token',
    'https://issuer.example.com',
    'audience',
    'automatic',
    'ethereum',
    '7200',
  ]);

  await oms.wallet.handleOidcRedirectCallback({
    callbackUrl: 'example://auth?code=abc',
    walletSelection: 'manual',
    sessionLifetimeSeconds: 1800,
  });
  await oms.wallet.handleOidcRedirectCallback();
  assert.deepEqual(calls.handleOidcRedirectCallback[0], [
    'oms-client-1',
    'example://auth?code=abc',
    'manual',
    '1800',
  ]);
  assert.deepEqual(calls.handleOidcRedirectCallback[1], [
    'oms-client-1',
    null,
    null,
    null,
  ]);

  const provider = {
    issuer: 'issuer',
    clientId: 'client',
    authorizationUrl: 'https://auth.example.com',
    relayRedirectUri: 'https://relay.example.com/callback',
  };
  await oms.wallet.startOidcRedirectAuth({
    provider,
    redirectUri: 'example://auth',
    walletType: 'ethereum',
    authorizeParams: { prompt: 'select_account' },
    loginHint: 'user@example.com',
  });
  await oms.wallet.startOidcRedirectAuth({
    provider,
    redirectUri: 'example://auth',
    relayRedirectUri: null,
  });

  assert.deepEqual(calls.startOidcRedirectAuth[0], [
    'oms-client-1',
    JSON.stringify(provider),
    'example://auth',
    'ethereum',
    'https://relay.example.com/callback',
    JSON.stringify({ prompt: 'select_account' }),
    'user@example.com',
  ]);
  assert.deepEqual(calls.startOidcRedirectAuth[1], [
    'oms-client-1',
    JSON.stringify(provider),
    'example://auth',
    null,
    null,
    null,
    null,
  ]);
});

test('serializes indexer balance and transaction history params for native', async () => {
  const { calls, client } = loadClient();
  const oms = createOms(client);
  const polygon = oms.supportedNetworks.find(
    (network) => network.chainId === '137'
  );

  await oms.indexer.getBalances({
    walletAddress: '0xwallet',
    networks: [polygon],
    includeMetadata: false,
    page: { page: 1, pageSize: 25 },
  });
  assert.equal(calls.getBalances[0][0], 'oms-client-1');
  assert.deepEqual(JSON.parse(calls.getBalances[0][1]), {
    walletAddress: '0xwallet',
    networks: ['137'],
    includeMetadata: false,
    page: { page: 1, pageSize: 25 },
  });

  await oms.indexer.getTransactionHistory({
    walletAddress: '0xwallet',
    networks: [polygon],
    transactionHashes: ['0xtxn'],
    metadataOptions: { includeContracts: ['0xcontract'] },
  });
  assert.equal(calls.getTransactionHistory[0][0], 'oms-client-1');
  assert.deepEqual(JSON.parse(calls.getTransactionHistory[0][1]), {
    walletAddress: '0xwallet',
    networks: ['137'],
    transactionHashes: ['0xtxn'],
    metadataOptions: { includeContracts: ['0xcontract'] },
  });
});

test('round-trips fee option selection token from native request', async () => {
  let capturedFeeOptions;
  const feeOption = {
    feeOption: {
      token: {
        network: '137',
        name: 'Polygon',
        symbol: 'POL',
        type: 'native',
        decimals: 18,
        logoUrl: null,
        contractAddress: null,
        tokenId: 'fee-token-id',
      },
      value: '100',
      displayValue: '0.0000000000000001',
    },
    selection: { token: 'canonical-selection-token' },
    balance: null,
    available: '1',
    availableRaw: '1000000000000000000',
    decimals: 18,
  };
  const { calls, client, native } = loadClient({
    sendTransaction: async (
      _clientId,
      _chainId,
      _to,
      _value,
      _data,
      _mode,
      feeOptionSelectorId
    ) => {
      assert.equal(feeOptionSelectorId, 'fee-option-selector-1');
      assert.equal(typeof native.feeOptionSelectionListener, 'function');
      await native.feeOptionSelectionListener({
        selectorId: feeOptionSelectorId,
        requestId: 'fee-request-1',
        options: [feeOption],
      });
      return {
        txnId: 'txn-1',
        status: 'sent',
        txnHash: '0xtxn',
      };
    },
  });
  const oms = createOms(client);

  const result = await oms.wallet.sendTransaction({
    chainId: '137',
    to: '0xrecipient',
    value: '0',
    selectFeeOption: async (feeOptions) => {
      capturedFeeOptions = feeOptions;
      return feeOptions[0].selection;
    },
  });

  assert.deepEqual(result, {
    txnId: 'txn-1',
    status: 'sent',
    txnHash: '0xtxn',
  });
  assert.deepEqual(capturedFeeOptions, [feeOption]);
  assert.deepEqual(calls.respondToFeeOptionSelection[0], [
    'fee-request-1',
    'canonical-selection-token',
    null,
  ]);
  assert.deepEqual(calls.sendTransaction[0].slice(0, 8), [
    'oms-client-1',
    '137',
    '0xrecipient',
    '0',
    null,
    null,
    'fee-option-selector-1',
    true,
  ]);
});
