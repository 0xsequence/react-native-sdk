import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ViewStyle } from 'react-native';
import {
  Clipboard,
  Keyboard,
  KeyboardAvoidingView,
  LogBox,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { TrailsApi } from '@0xtrails/api';
import {
  custom,
  deposit,
  dynamic,
  encodeDestinationCalls,
  getEarnBalances,
  getEarnMarkets,
  lend,
  resolveActionsToCalls,
  swap,
  type ActionItem,
  type EarnBalance,
  type EarnBalances,
  type EarnMarket,
} from '0xtrails/actions';
import {
  completeEmailAuth,
  configure,
  getSession,
  getSupportedNetworks,
  getTokenBalances,
  sendTransaction,
  signOut,
  startEmailAuth,
  type OmsClientSessionState,
  type OmsNetwork,
  type OmsSendTransactionResponse,
} from 'oms-client-react-native-sdk';
import {
  encodeFunctionData,
  formatUnits,
  parseEther,
  parseUnits,
  type Hex,
} from 'viem';

type ButtonVariant = 'primary' | 'outline';

type PreparedTrailsTransaction = {
  title: string;
  to: `0x${string}`;
  data: Hex;
  value: string;
  callCount: number;
  marketName?: string;
  marketId?: string;
};

type PreparedYieldTransactions = {
  title: string;
  transactions: ParsedYieldTransaction[];
  marketName?: string;
  marketId?: string;
};

type ParsedYieldTransaction = {
  to: `0x${string}`;
  data: Hex;
  value: bigint;
  chainId: number;
};

type EarnPosition = {
  id: string;
  marketId: string;
  marketName: string;
  provider: string;
  amount: string;
  amountDisplay: string;
  amountRaw: string;
  amountUsd: string | null;
  apy: string;
  tokenSymbol: string;
  canWithdraw: boolean;
  balance: EarnBalance;
  market?: EarnMarket;
};

type BalanceState = {
  pol: string;
  usdc: string;
  polRaw: string;
  usdcRaw: string;
  status: string;
};

type BalanceOperation = 'swap' | 'earn' | 'depositEarn';

type DemoButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
};

const DEMO_PROJECT_ACCESS_KEY = 'AQAAAAAAAAK2JvvZhWqZ51riasWBftkrVXE';
const DEMO_PROJECT_ID = 'proj_014kg56dc0a75';
const DEMO_ENVIRONMENT = {
  apiRpcUrl: 'https://dev-api.sequence.app/rpc/API',
  indexerUrlTemplate: 'https://dev-{value}-indexer.sequence.app/rpc/Indexer/',
};

const TRAILS_API_URL = 'https://trails-api.sequence.app';
const POLYGON_CHAIN_ID = '137';
const POLYGON_CHAIN_ID_NUMBER = 137;
const POLYGON_INDEXER_NAME = 'polygon';
const POLYGON_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const POLYGON_WPOL = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
const PREFERRED_NETWORK_ORDER = ['137'];
const BALANCE_POLL_INTERVAL_MS = 500;
const TRANSACTION_POLL_TIMEOUT_MS = 120_000;
const TRANSACTION_POLL_MAX_ATTEMPTS = Math.ceil(
  TRANSACTION_POLL_TIMEOUT_MS / BALANCE_POLL_INTERVAL_MS
);
const WRAPPED_NATIVE_DEPOSIT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
] as const;
const WRAPPED_NATIVE_DEPOSIT_CALLDATA = encodeFunctionData({
  abi: WRAPPED_NATIVE_DEPOSIT_ABI,
  functionName: 'deposit',
});
const DEFAULT_SWAP_POL_AMOUNT = '0.5';
const DEFAULT_DEPOSIT_USDC_AMOUNT = '0.1';
const DEFAULT_EARN_POL_AMOUNT = '1';
const SIGNED_OUT_BALANCES: BalanceState = {
  pol: '-',
  usdc: '-',
  polRaw: '0',
  usdcRaw: '0',
  status: 'Sign in to load balances.',
};
const SIGNED_OUT_SESSION: OmsClientSessionState = {
  walletAddress: null,
  expiresAt: null,
  loginType: null,
  sessionEmail: null,
};

LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

function DemoButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}: DemoButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'outline' ? styles.buttonOutline : styles.buttonPrimary,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === 'outline'
            ? styles.buttonOutlineLabel
            : styles.buttonPrimaryLabel,
          disabled && styles.buttonDisabledLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholderTextColor="#64748B"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SessionDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sessionDetailRow}>
      <Text style={styles.sessionDetailLabel}>{label}</Text>
      <Text selectable style={styles.sessionDetailValue}>
        {value}
      </Text>
    </View>
  );
}

function CopyIcon() {
  return (
    <View style={styles.copyIcon}>
      <View style={styles.copyIconBack} />
      <View style={styles.copyIconFront} />
    </View>
  );
}

function WalletAddressDetail({
  address,
  onCopy,
}: {
  address: string;
  onCopy: () => void;
}) {
  return (
    <View style={styles.sessionDetailRow}>
      <Text style={styles.sessionDetailLabel}>Wallet</Text>
      <View style={styles.walletAddressValue}>
        <Text selectable style={styles.sessionDetailValue}>
          {address}
        </Text>
        <Pressable
          accessibilityLabel="Copy wallet address"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onCopy}
          style={({ pressed }) => [
            styles.copyButton,
            pressed && styles.copyButtonPressed,
          ]}
        >
          <CopyIcon />
        </Pressable>
      </View>
    </View>
  );
}

function BalanceSummary({ balances }: { balances: BalanceState }) {
  return (
    <View style={styles.balanceSummary}>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Available POL</Text>
        <Text selectable style={styles.balanceValue}>
          {balances.pol}
        </Text>
      </View>
      <View style={styles.balanceRow}>
        <Text style={styles.balanceLabel}>Available USDC</Text>
        <Text selectable style={styles.balanceValue}>
          {balances.usdc}
        </Text>
      </View>
    </View>
  );
}

function PreparedSummary({
  prepared,
}: {
  prepared: PreparedTrailsTransaction | null;
}) {
  if (!prepared) return null;

  return (
    <View style={styles.preparedSection}>
      <SessionDetail
        label="Destination calls"
        value={`${prepared.callCount}`}
      />
      <SessionDetail label="To" value={prepared.to} />
      <SessionDetail
        label="Value"
        value={`${formatTokenAmount(prepared.value, 18, 'POL')} (${prepared.value} wei)`}
      />
      {prepared.marketName ? (
        <SessionDetail label="Market" value={prepared.marketName} />
      ) : null}
      {prepared.marketId ? (
        <SessionDetail label="Market ID" value={prepared.marketId} />
      ) : null}
    </View>
  );
}

function PreparedYieldSummary({
  prepared,
}: {
  prepared: PreparedYieldTransactions | null;
}) {
  if (!prepared) return null;

  return (
    <View style={styles.preparedSection}>
      <SessionDetail
        label="Transactions"
        value={`${prepared.transactions.length}`}
      />
      <SessionDetail label="First tx to" value={prepared.transactions[0]!.to} />
      {prepared.marketName ? (
        <SessionDetail label="Market" value={prepared.marketName} />
      ) : null}
      {prepared.marketId ? (
        <SessionDetail label="Market ID" value={prepared.marketId} />
      ) : null}
    </View>
  );
}

function TransactionResult({
  txHash,
  disabled,
  onOpen,
}: {
  txHash: string | null;
  disabled: boolean;
  onOpen: (txHash: string) => void;
}) {
  if (!txHash) return null;

  return (
    <View style={styles.transactionResult}>
      <Text selectable style={styles.mono}>
        Tx hash: {txHash}
      </Text>
      <DemoButton
        disabled={disabled}
        label="Open Tx In Explorer"
        onPress={() => {
          onOpen(txHash);
        }}
        variant="outline"
      />
    </View>
  );
}

