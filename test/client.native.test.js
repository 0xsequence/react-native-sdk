const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');
const clientModulePath = path.join(rootDir, 'lib/commonjs/client.native.js');
const nativeModulePath = path.join(
  rootDir,
  'lib/commonjs/NativeOmsWalletReactNativeSdk.js'
);
const networksModulePath = path.join(rootDir, 'lib/commonjs/networks.js');
const feeOptionSelectorsModulePath = path.join(
  rootDir,
  'lib/commonjs/feeOptionSelectors.js'
);
const errorsModulePath = path.join(rootDir, 'lib/commonjs/errors.js');
const oidcProvidersModulePath = path.join(
  rootDir,
  'lib/commonjs/oidcProviders.js'
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
      auth: {
        type: 'email',
        email: `${id}@example.com`,
      },
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
        auth: null,
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
      }))
  );
  native.handleOidcRedirectCallback = makeRecorder(
    calls,
    'handleOidcRedirectCallback',
    overrides.handleOidcRedirectCallback ??
      (async () => ({
        type: 'completed',
        result: walletSelectedResult(),
      }))
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
        status: 'pending',
        txnHash: '0xtxn',
        statusResolution: 'resolved',
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
  return new client.OMSWallet(config);
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
  emitSessionExpired(native, 'oms-wallet', staleEvent);

  await action(oms, native);

  const { events } = subscribe(oms);
  assert.deepEqual(events, []);
}

test('creates a native client and routes instance calls with its client id', async () => {
  const { calls, client } = loadClient();
  const oms = createOms(client);

  await oms.wallet.getSession();

  assert.deepEqual(calls.createClient[0], [
    'oms-wallet',
    'test-publishable-key',
  ]);
  assert.deepEqual(calls.getSession[0], ['oms-wallet']);
});

test('exposes supported network metadata aligned with native SDKs', () => {
  const { Networks, findNetworkById, findNetworkByName } = require(
    networksModulePath
  );

  assert.equal(
    Networks.avalanche.explorerUrl,
    'https://subnets.avax.network/c-chain'
  );
  assert.equal(
    Networks.avalancheTestnet.explorerUrl,
    'https://subnets-test.avax.network/c-chain'
  );
  assert.equal(Networks.katana.explorerUrl, 'https://katanascan.com');
  assert.equal(findNetworkById(137), Networks.polygon);
  assert.equal(findNetworkByName(' Polygon '), Networks.polygon);
  assert.equal(Object.isFrozen(Networks.polygon), true);
});

test('selects the first fee option covered by the available balance', async () => {
  const { FeeOptionSelectors } = require(feeOptionSelectorsModulePath);
  const option = (token, feeValue, availableRaw) => ({
    feeOption: {
      token: { symbol: token },
      value: feeValue,
    },
    selection: { token },
    availableRaw,
  });

  const selected = await FeeOptionSelectors.firstAvailable([
    option('POL', '101', '100'),
    option('USDC', '999999999999999999999999', '1000000000000000000000000'),
    option('WETH', '1', '10'),
  ]);

  assert.deepEqual(selected, { token: 'USDC' });
  assert.equal(
    await FeeOptionSelectors.firstAvailable([option('POL', '101', '100')]),
    null
  );
});

test('normalizes native OMS errors into the public error shape', async () => {
  const nativeError = Object.assign(new Error('No active wallet session'), {
    code: 'OMS_SESSION_MISSING',
    userInfo: {
      code: 'OMS_SESSION_MISSING',
      operation: 'wallet.getSession',
      status: null,
      txnId: null,
      retryable: false,
      upstreamError: null,
    },
  });
  const { client } = loadClient({
    getSession: async () => {
      throw nativeError;
    },
  });
  const { OMSWalletError } = require(errorsModulePath);
  const oms = createOms(client);

  await assert.rejects(oms.wallet.getSession(), (error) => {
    assert.equal(error instanceof OMSWalletError, true);
    assert.equal(error.code, 'OMS_SESSION_MISSING');
    assert.equal(error.operation, 'wallet.getSession');
    assert.equal(error.retryable, false);
    assert.equal(error.cause, nativeError);
    return true;
  });
});