function EarnPositionsList({
  disabled,
  lastWithdrawTransactionHash,
  onOpenTransaction,
  onRefresh,
  onWithdraw,
  positions,
  status,
}: {
  disabled: boolean;
  lastWithdrawTransactionHash: string | null;
  onOpenTransaction: (txHash: string) => void;
  onRefresh: () => void;
  onWithdraw: (position: EarnPosition) => void;
  positions: EarnPosition[];
  status: string;
}) {
  return (
    <Card title="Deposited Earn Positions">
      <Text style={styles.status}>{status}</Text>
      <DemoButton
        disabled={disabled}
        label="Refresh"
        onPress={onRefresh}
        variant="outline"
      />
      {positions.length === 0 ? (
        <Text style={styles.emptyText}>No active positions on Polygon.</Text>
      ) : (
        <View style={styles.positionList}>
          {positions.map((position) => (
            <View key={position.id} style={styles.positionItem}>
              <View style={styles.positionHeader}>
                <View style={styles.positionTitleGroup}>
                  <Text style={styles.positionTitle}>
                    {position.marketName}
                  </Text>
                  <Text style={styles.positionSubtitle}>
                    {position.provider}
                  </Text>
                </View>
                <Text style={styles.positionApy}>{position.apy}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Deposited</Text>
                <Text selectable style={styles.balanceValue}>
                  {position.amountDisplay} {position.tokenSymbol}
                </Text>
              </View>
              {position.amountUsd ? (
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Value</Text>
                  <Text selectable style={styles.balanceValue}>
                    {position.amountUsd}
                  </Text>
                </View>
              ) : null}
              {position.canWithdraw ? (
                <>
                  <DemoButton
                    disabled={disabled}
                    label="Withdraw"
                    onPress={() => {
                      onWithdraw(position);
                    }}
                    variant="outline"
                  />
                  <Text style={styles.feeOption}>
                    Fee options: [first available]
                  </Text>
                </>
              ) : null}
            </View>
          ))}
        </View>
      )}
      <TransactionResult
        disabled={disabled}
        onOpen={onOpenTransaction}
        txHash={lastWithdrawTransactionHash}
      />
    </Card>
  );
}