test('replaces the single native client without retaining stale subscribers', async () => {
  const { calls, client, native } = loadClient();
  const firstOms = createOms(client);
  const firstEvent = sessionExpiredEvent('first');
  const secondEvent = sessionExpiredEvent('second');

  emitSessionExpired(native, 'oms-wallet', firstEvent);
  const firstSubscriber = subscribe(firstOms);
  assert.deepEqual(firstSubscriber.events, [firstEvent]);

  const secondOms = createOms(client);
  const secondSubscriber = subscribe(secondOms);
  assert.deepEqual(secondSubscriber.events, []);
  await assert.rejects(
    firstOms.wallet.getSession(),
    /This OMSWallet instance has been replaced/
  );

  emitSessionExpired(native, 'oms-wallet', secondEvent);
  assert.deepEqual(firstSubscriber.events, [firstEvent]);
  assert.deepEqual(secondSubscriber.events, [secondEvent]);
  assert.deepEqual(calls.createClient, [
    ['oms-wallet', 'test-publishable-key'],
    ['oms-wallet', 'test-publishable-key'],
  ]);

  firstSubscriber.subscription.remove();
  secondSubscriber.subscription.remove();
});

test('clears cached session expiry when auth or session state is reset', async () => {
  await expectReplayCleared((oms) =>
    oms.wallet.startEmailAuth({ email: 'user@example.com' })
  );
  await expectReplayCleared((oms) =>
    oms.wallet.startOidcRedirectAuth({
      provider: {
        issuer: 'issuer',
        clientId: 'client',
        authorizationUrl: 'url',
        providerRedirectUri: 'example://auth',
      },
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
    assert.equal('id' in result.pendingSelection, false);
    const staleEvent = sessionExpiredEvent(selectionAction);
    emitSessionExpired(native, 'oms-wallet', staleEvent);

    if (selectionAction === 'selectWallet') {
      await result.pendingSelection.selectWallet('wallet-1');
      assert.deepEqual(calls.selectWalletForPendingSelection[0], [
        'oms-wallet',
        'pending-1',
        'wallet-1',
      ]);
    } else {
      await result.pendingSelection.createAndSelectWallet('reference');
      assert.deepEqual(calls.createAndSelectWalletForPendingSelection[0], [
        'oms-wallet',
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
    emitSessionExpired(native, 'oms-wallet', staleEvent);

    assert.deepEqual(
      await oms.wallet.handleOidcRedirectCallback({
        callbackUrl: 'example://auth?code=ignored',
      }),
      { type }
    );

    const { events } = subscribe(oms);
    assert.deepEqual(events, [staleEvent]);
  }
});

test('passes auth session lifetime and login hint parameters to native', async () => {
  const { calls, client } = loadClient();
  const oms = createOms(client);

  await oms.wallet.startEmailAuth({
    email: 'first@example.com',
    sessionLifetimeSeconds: 3600,
  });
  await oms.wallet.startEmailAuth({ email: 'second@example.com' });
  assert.deepEqual(calls.startEmailAuth, [
    ['oms-wallet', 'first@example.com', '3600'],
    ['oms-wallet', 'second@example.com', null],
  ]);

  await oms.wallet.completeEmailAuth({
    code: '123456',
    walletSelection: 'manual',
    walletType: 'ethereum',
  });
  await oms.wallet.completeEmailAuth({ code: '654321' });

  assert.deepEqual(calls.completeEmailAuth[0], [
    'oms-wallet',
    '123456',
    'manual',
    'ethereum',
  ]);
  assert.deepEqual(calls.completeEmailAuth[1], [
    'oms-wallet',
    '654321',
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
    provider: 'google',
    providerLabel: 'Google',
  });
  assert.deepEqual(calls.signInWithOidcIdToken[0], [
    'oms-wallet',
    'id-token',
    'https://issuer.example.com',
    'audience',
    'automatic',
    'ethereum',
    '7200',
    'google',
    'Google',
  ]);

  await oms.wallet.handleOidcRedirectCallback({
    callbackUrl: 'example://auth?code=abc',
    walletSelection: 'manual',
    sessionLifetimeSeconds: 1800,
  });
  await oms.wallet.handleOidcRedirectCallback({
    callbackUrl: 'example://auth?code=def',
  });
  assert.deepEqual(calls.handleOidcRedirectCallback[0], [
    'oms-wallet',
    'example://auth?code=abc',
    'manual',
    '1800',
  ]);
  assert.deepEqual(calls.handleOidcRedirectCallback[1], [
    'oms-wallet',
    'example://auth?code=def',
    null,
    null,
  ]);

  const provider = {
    issuer: 'issuer',
    clientId: 'client',
    authorizationUrl: 'https://auth.example.com',
    providerRedirectUri: 'example://provider/callback',
  };
  await oms.wallet.startOidcRedirectAuth({
    provider,
    walletType: 'ethereum',
    walletSelection: 'manual',
    sessionLifetimeSeconds: 5400,
    authorizeParams: { prompt: 'select_account' },
    loginHint: 'user@example.com',
  });
  const { OmsRelayOidcProviders } = require(oidcProvidersModulePath);
  await oms.wallet.startOidcRedirectAuth({
    provider: OmsRelayOidcProviders.google,
    omsRelayReturnUri: 'example://auth',
  });

  assert.deepEqual(calls.startOidcRedirectAuth[0], [
    'oms-wallet',
    JSON.stringify({ ...provider, type: 'custom' }),
    null,
    'ethereum',
    'manual',
    '5400',
    JSON.stringify({ prompt: 'select_account' }),
    'user@example.com',
  ]);
  assert.deepEqual(calls.startOidcRedirectAuth[1], [
    'oms-wallet',
    JSON.stringify({ type: 'oms-relay', provider: 'google' }),
    'example://auth',
    null,
    null,
    null,
    null,
    null,
  ]);
});

test('serializes indexer balance and transaction history params for native', async () => {
  const { calls, client } = loadClient();
  const oms = createOms(client);
  const { Networks } = require(networksModulePath);

  await oms.indexer.getBalances({
    walletAddress: '0xwallet',
    networks: [Networks.polygon],
    includeMetadata: false,
    page: { page: 1, pageSize: 25 },
  });
  assert.equal(calls.getBalances[0][0], 'oms-wallet');
  assert.deepEqual(JSON.parse(calls.getBalances[0][1]), {
    walletAddress: '0xwallet',
    networks: ['137'],
    includeMetadata: false,
    page: { page: 1, pageSize: 25 },
  });

  await oms.indexer.getTransactionHistory({
    walletAddress: '0xwallet',
    networks: [Networks.polygon],
    transactionHashes: ['0xtxn'],
    metadataOptions: { includeContracts: ['0xcontract'] },
  });
  assert.equal(calls.getTransactionHistory[0][0], 'oms-wallet');
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
        status: 'pending',
        txnHash: '0xtxn',
        statusResolution: 'resolved',
      };
    },
  });
  const oms = createOms(client);
  const { Networks } = require(networksModulePath);

  const result = await oms.wallet.sendTransaction({
    network: Networks.polygon,
    to: '0xrecipient',
    value: '0',
    selectFeeOption: async (feeOptions) => {
      capturedFeeOptions = feeOptions;
      return feeOptions[0].selection;
    },
  });

  assert.deepEqual(result, {
    txnId: 'txn-1',
    status: 'pending',
    txnHash: '0xtxn',
    statusResolution: 'resolved',
  });
  assert.deepEqual(capturedFeeOptions, [feeOption]);
  assert.deepEqual(calls.respondToFeeOptionSelection[0], [
    'fee-request-1',
    'canonical-selection-token',
    null,
  ]);
  assert.deepEqual(calls.sendTransaction[0].slice(0, 8), [
    'oms-wallet',
    '137',
    '0xrecipient',
    '0',
    null,
    null,
    'fee-option-selector-1',
    true,
  ]);
});

test('rejects transaction statuses outside the public contract', async () => {
  const { client } = loadClient({
    sendTransaction: async () => ({
      txnId: 'txn-1',
      status: 'sent',
      txnHash: null,
      statusResolution: 'resolved',
    }),
  });
  const oms = createOms(client);
  const { Networks } = require(networksModulePath);

  await assert.rejects(
    oms.wallet.sendTransaction({
      network: Networks.polygon,
      to: '0xrecipient',
      value: '0',
    }),
    /Unsupported transaction status from native SDK: sent/
  );
});