function ExplorerBrowser({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={url != null}
    >
      <SafeAreaView style={styles.browserContainer}>
        <View style={styles.browserHeader}>
          <View style={styles.browserHeaderText}>
            <Text style={styles.browserTitle}>Transaction Explorer</Text>
            <Text numberOfLines={1} style={styles.browserUrl}>
              {url ?? ''}
            </Text>
          </View>
          <DemoButton
            label="Close"
            onPress={onClose}
            style={styles.browserCloseButton}
            variant="outline"
          />
        </View>
        {url ? (
          <WebView
            source={{ uri: url }}
            startInLoadingState
            style={styles.browserWebView}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function createTrailsClient(): TrailsApi {
  return new TrailsApi('', { hostname: TRAILS_API_URL });
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatUsdAmount(amountUsd: string | undefined): string | null {
  if (amountUsd === undefined) return null;
  const numericAmount = Number(amountUsd);
  if (!Number.isFinite(numericAmount)) return null;

  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(numericAmount);
}

function formatDisplayAmount(amount: string, maxFractionDigits = 4): string {
  const [whole, fraction = ''] = amount.split('.');
  const trimmedFraction = fraction
    .slice(0, maxFractionDigits)
    .replace(/0+$/, '');
  const wholePart = whole ?? '0';

  return trimmedFraction ? `${wholePart}.${trimmedFraction}` : wholePart;
}

function formatApy(rewardRate?: { total?: number }): string {
  const total = rewardRate?.total;
  if (!Number.isFinite(total)) return '-';
  const percent = (total as number) * 100;
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`;
}

function hasPositiveEarnBalance(balance: EarnBalance): boolean {
  try {
    return BigInt(balance.amountRaw) > 0n;
  } catch {
    const amount = Number(balance.amount);
    return Number.isFinite(amount) && amount > 0;
  }
}

function getPrimaryEarnBalance(
  balances: EarnBalances
): EarnBalance | undefined {
  if (
    balances.outputTokenBalance &&
    hasPositiveEarnBalance(balances.outputTokenBalance)
  ) {
    return balances.outputTokenBalance;
  }

  return balances.balances.find(hasPositiveEarnBalance);
}

function getEarnPositionSortValue(position: EarnPosition): number {
  const amountUsd = Number(position.balance.amountUsd);
  if (Number.isFinite(amountUsd)) return amountUsd;

  const amount = Number(position.balance.amount);
  return Number.isFinite(amount) ? amount : 0;
}

function haveEarnPositionsChanged(
  before: EarnPosition[],
  after: EarnPosition[]
): boolean {
  if (before.length !== after.length) return true;

  const afterById = new Map(after.map((position) => [position.id, position]));
  return before.some((position) => {
    const nextPosition = afterById.get(position.id);
    return !nextPosition || nextPosition.amountRaw !== position.amountRaw;
  });
}

function isEarnPositionWithdrawn(
  before: EarnPosition,
  after: EarnPosition[]
): boolean {
  const nextPosition = after.find((position) => position.id === before.id);
  if (!nextPosition) return true;

  try {
    return BigInt(nextPosition.amountRaw) < BigInt(before.amountRaw);
  } catch {
    const nextAmount = Number(nextPosition.amount);
    const beforeAmount = Number(before.amount);
    return (
      Number.isFinite(nextAmount) &&
      Number.isFinite(beforeAmount) &&
      nextAmount < beforeAmount
    );
  }
}

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
}

function requireWalletAddress(address: string | null): `0x${string}` {
  if (!address?.startsWith('0x')) {
    throw new Error('Sign in before preparing a Trails action.');
  }
  return address as `0x${string}`;
}

function transactionResultLabel(result: OmsSendTransactionResponse): string {
  return result.txnHash
    ? shortHash(result.txnHash)
    : `${result.txnId} (${result.status})`;
}

function requirePreparedTransaction(
  prepared: PreparedTrailsTransaction | null
): PreparedTrailsTransaction {
  if (!prepared) throw new Error('Prepare the transaction first.');
  return prepared;
}

function requirePreparedYieldTransactions(
  prepared: PreparedYieldTransactions | null
): PreparedYieldTransactions {
  if (!prepared) throw new Error('Prepare the transaction first.');
  return prepared;
}

function normalizePolAmountInput(value: string): string {
  let result = '';
  let hasDecimal = false;

  for (const character of value.replace(/,/g, '.')) {
    if (character >= '0' && character <= '9') {
      result += character;
      continue;
    }

    if (character === '.' && !hasDecimal) {
      result += character;
      hasDecimal = true;
    }
  }

  return result.startsWith('.') ? `0${result}` : result;
}

function parsePositivePolAmount(amount: string): bigint {
  const trimmed = normalizePolAmountInput(amount).trim();
  if (!trimmed) throw new Error('Enter a POL amount.');
  const parsed = parseEther(trimmed);
  if (parsed <= 0n) throw new Error('Enter a POL amount greater than zero.');
  return parsed;
}

function parsePositiveUsdcAmount(amount: string): string {
  const trimmed = normalizePolAmountInput(amount).trim();
  if (!trimmed) throw new Error('Enter a USDC amount.');
  const parsed = parseUnits(trimmed, 6);
  if (parsed <= 0n) throw new Error('Enter a USDC amount greater than zero.');
  return trimmed;
}

function formatTokenAmount(
  rawBalance: string | undefined,
  decimals: number,
  symbol: string
): string {
  if (!rawBalance) return `0 ${symbol}`;

  try {
    const formatted = formatUnits(BigInt(rawBalance), decimals);
    const [whole, fraction = ''] = formatted.split('.');
    const maxFractionDigits = 6;
    const trimmedFraction = fraction
      .slice(0, maxFractionDigits)
      .replace(/0+$/, '');

    return `${trimmedFraction ? `${whole}.${trimmedFraction}` : whole} ${symbol}`;
  } catch {
    return `- ${symbol}`;
  }
}

function formatLoginType(type: string | null): string {
  if (!type) return 'Unknown';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatSessionExpiration(expiresAt: number | string | null): string {
  if (!expiresAt) return 'Unknown';
  return new Date(expiresAt).toLocaleString();
}

function normalizeOrder(chainId: string): number {
  const preferredIndex = PREFERRED_NETWORK_ORDER.indexOf(chainId);
  return preferredIndex === -1 ? Number.MAX_SAFE_INTEGER : preferredIndex;
}

function sortNetworks(networks: OmsNetwork[]): OmsNetwork[] {
  return [...networks].sort((left, right) => {
    const leftOrder = normalizeOrder(left.chainId);
    const rightOrder = normalizeOrder(right.chainId);

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function rawAmount(value: string): bigint {
  try {
    return BigInt(value || '0');
  } catch {
    return 0n;
  }
}

function hasExpectedBalanceChange(
  operation: BalanceOperation,
  before: BalanceState,
  after: BalanceState
): boolean {
  if (operation === 'swap') {
    return (
      rawAmount(after.usdcRaw) > rawAmount(before.usdcRaw) &&
      after.polRaw !== before.polRaw
    );
  }
  if (operation === 'depositEarn') {
    return after.usdcRaw !== before.usdcRaw;
  }
  return after.polRaw !== before.polRaw;
}

function expectedBalanceDescription(operation: BalanceOperation): string {
  if (operation === 'depositEarn') return 'USDC balance change';
  return operation === 'swap'
    ? 'USDC balance increase and POL balance change'
    : 'POL balance change';
}

function pollingTimeoutMessage(target: string): string {
  return `Timed out waiting for ${target}. The transaction may still settle; refresh in a moment.`;
}

function explorerUrlFor(txHash: string): string {
  return `https://polygonscan.com/tx/${txHash}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getNativePolBalanceRaw(
  walletAddress: `0x${string}`
): Promise<string> {
  const indexerUrl = DEMO_ENVIRONMENT.indexerUrlTemplate
    .replace('{value}', POLYGON_INDEXER_NAME)
    .replace(/\/+$/, '');
  const response = await fetch(`${indexerUrl}/GetNativeTokenBalance`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Access-Key': DEMO_PROJECT_ACCESS_KEY,
    },
    body: JSON.stringify({
      accountAddress: walletAddress,
    }),
  });

  if (!response.ok) {
    throw new Error(`Native balance request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as {
    balance?: {
      balance?: string;
      balanceWei?: string;
    };
  };

  return payload.balance?.balance ?? payload.balance?.balanceWei ?? '0';
}

async function getPolygonBalances(
  walletAddress: `0x${string}`
): Promise<BalanceState> {
  const [polRaw, usdcResult] = await Promise.all([
    getNativePolBalanceRaw(walletAddress),
    getTokenBalances({
      chainId: POLYGON_CHAIN_ID,
      contractAddress: POLYGON_USDC,
      walletAddress,
      includeMetadata: false,
    }),
  ]);
  const usdcRaw = usdcResult.balances[0]?.balance ?? '0';

  return {
    pol: formatTokenAmount(polRaw, 18, 'POL'),
    usdc: formatTokenAmount(usdcRaw, 6, 'USDC'),
    polRaw,
    usdcRaw,
    status: 'Balances updated.',
  };
}

async function getPolygonEarnPositions(
  walletAddress: `0x${string}`
): Promise<{ positions: EarnPosition[]; errors: string[] }> {
  const trailsClient = createTrailsClient();
  const [balancesResult, marketsResult] = await Promise.all([
    getEarnBalances(
      {
        queries: [
          {
            address: walletAddress,
            network: 'polygon',
          },
        ],
      },
      trailsClient
    ),
    getEarnMarkets(
      {
        chain: POLYGON_CHAIN_ID_NUMBER,
        limit: 100,
      },
      trailsClient
    ),
  ]);
  const marketById = new Map(
    marketsResult.items.map((market) => [market.id, market])
  );
  const positions = balancesResult.items
    .flatMap((balances) => {
      const balance = getPrimaryEarnBalance(balances);
      if (!balance) return [];

      const market = marketById.get(balances.yieldId);
      const position: EarnPosition = {
        id: balances.yieldId,
        marketId: balances.yieldId,
        marketName:
          market?.metadata?.name ??
          balance.shareToken?.name ??
          `${balance.token.symbol} position`,
        provider:
          market?.providerId ?? balance.shareToken?.symbol ?? balances.yieldId,
        amount: balance.amount,
        amountDisplay: formatDisplayAmount(balance.amount),
        amountRaw: balance.amountRaw,
        amountUsd: formatUsdAmount(balance.amountUsd),
        apy: formatApy(balances.rewardRate ?? market?.rewardRate),
        tokenSymbol: balance.token.symbol,
        canWithdraw: market?.status?.exit !== false,
        balance,
        market,
      };
      return [position];
    })
    .sort(
      (left, right) =>
        getEarnPositionSortValue(right) - getEarnPositionSortValue(left)
    );

  return {
    positions,
    errors: balancesResult.errors.map(
      (error) => `${error.yieldId}: ${error.error}`
    ),
  };
}

function parseUnsignedYieldTransaction(tx: unknown): ParsedYieldTransaction {
  const unsignedTx = (typeof tx === 'string' ? JSON.parse(tx) : tx) as {
    to?: string;
    data?: string;
    value?: string | number | bigint | null;
    chainId?: string | number;
  };

  if (!unsignedTx.to || unsignedTx.chainId === undefined) {
    throw new Error('Yield exit action returned an incomplete transaction.');
  }

  return {
    to: unsignedTx.to as `0x${string}`,
    data: (unsignedTx.data ?? '0x') as Hex,
    value: unsignedTx.value === null ? 0n : BigInt(unsignedTx.value ?? 0),
    chainId: Number(unsignedTx.chainId),
  };
}

async function createWithdrawTransactions({
  walletAddress,
  position,
}: {
  walletAddress: `0x${string}`;
  position: EarnPosition;
}): Promise<ParsedYieldTransaction[]> {
  const trailsClient = createTrailsClient();
  const response = await trailsClient.yieldCreateExitAction({
    earnMarketId: position.marketId,
    userWalletAddress: walletAddress,
    args: {
      amount: position.amount,
      outputToken:
        position.balance.token.address ?? position.balance.token.symbol,
      outputTokenNetwork:
        position.balance.token.network ?? position.market?.network ?? 'polygon',
    },
  });
  const transactions = response.action.transactions
    .filter((transaction) => !transaction.isMessage)
    .map((transaction) =>
      parseUnsignedYieldTransaction(transaction.unsignedTransaction)
    );

  if (transactions.length === 0) {
    throw new Error('Yield exit action did not return a transaction.');
  }

  const unsupportedTransaction = transactions.find(
    (transaction) => transaction.chainId !== POLYGON_CHAIN_ID_NUMBER
  );
  if (unsupportedTransaction) {
    throw new Error(
      `Withdraw returned chain ${unsupportedTransaction.chainId}, but this demo only sends Polygon transactions.`
    );
  }

  return transactions;
}

function getMarketInputToken(market: EarnMarket) {
  return market.inputTokens[0] ?? market.token;
}

function getMarketName(market: EarnMarket): string {
  return market.metadata?.name || market.id;
}

function isUsdcMarket(market: EarnMarket): boolean {
  const input = getMarketInputToken(market);
  return input?.address?.toLowerCase() === POLYGON_USDC.toLowerCase();
}

async function findPolygonUsdcEarnMarket(
  trailsClient: TrailsApi
): Promise<EarnMarket> {
  const markets = await getEarnMarkets(
    {
      chain: POLYGON_CHAIN_ID_NUMBER,
      search: 'USDC',
      limit: 50,
    },
    trailsClient
  );

  const candidates = markets.items
    .filter((market) => market.status?.enter !== false)
    .filter(isUsdcMarket)
    .sort((left, right) => {
      const leftRate = left.rewardRate?.total ?? 0;
      const rightRate = right.rewardRate?.total ?? 0;
      return rightRate - leftRate;
    });

  const market = candidates[0];
  if (!market) {
    throw new Error('No enterable Polygon USDC earn market was returned.');
  }
  return market;
}

function buildEarnAction(
  market: EarnMarket,
  walletAddress: `0x${string}`,
  amount: string = dynamic()
): ActionItem {
  const inputToken = getMarketInputToken(market);
  const inputTokenRef = inputToken?.address ?? inputToken?.symbol;
  const inputTokenNetwork = inputToken?.network ?? market.network;
  const params = {
    marketId: market.id,
    amount,
    inputToken: inputTokenRef,
    inputTokenNetwork,
    receiverAddress: walletAddress,
  };

  return market.mechanics.type === 'lending' ? lend(params) : deposit(params);
}

function encodePreparedTransaction({
  title,
  calls,
  walletAddress,
  value,
  market,
}: {
  title: string;
  calls: Awaited<ReturnType<typeof resolveActionsToCalls>>;
  walletAddress: `0x${string}`;
  value: bigint;
  market?: EarnMarket;
}): PreparedTrailsTransaction {
  const encoded = encodeDestinationCalls({
    calls,
    tokenAddress: POLYGON_USDC,
    sweepTarget: walletAddress,
  });

  return {
    title,
    to: encoded.recipient,
    data: encoded.destinationCalldata,
    value: value.toString(),
    callCount: calls.length,
    marketName: market ? getMarketName(market) : undefined,
    marketId: market?.id,
  };
}

async function prepareSwapPolToUsdc({
  walletAddress,
  polAmount,
}: {
  walletAddress: `0x${string}`;
  polAmount: string;
}): Promise<PreparedTrailsTransaction> {
  const amountRaw = parsePositivePolAmount(polAmount);
  const trailsClient = createTrailsClient();
  const calls = await resolveActionsToCalls({
    actions: [
      custom({
        to: POLYGON_WPOL,
        data: WRAPPED_NATIVE_DEPOSIT_CALLDATA,
        value: amountRaw,
      }),
      swap({
        tokenIn: POLYGON_WPOL,
        tokenOut: POLYGON_USDC,
        fee: '0.05',
        amountInRaw: amountRaw,
        minAmountOutRaw: 0n,
        provider: 'UNISWAP_V3',
      }),
    ],
    destinationChain: POLYGON_CHAIN_ID_NUMBER,
    userWalletAddress: walletAddress,
    trailsClient,
    publicClient: null,
  });

  return encodePreparedTransaction({
    title: 'Swap POL to USDC',
    calls,
    walletAddress,
    value: amountRaw,
  });
}

async function prepareDepositUsdc({
  walletAddress,
  usdcAmount,
}: {
  walletAddress: `0x${string}`;
  usdcAmount: string;
}): Promise<PreparedYieldTransactions> {
  const amount = parsePositiveUsdcAmount(usdcAmount);
  const trailsClient = createTrailsClient();
  const market = await findPolygonUsdcEarnMarket(trailsClient);
  const inputToken = getMarketInputToken(market);
  const response = await trailsClient.yieldCreateEnterAction({
    earnMarketId: market.id,
    userWalletAddress: walletAddress,
    args: {
      amount,
      inputToken: inputToken?.address ?? inputToken?.symbol,
      inputTokenNetwork: inputToken?.network ?? market.network,
      receiverAddress: walletAddress,
    },
  });
  const transactions = response.action.transactions
    .filter((transaction) => !transaction.isMessage)
    .map((transaction) =>
      parseUnsignedYieldTransaction(transaction.unsignedTransaction)
    );

  if (transactions.length === 0) {
    throw new Error('Yield enter action did not return a transaction.');
  }

  const unsupportedTransaction = transactions.find(
    (transaction) => transaction.chainId !== POLYGON_CHAIN_ID_NUMBER
  );
  if (unsupportedTransaction) {
    throw new Error(
      `Deposit returned chain ${unsupportedTransaction.chainId}, but this demo only sends Polygon transactions.`
    );
  }

  return {
    title: 'Deposit USDC using Earn',
    transactions,
    marketName: getMarketName(market),
    marketId: market.id,
  };
}

async function prepareSwapAndEarnUsdc({
  walletAddress,
  polAmount,
}: {
  walletAddress: `0x${string}`;
  polAmount: string;
}): Promise<PreparedTrailsTransaction> {
  const amountRaw = parsePositivePolAmount(polAmount);
  const trailsClient = createTrailsClient();
  const market = await findPolygonUsdcEarnMarket(trailsClient);
  const calls = await resolveActionsToCalls({
    actions: [
      custom({
        to: POLYGON_WPOL,
        data: WRAPPED_NATIVE_DEPOSIT_CALLDATA,
        value: amountRaw,
      }),
      swap({
        tokenIn: POLYGON_WPOL,
        tokenOut: POLYGON_USDC,
        fee: '0.05',
        amountInRaw: amountRaw,
        minAmountOutRaw: 0n,
        provider: 'UNISWAP_V3',
      }),
      buildEarnAction(market, walletAddress),
    ],
    destinationChain: POLYGON_CHAIN_ID_NUMBER,
    userWalletAddress: walletAddress,
    trailsClient,
    publicClient: null,
  });

  return encodePreparedTransaction({
    title: 'Swap and earn USDC',
    calls,
    walletAddress,
    value: amountRaw,
    market,
  });
}

export default function App() {
  const [networks, setNetworks] = useState<OmsNetwork[]>([]);
  const [session, setSession] =
    useState<OmsClientSessionState>(SIGNED_OUT_SESSION);
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [authStatus, setAuthStatus] = useState('Waiting for sign-in.');
  const [swapPolAmount, setSwapPolAmount] = useState(DEFAULT_SWAP_POL_AMOUNT);
  const [depositUsdcAmount, setDepositUsdcAmount] = useState(
    DEFAULT_DEPOSIT_USDC_AMOUNT
  );
  const [earnPolAmount, setEarnPolAmount] = useState(DEFAULT_EARN_POL_AMOUNT);
  const [balances, setBalances] = useState<BalanceState>(SIGNED_OUT_BALANCES);
  const [preparedSwap, setPreparedSwap] =
    useState<PreparedTrailsTransaction | null>(null);
  const [preparedDeposit, setPreparedDeposit] =
    useState<PreparedYieldTransactions | null>(null);
  const [preparedEarn, setPreparedEarn] =
    useState<PreparedTrailsTransaction | null>(null);
  const [swapStatus, setSwapStatus] = useState(
    'Swap status: waiting to prepare.'
  );
  const [depositStatus, setDepositStatus] = useState(
    'Deposit status: waiting to prepare.'
  );
  const [earnStatus, setEarnStatus] = useState(
    'Swap and Deposit status: waiting to prepare.'
  );
  const [lastSwapTransactionHash, setLastSwapTransactionHash] = useState<
    string | null
  >(null);
  const [lastDepositTransactionHash, setLastDepositTransactionHash] = useState<
    string | null
  >(null);
  const [lastEarnTransactionHash, setLastEarnTransactionHash] = useState<
    string | null
  >(null);
  const [earnPositions, setEarnPositions] = useState<EarnPosition[]>([]);
  const [earnPositionsStatus, setEarnPositionsStatus] = useState(
    'Sign in to load earn positions.'
  );
  const [lastWithdrawTransactionHash, setLastWithdrawTransactionHash] =
    useState<string | null>(null);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [logLines, setLogLines] = useState(['Ready.']);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const appendLog = useCallback((messageToAppend: string) => {
    setLogLines((current) => [...current, messageToAppend].slice(-80));
  }, []);

  const resetActionState = useCallback(() => {
    setPreparedSwap(null);
    setPreparedDeposit(null);
    setPreparedEarn(null);
    setLastSwapTransactionHash(null);
    setLastDepositTransactionHash(null);
    setLastEarnTransactionHash(null);
    setLastWithdrawTransactionHash(null);
    setEarnPositions([]);
    setEarnPositionsStatus('Sign in to load earn positions.');
    setBalances(SIGNED_OUT_BALANCES);
    setSwapStatus('Swap status: waiting to prepare.');
    setDepositStatus('Deposit status: waiting to prepare.');
    setEarnStatus('Swap and Deposit status: waiting to prepare.');
  }, []);

  const refreshSession = useCallback(async () => {
    const nextSession = await getSession();
    setSession(nextSession);
    if (nextSession.walletAddress) {
      setAuthStatus('Restored persisted wallet session');
      setSwapStatus('Swap status: ready to prepare.');
      setDepositStatus('Deposit status: ready to prepare.');
      setEarnStatus('Swap and Deposit status: ready to prepare.');
    }
    return nextSession;
  }, []);

  const runAction = useCallback(
    async (
      label: string,
      action: () => Promise<void>,
      onFailure?: (error: unknown) => void
    ) => {
      appendLog(`>> ${label}`);
      setLoadingAction(label);
      try {
        await action();
      } catch (error) {
        onFailure?.(error);
        appendLog(`!! ${describeError(error)}`);
      } finally {
        setLoadingAction(null);
      }
    },
    [appendLog]
  );

  const refreshBalances = useCallback(
    async (
      walletAddress: `0x${string}`,
      status = 'Loading balances...'
    ): Promise<BalanceState | null> => {
      setBalances((current) => ({
        ...current,
        status,
      }));

      try {
        const nextBalances = await getPolygonBalances(walletAddress);
        setBalances(nextBalances);
        return nextBalances;
      } catch (error) {
        const message = `Balance status: ${describeError(error)}`;
        setBalances((current) => ({
          ...current,
          status: message,
        }));
        appendLog(`!! ${message}`);
        return null;
      }
    },
    [appendLog]
  );

  const readBalanceSnapshot = useCallback(
    async (walletAddress: `0x${string}`): Promise<BalanceState> => {
      try {
        return await getPolygonBalances(walletAddress);
      } catch (error) {
        appendLog(`!! Balance snapshot failed: ${describeError(error)}`);
        return balances;
      }
    },
    [appendLog, balances]
  );

  const refreshEarnPositions = useCallback(
    async (
      walletAddress: `0x${string}`,
      status = 'Loading earn positions...'
    ): Promise<EarnPosition[]> => {
      setEarnPositionsStatus(status);

      try {
        const result = await getPolygonEarnPositions(walletAddress);
        setEarnPositions(result.positions);
        if (result.errors.length > 0) {
          setEarnPositionsStatus(
            `Earn positions loaded with ${result.errors.length} API error(s).`
          );
          result.errors.forEach((error) => {
            appendLog(`!! Earn balance error: ${error}`);
          });
        } else {
          setEarnPositionsStatus(
            result.positions.length > 0
              ? 'Earn positions updated.'
              : 'No deposited earn positions.'
          );
        }
        return result.positions;
      } catch (error) {
        const message = `Earn positions status: ${describeError(error)}`;
        setEarnPositionsStatus(message);
        appendLog(`!! ${message}`);
        return [];
      }
    },
    [appendLog]
  );

  const readEarnPositionsSnapshot = useCallback(
    async (walletAddress: `0x${string}`): Promise<EarnPosition[]> => {
      try {
        const result = await getPolygonEarnPositions(walletAddress);
        return result.positions;
      } catch (error) {
        appendLog(`!! Earn positions snapshot failed: ${describeError(error)}`);
        return earnPositions;
      }
    },
    [appendLog, earnPositions]
  );

  const pollBalancesUntilExpected = useCallback(
    async ({
      operation,
      walletAddress,
      before,
      onWaiting,
    }: {
      operation: BalanceOperation;
      walletAddress: `0x${string}`;
      before: BalanceState;
      onWaiting: () => void;
    }) => {
      for (
        let attempt = 0;
        attempt < TRANSACTION_POLL_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await delay(BALANCE_POLL_INTERVAL_MS);

        try {
          const nextBalances = await getPolygonBalances(walletAddress);
          const isExpectedChange = hasExpectedBalanceChange(
            operation,
            before,
            nextBalances
          );

          if (isExpectedChange) {
            const updatedBalances = {
              ...nextBalances,
              status: 'Balances updated.',
            };
            setBalances(updatedBalances);
            return updatedBalances;
          }

          setBalances((current) => ({
            ...current,
            status: `Waiting for ${expectedBalanceDescription(operation)}...`,
          }));
        } catch (error) {
          setBalances((current) => ({
            ...current,
            status: `Balance polling failed: ${describeError(error)}. Retrying...`,
          }));
        }

        onWaiting();
      }

      const message = pollingTimeoutMessage(
        expectedBalanceDescription(operation)
      );
      setBalances((current) => ({
        ...current,
        status: message,
      }));
      throw new Error(message);
    },
    []
  );

  const pollEarnPositionsUntilChanged = useCallback(
    async ({
      walletAddress,
      before,
      onWaiting,
    }: {
      walletAddress: `0x${string}`;
      before: EarnPosition[];
      onWaiting: () => void;
    }) => {
      for (
        let attempt = 0;
        attempt < TRANSACTION_POLL_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await delay(BALANCE_POLL_INTERVAL_MS);

        try {
          const result = await getPolygonEarnPositions(walletAddress);
          if (haveEarnPositionsChanged(before, result.positions)) {
            setEarnPositions(result.positions);
            setEarnPositionsStatus('Earn positions updated.');
            return result.positions;
          }

          setEarnPositionsStatus('Waiting for earn positions update...');
        } catch (error) {
          setEarnPositionsStatus(
            `Earn positions polling failed: ${describeError(error)}. Retrying...`
          );
        }

        onWaiting();
      }

      const message = pollingTimeoutMessage('earn positions update');
      setEarnPositionsStatus(message);
      throw new Error(message);
    },
    []
  );

  const pollEarnPositionUntilWithdrawn = useCallback(
    async ({
      walletAddress,
      position,
      onWaiting,
    }: {
      walletAddress: `0x${string}`;
      position: EarnPosition;
      onWaiting: () => void;
    }) => {
      for (
        let attempt = 0;
        attempt < TRANSACTION_POLL_MAX_ATTEMPTS;
        attempt += 1
      ) {
        await delay(BALANCE_POLL_INTERVAL_MS);

        try {
          const result = await getPolygonEarnPositions(walletAddress);
          if (isEarnPositionWithdrawn(position, result.positions)) {
            setEarnPositions(result.positions);
            setEarnPositionsStatus('Earn positions updated.');
            return result.positions;
          }

          setEarnPositionsStatus('Waiting for withdraw position update...');
        } catch (error) {
          setEarnPositionsStatus(
            `Withdraw polling failed: ${describeError(error)}. Retrying...`
          );
        }

        onWaiting();
      }

      const message = pollingTimeoutMessage('withdraw position update');
      setEarnPositionsStatus(message);
      throw new Error(message);
    },
    []
  );

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      await runAction('Initializing SDK', async () => {
        await configure({
          projectAccessKey: DEMO_PROJECT_ACCESS_KEY,
          projectId: DEMO_PROJECT_ID,
          environment: DEMO_ENVIRONMENT,
        });

        const supportedNetworks = sortNetworks(await getSupportedNetworks());
        if (disposed) return;

        setNetworks(supportedNetworks);

        const polygonNetwork = supportedNetworks.find(
          (network) => network.chainId === POLYGON_CHAIN_ID
        );
        if (!polygonNetwork) {
          throw new Error('Polygon network is not available in this project.');
        }
        appendLog('Polygon network is available.');

        const nextSession = await refreshSession();
        if (nextSession.walletAddress) {
          appendLog(`Wallet ready: ${nextSession.walletAddress}`);
        }
      });
    }

    bootstrap().catch((error: unknown) => {
      appendLog(`!! ${describeError(error)}`);
    });

    return () => {
      disposed = true;
    };
  }, [appendLog, refreshSession, runAction]);

  const walletAddress = session.walletAddress;
  const isSignedIn = walletAddress != null;
  const isBusy = loadingAction != null;
  const polygonNetwork = useMemo(
    () => networks.find((network) => network.chainId === POLYGON_CHAIN_ID),
    [networks]
  );

  useEffect(() => {
    if (!walletAddress?.startsWith('0x')) {
      setBalances(SIGNED_OUT_BALANCES);
      setEarnPositions([]);
      setEarnPositionsStatus('Sign in to load earn positions.');
      return;
    }

    const address = walletAddress as `0x${string}`;
    refreshBalances(address, 'Loading Polygon balances...').catch(
      (error: unknown) => {
        appendLog(`!! ${describeError(error)}`);
      }
    );
    refreshEarnPositions(address, 'Loading Polygon earn positions...').catch(
      (error: unknown) => {
        appendLog(`!! ${describeError(error)}`);
      }
    );
  }, [appendLog, refreshBalances, refreshEarnPositions, walletAddress]);

  const refreshSignedInData = useCallback(() => {
    if (!walletAddress?.startsWith('0x')) return;
    const address = walletAddress as `0x${string}`;
    refreshBalances(address, 'Loading Polygon balances...').catch(
      (error: unknown) => {
        appendLog(`!! ${describeError(error)}`);
      }
    );
    refreshEarnPositions(address, 'Loading Polygon earn positions...').catch(
      (error: unknown) => {
        appendLog(`!! ${describeError(error)}`);
      }
    );
  }, [appendLog, refreshBalances, refreshEarnPositions, walletAddress]);

  const requestEmailCode = () => {
    runAction(
      'Start email sign-in',
      async () => {
        const normalizedEmail = requireText(email, 'Email');
        setAuthStatus('Requesting email code...');
        await startEmailAuth(normalizedEmail);
        setEmail('');
        setAuthStage('code');
        setAuthStatus(`Code requested for ${normalizedEmail}`);
      },
      (error) => {
        setAuthStatus(`Sign-in error: ${describeError(error)}`);
      }
    );
  };

  const completeEmailCode = () => {
    runAction(
      'Complete email sign-in',
      async () => {
        setAuthStatus('Verifying code...');
        await completeEmailAuth({ code: requireText(code, 'Code') });
        const nextSession = await refreshSession();
        setCode('');
        setAuthStage('email');
        setAuthStatus('Email login complete');
        if (nextSession.walletAddress) {
          appendLog(`Wallet ready: ${nextSession.walletAddress}`);
        }
      },
      (error) => {
        setAuthStatus(`Verify error: ${describeError(error)}`);
      }
    );
  };

  const cancelCodeStep = () => {
    runAction('Cancel email sign-in', async () => {
      await signOut();
      setAuthStage('email');
      setCode('');
      setAuthStatus('Email sign-in cancelled.');
      setSession(SIGNED_OUT_SESSION);
      resetActionState();
    });
  };

  const logout = () => {
    runAction('Sign out', async () => {
      await signOut();
      setSession(SIGNED_OUT_SESSION);
      setAuthStage('email');
      setCode('');
      setAuthStatus('Signed out.');
      resetActionState();
    });
  };

  const copyWalletAddress = useCallback(() => {
    if (!walletAddress) return;
    Clipboard.setString(walletAddress);
    appendLog('Copied wallet address.');
  }, [appendLog, walletAddress]);

  const openExplorer = useCallback(
    (txHash: string) => {
      setBrowserUrl(explorerUrlFor(txHash));
      appendLog(`Opening explorer for ${shortHash(txHash)}.`);
    },
    [appendLog]
  );

  const closeExplorer = useCallback(() => {
    setBrowserUrl(null);
  }, []);

  const updateSwapPolAmount = useCallback((value: string) => {
    setSwapPolAmount(normalizePolAmountInput(value));
    setPreparedSwap(null);
    setLastSwapTransactionHash(null);
    setSwapStatus('Swap status: waiting to prepare.');
  }, []);

  const updateDepositUsdcAmount = useCallback((value: string) => {
    setDepositUsdcAmount(normalizePolAmountInput(value));
    setPreparedDeposit(null);
    setLastDepositTransactionHash(null);
    setDepositStatus('Deposit status: waiting to prepare.');
  }, []);

  const updateEarnPolAmount = useCallback((value: string) => {
    setEarnPolAmount(normalizePolAmountInput(value));
    setPreparedEarn(null);
    setLastEarnTransactionHash(null);
    setEarnStatus('Swap and Deposit status: waiting to prepare.');
  }, []);

  const prepareSwap = () => {
    runAction(
      'Prepare swap',
      async () => {
        const prepared = await prepareSwapPolToUsdc({
          walletAddress: requireWalletAddress(walletAddress),
          polAmount: swapPolAmount,
        });
        setPreparedSwap(prepared);
        setSwapStatus(
          `Swap status: prepared ${prepared.callCount} destination calls.`
        );
      },
      (error) => {
        setSwapStatus(`Swap status: ${describeError(error)}`);
      }
    );
  };

  const prepareDeposit = () => {
    runAction(
      'Prepare deposit',
      async () => {
        const prepared = await prepareDepositUsdc({
          walletAddress: requireWalletAddress(walletAddress),
          usdcAmount: depositUsdcAmount,
        });
        setPreparedDeposit(prepared);
        setDepositStatus(
          `Deposit status: prepared ${prepared.transactions.length} wallet transaction${prepared.transactions.length === 1 ? '' : 's'}.`
        );
      },
      (error) => {
        setDepositStatus(`Deposit status: ${describeError(error)}`);
      }
    );
  };

  const prepareEarn = () => {
    runAction(
      'Prepare earn',
      async () => {
        const prepared = await prepareSwapAndEarnUsdc({
          walletAddress: requireWalletAddress(walletAddress),
          polAmount: earnPolAmount,
        });
        setPreparedEarn(prepared);
        setEarnStatus(
          `Swap and Deposit status: prepared ${prepared.callCount} destination calls.`
        );
      },
      (error) => {
        setEarnStatus(`Swap and Deposit status: ${describeError(error)}`);
      }
    );
  };

  const sendSwap = () => {
    runAction(
      'Send swap',
      async () => {
        const prepared = requirePreparedTransaction(preparedSwap);
        const address = requireWalletAddress(walletAddress);
        const before = await readBalanceSnapshot(address);

        setSwapStatus('Swap status: sending...');
        const txResult = await sendTransaction({
          chainId: POLYGON_CHAIN_ID,
          to: prepared.to,
          value: prepared.value,
          data: prepared.data,
        });
        const txLabel = transactionResultLabel(txResult);
        setLastSwapTransactionHash(txResult.txnHash);
        setSwapStatus(
          `Swap status: submitted ${txLabel}. Waiting for USDC and POL balance updates...`
        );
        await pollBalancesUntilExpected({
          operation: 'swap',
          walletAddress: address,
          before,
          onWaiting: () => {
            setSwapStatus(
              `Swap status: submitted ${txLabel}. Waiting for USDC and POL balance updates...`
            );
          },
        });
        setSwapStatus(
          `Swap status: submitted ${txLabel}. USDC and POL updated.`
        );
      },
      (error) => {
        setSwapStatus(`Swap status: ${describeError(error)}`);
      }
    );
  };

  const sendDeposit = () => {
    runAction(
      'Send deposit',
      async () => {
        const prepared = requirePreparedYieldTransactions(preparedDeposit);
        const address = requireWalletAddress(walletAddress);
        const before = await readBalanceSnapshot(address);
        const beforePositions = await readEarnPositionsSnapshot(address);

        let txLabel: string | null = null;
        for (const [index, transaction] of prepared.transactions.entries()) {
          const label =
            prepared.transactions.length === 1
              ? 'transaction'
              : `transaction ${index + 1}/${prepared.transactions.length}`;
          setDepositStatus(`Deposit status: sending ${label}...`);
          const txResult = await sendTransaction({
            chainId: String(transaction.chainId),
            to: transaction.to,
            value: transaction.value.toString(),
            data: transaction.data,
          });
          txLabel = transactionResultLabel(txResult);
          setLastDepositTransactionHash(txResult.txnHash);
          setDepositStatus(`Deposit status: submitted ${label} ${txLabel}.`);
        }

        if (!txLabel) {
          throw new Error('Deposit did not submit a transaction.');
        }

        setDepositStatus(
          `Deposit status: submitted ${txLabel}. Waiting for USDC balance update...`
        );
        await pollBalancesUntilExpected({
          operation: 'depositEarn',
          walletAddress: address,
          before,
          onWaiting: () => {
            setDepositStatus(
              `Deposit status: submitted ${txLabel}. Waiting for USDC balance update...`
            );
          },
        });
        setDepositStatus(
          `Deposit status: submitted ${txLabel}. Waiting for earn positions update...`
        );
        await pollEarnPositionsUntilChanged({
          walletAddress: address,
          before: beforePositions,
          onWaiting: () => {
            setDepositStatus(
              `Deposit status: submitted ${txLabel}. Waiting for earn positions update...`
            );
          },
        });
        setDepositStatus(
          `Deposit status: submitted ${txLabel}. USDC and earn positions updated.`
        );
      },
      (error) => {
        setDepositStatus(`Deposit status: ${describeError(error)}`);
      }
    );
  };

  const sendEarn = () => {
    runAction(
      'Send earn',
      async () => {
        const prepared = requirePreparedTransaction(preparedEarn);
        const address = requireWalletAddress(walletAddress);
        const before = await readBalanceSnapshot(address);
        const beforePositions = await readEarnPositionsSnapshot(address);

        setEarnStatus('Swap and Deposit status: sending...');
        const txResult = await sendTransaction({
          chainId: POLYGON_CHAIN_ID,
          to: prepared.to,
          value: prepared.value,
          data: prepared.data,
        });
        const txLabel = transactionResultLabel(txResult);
        setLastEarnTransactionHash(txResult.txnHash);
        setEarnStatus(
          `Swap and Deposit status: submitted ${txLabel}. Waiting for POL balance update...`
        );
        await pollBalancesUntilExpected({
          operation: 'earn',
          walletAddress: address,
          before,
          onWaiting: () => {
            setEarnStatus(
              `Swap and Deposit status: submitted ${txLabel}. Waiting for POL balance update...`
            );
          },
        });
        setEarnStatus(
          `Swap and Deposit status: submitted ${txLabel}. Waiting for earn positions update...`
        );
        await pollEarnPositionsUntilChanged({
          walletAddress: address,
          before: beforePositions,
          onWaiting: () => {
            setEarnStatus(
              `Swap and Deposit status: submitted ${txLabel}. Waiting for earn positions update...`
            );
          },
        });
        setEarnStatus(
          `Swap and Deposit status: submitted ${txLabel}. POL and earn positions updated.`
        );
      },
      (error) => {
        setEarnStatus(`Swap and Deposit status: ${describeError(error)}`);
      }
    );
  };

  const withdrawEarnPosition = (position: EarnPosition) => {
    runAction(
      `Withdraw ${position.marketName}`,
      async () => {
        const address = requireWalletAddress(walletAddress);
        setEarnPositionsStatus(
          `Preparing withdraw for ${position.marketName}...`
        );
        const transactions = await createWithdrawTransactions({
          walletAddress: address,
          position,
        });

        let lastTxLabel: string | null = null;
        for (const [index, transaction] of transactions.entries()) {
          const label =
            transactions.length === 1
              ? 'withdraw transaction'
              : `withdraw transaction ${index + 1}`;
          setEarnPositionsStatus(`Sending ${label}...`);
          const txResult = await sendTransaction({
            chainId: String(transaction.chainId),
            to: transaction.to,
            value: transaction.value.toString(),
            data: transaction.data,
          });
          lastTxLabel = transactionResultLabel(txResult);
          setLastWithdrawTransactionHash(txResult.txnHash);
          setEarnPositionsStatus(
            `Submitted ${lastTxLabel}. Waiting for withdraw position update...`
          );
        }

        if (!lastTxLabel) {
          throw new Error('Withdraw did not submit a transaction.');
        }

        await pollEarnPositionUntilWithdrawn({
          walletAddress: address,
          position,
          onWaiting: () => {
            setEarnPositionsStatus(
              `Submitted ${lastTxLabel}. Waiting for withdraw position update...`
            );
          },
        });
        await refreshBalances(address, 'Refreshing balances after withdraw...');
        setEarnPositionsStatus(
          `Withdraw submitted ${lastTxLabel}. Earn position updated.`
        );
      },
      (error) => {
        setEarnPositionsStatus(`Withdraw status: ${describeError(error)}`);
      }
    );
  };

  const authAction =
    authStage === 'email' ? requestEmailCode : completeEmailCode;
  const authActionLabel = authStage === 'email' ? 'Send code' : 'Verify code';

  const sessionDetails = useMemo(
    () => [
      {
        label: 'Login',
        value: formatLoginType(session.loginType),
      },
      {
        label: 'Email',
        value: session.sessionEmail ?? 'Unavailable',
      },
      {
        label: 'Expires',
        value: formatSessionExpiration(session.expiresAt),
      },
      {
        label: 'Network',
        value: `${polygonNetwork?.displayName ?? 'Polygon'} (${POLYGON_CHAIN_ID})`,
      },
    ],
    [
      polygonNetwork?.displayName,
      session.expiresAt,
      session.loginType,
      session.sessionEmail,
    ]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollsChildToFocus={false}
        >
          <TouchableWithoutFeedback
            accessible={false}
            onPress={Keyboard.dismiss}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Trails Actions</Text>
                  <Text style={styles.subtitle}>
                    OMS Client React Native SDK
                  </Text>
                </View>
                <DemoButton
                  disabled={!isSignedIn || isBusy}
                  label="Logout"
                  onPress={logout}
                  style={styles.headerButton}
                  variant="outline"
                />
              </View>

              {!isSignedIn ? (
                <Card title="Sign-In">
                  <Text style={styles.status}>{authStatus}</Text>
                  {authStage === 'email' ? (
                    <Field
                      keyboardType="email-address"
                      label="Email"
                      onChangeText={setEmail}
                      value={email}
                    />
                  ) : (
                    <Field
                      keyboardType="number-pad"
                      label="Code"
                      onChangeText={setCode}
                      value={code}
                    />
                  )}
                  <View style={styles.buttonRow}>
                    {authStage === 'code' ? (
                      <DemoButton
                        disabled={isBusy}
                        label="Cancel"
                        onPress={cancelCodeStep}
                        style={styles.rowButton}
                        variant="outline"
                      />
                    ) : null}
                    <DemoButton
                      disabled={isBusy}
                      label={authActionLabel}
                      onPress={authAction}
                      style={styles.rowButton}
                    />
                  </View>
                </Card>
              ) : (
                <>
                  <Card title="Wallet">
                    <WalletAddressDetail
                      address={walletAddress}
                      onCopy={copyWalletAddress}
                    />
                    {sessionDetails.map((detail) => (
                      <SessionDetail
                        key={detail.label}
                        label={detail.label}
                        value={detail.value}
                      />
                    ))}
                  </Card>

                  <Card title="Swap POL to USDC">
                    <BalanceSummary balances={balances} />
                    <Field
                      keyboardType="decimal-pad"
                      label="POL amount"
                      onChangeText={updateSwapPolAmount}
                      value={swapPolAmount}
                    />
                    <View style={styles.buttonRow}>
                      <DemoButton
                        disabled={isBusy}
                        label="Prepare"
                        onPress={prepareSwap}
                        style={styles.rowButton}
                      />
                      <DemoButton
                        disabled={isBusy || !preparedSwap}
                        label="Send"
                        onPress={sendSwap}
                        style={styles.rowButton}
                        variant="outline"
                      />
                    </View>
                    <Text style={styles.feeOption}>
                      Fee option: [first available]
                    </Text>
                    <Text style={styles.status}>{swapStatus}</Text>
                    <TransactionResult
                      disabled={isBusy}
                      onOpen={openExplorer}
                      txHash={lastSwapTransactionHash}
                    />
                    <PreparedSummary prepared={preparedSwap} />
                  </Card>

                  <Card title="Deposit USDC using Earn">
                    <BalanceSummary balances={balances} />
                    <Field
                      keyboardType="decimal-pad"
                      label="USDC amount"
                      onChangeText={updateDepositUsdcAmount}
                      value={depositUsdcAmount}
                    />
                    <View style={styles.buttonRow}>
                      <DemoButton
                        disabled={isBusy}
                        label="Prepare"
                        onPress={prepareDeposit}
                        style={styles.rowButton}
                      />
                      <DemoButton
                        disabled={isBusy || !preparedDeposit}
                        label="Send"
                        onPress={sendDeposit}
                        style={styles.rowButton}
                        variant="outline"
                      />
                    </View>
                    <Text style={styles.feeOption}>
                      Fee option: [first available]
                    </Text>
                    <Text style={styles.status}>{depositStatus}</Text>
                    <TransactionResult
                      disabled={isBusy}
                      onOpen={openExplorer}
                      txHash={lastDepositTransactionHash}
                    />
                    <PreparedYieldSummary prepared={preparedDeposit} />
                  </Card>

                  <Card title="Swap POL to USDC, deposit USDC using Earn in one transaction">
                    <BalanceSummary balances={balances} />
                    <Field
                      keyboardType="decimal-pad"
                      label="POL amount"
                      onChangeText={updateEarnPolAmount}
                      value={earnPolAmount}
                    />
                    <View style={styles.buttonRow}>
                      <DemoButton
                        disabled={isBusy}
                        label="Prepare"
                        onPress={prepareEarn}
                        style={styles.rowButton}
                      />
                      <DemoButton
                        disabled={isBusy || !preparedEarn}
                        label="Send"
                        onPress={sendEarn}
                        style={styles.rowButton}
                        variant="outline"
                      />
                    </View>
                    <Text style={styles.feeOption}>
                      Fee option: [first available]
                    </Text>
                    <Text style={styles.status}>{earnStatus}</Text>
                    <TransactionResult
                      disabled={isBusy}
                      onOpen={openExplorer}
                      txHash={lastEarnTransactionHash}
                    />
                    <PreparedSummary prepared={preparedEarn} />
                  </Card>

                  <EarnPositionsList
                    disabled={isBusy}
                    lastWithdrawTransactionHash={lastWithdrawTransactionHash}
                    onOpenTransaction={openExplorer}
                    onRefresh={refreshSignedInData}
                    onWithdraw={withdrawEarnPosition}
                    positions={earnPositions}
                    status={earnPositionsStatus}
                  />
                </>
              )}

              <Card title="Log">
                <Text selectable style={styles.logText}>
                  {logLines.join('\n')}
                </Text>
                {loadingAction ? (
                  <Text style={styles.loading}>Running: {loadingAction}</Text>
                ) : null}
              </Card>
              <ExplorerBrowser onClose={closeExplorer} url={browserUrl} />
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  balanceRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  balanceSummary: {
    gap: 8,
    marginBottom: 16,
  },
  balanceValue: {
    color: '#E2E8F0',
    flex: 1,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 13,
    textAlign: 'right',
  },
  browserCloseButton: {
    minHeight: 40,
    minWidth: 84,
    paddingHorizontal: 12,
  },
  browserContainer: {
    backgroundColor: '#020617',
    flex: 1,
  },
  browserHeader: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderBottomColor: '#1F2937',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  browserHeaderText: {
    flex: 1,
    gap: 2,
  },
  browserTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  browserUrl: {
    color: '#94A3B8',
    fontSize: 12,
  },
  browserWebView: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  buttonDisabledLabel: {
    color: '#64748B',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderColor: '#475569',
    borderWidth: 1,
  },
  buttonOutlineLabel: {
    color: '#F8FAFC',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
  },
  buttonPrimaryLabel: {
    color: '#FFFFFF',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  container: {
    backgroundColor: '#020617',
    flex: 1,
  },
  content: {
    gap: 16,
    width: '100%',
  },
  copyButton: {
    alignItems: 'center',
    borderColor: '#334155',
    borderRadius: 6,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  copyButtonPressed: {
    opacity: 0.72,
  },
  copyIcon: {
    height: 15,
    position: 'relative',
    width: 15,
  },
  copyIconBack: {
    borderColor: '#CBD5E1',
    borderRadius: 2,
    borderWidth: 1.5,
    height: 10,
    left: 1,
    position: 'absolute',
    top: 1,
    width: 10,
  },
  copyIconFront: {
    backgroundColor: '#111827',
    borderColor: '#CBD5E1',
    borderRadius: 2,
    borderWidth: 1.5,
    height: 10,
    left: 4,
    position: 'absolute',
    top: 4,
    width: 10,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  feeOption: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerButton: {
    marginTop: 16,
    minHeight: 40,
    minWidth: 90,
    paddingHorizontal: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  input: {
    backgroundColor: '#020617',
    borderColor: '#334155',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F8FAFC',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loading: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '700',
  },
  logText: {
    color: '#CBD5E1',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  mono: {
    color: '#CBD5E1',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  preparedSection: {
    borderTopColor: '#1F2937',
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 14,
  },
  positionApy: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '800',
  },
  positionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  positionItem: {
    borderTopColor: '#1F2937',
    borderTopWidth: 1,
    gap: 12,
    paddingTop: 14,
  },
  positionList: {
    gap: 16,
  },
  positionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  positionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  positionTitleGroup: {
    flex: 1,
    gap: 2,
  },
  rowButton: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 52,
    paddingBottom: 36,
  },
  sessionDetailLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
    width: 88,
  },
  sessionDetailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sessionDetailValue: {
    color: '#E2E8F0',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  status: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  transactionResult: {
    gap: 10,
  },
  walletAddressValue: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
});
