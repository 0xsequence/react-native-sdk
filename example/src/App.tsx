import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewStyle } from 'react-native';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  LogBox,
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
import {
  completeEmailAuth,
  configure,
  getSupportedNetworks,
  getSession,
  sendTransaction,
  signMessage,
  signOut,
  startEmailAuth,
  verifyMessageSignature,
  type OmsClientSessionState,
  type OmsNetwork,
} from 'oms-client-react-native-sdk';

const DEMO_PROJECT_ACCESS_KEY = 'AQAAAAAAAAK2JvvZhWqZ51riasWBftkrVXE';
const DEMO_ENVIRONMENT = {
  apiRpcUrl: 'https://dev-api.sequence.app/rpc/API',
  indexerUrlTemplate: 'https://dev-{value}-indexer.sequence.app/rpc/Indexer/',
  scope: 'proj_1',
};

const DEFAULT_TRANSACTION_TO = '0xE5E8B483FfC05967FcFed58cc98D053265af6D99';
const PREFERRED_NETWORK_ORDER = ['80002', '137'];
const SIGNED_OUT_SESSION: OmsClientSessionState = {
  walletAddress: null,
  expiresAt: null,
  loginType: null,
  sessionEmail: null,
};

LogBox.ignoreLogs(['SafeAreaView has been deprecated']);

type ButtonVariant = 'primary' | 'outline';

type DemoButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
};

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
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
      />
    </View>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

export default function App() {
  const [networks, setNetworks] = useState<OmsNetwork[]>([]);
  const [selectedChainId, setSelectedChainId] = useState('80002');
  const [session, setSession] =
    useState<OmsClientSessionState>(SIGNED_OUT_SESSION);
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [authStatus, setAuthStatus] = useState('Waiting for sign-in.');
  const [message, setMessage] = useState('test');
  const [lastSignedMessage, setLastSignedMessage] = useState<string | null>(
    null
  );
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [signatureStatus, setSignatureStatus] = useState(
    'Signature status: waiting for a message.'
  );
  const [transactionTo, setTransactionTo] = useState(DEFAULT_TRANSACTION_TO);
  const [transactionValue, setTransactionValue] = useState('0');
  const [lastTransactionHash, setLastTransactionHash] = useState<string | null>(
    null
  );
  const [transactionStatus, setTransactionStatus] = useState(
    'Transaction status: waiting to send.'
  );
  const [logLines, setLogLines] = useState(['Ready.']);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const selectedNetwork = useMemo(
    () =>
      networks.find((network) => network.chainId === selectedChainId) ??
      networks[0],
    [networks, selectedChainId]
  );

  const appendLog = useCallback((messageToAppend: string) => {
    setLogLines((current) => [...current, messageToAppend].slice(-80));
  }, []);

  const refreshSession = useCallback(async () => {
    const nextSession = await getSession();
    setSession(nextSession);
    if (nextSession.walletAddress) {
      setAuthStatus('Restored persisted wallet session');
      setSignatureStatus('Signature status: ready to sign.');
      setTransactionStatus('Transaction status: ready to send.');
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

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      await runAction('Initializing SDK', async () => {
        await configure({
          projectAccessKey: DEMO_PROJECT_ACCESS_KEY,
          environment: DEMO_ENVIRONMENT,
        });

        const supportedNetworks = sortNetworks(await getSupportedNetworks());
        if (disposed) return;

        setNetworks(supportedNetworks);
        setSelectedChainId(supportedNetworks[0]?.chainId ?? '80002');
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
        setAuthStatus(`Email sign-in failed: ${describeError(error)}`);
      }
    );
  };

  const confirmCode = () => {
    runAction(
      'Confirm code and resolve wallet',
      async () => {
        setAuthStatus('Confirming code and resolving wallet...');
        const wallet = await completeEmailAuth(
          requireText(code, 'Verification code')
        );
        const nextSession = await getSession();
        const address = nextSession.walletAddress ?? wallet.address;
        setCode('');
        setAuthStage('email');
        setSession(
          nextSession.walletAddress
            ? nextSession
            : { ...SIGNED_OUT_SESSION, walletAddress: address }
        );
        setAuthStatus('Email login complete');
        setSignatureStatus('Signature status: ready to sign.');
        setTransactionStatus('Transaction status: ready to send.');
        appendLog(`Wallet ready: ${address}`);
      },
      (error) => {
        setAuthStatus(`Code confirmation failed: ${describeError(error)}`);
      }
    );
  };

  const cancelCodeStep = () => {
    runAction('Cancel email code step', async () => {
      await signOut();
      setSession(SIGNED_OUT_SESSION);
      setCode('');
      setAuthStage('email');
      setAuthStatus('Waiting for sign-in.');
    });
  };

  const logout = () => {
    runAction('Logout', async () => {
      await signOut();
      setSession(SIGNED_OUT_SESSION);
      setAuthStage('email');
      setAuthStatus('Waiting for sign-in.');
      setLastSignedMessage(null);
      setLastSignature(null);
      setSignatureStatus('Signature status: waiting for a message.');
      setLastTransactionHash(null);
      setTransactionStatus('Transaction status: waiting to send.');
      appendLog('Logged out.');
    });
  };

  const signCurrentMessage = () => {
    runAction(
      'Sign message',
      async () => {
        const network = requireNetwork(selectedNetwork);
        const nextMessage = requireText(message, 'Message');
        setSignatureStatus('Signature status: signing in progress...');
        const signature = await signMessage(network.chainId, nextMessage);
        setLastSignedMessage(nextMessage);
        setLastSignature(signature);
        setSignatureStatus('Signature status: signed. Ready to verify.');
        appendLog(`Signed message on chain ${network.chainId}`);
      },
      () => {
        setSignatureStatus('Signature status: signing failed.');
      }
    );
  };

  const verifyLastSignature = () => {
    runAction(
      'Verify last signature',
      async () => {
        const network = requireNetwork(selectedNetwork);
        const address = requireText(walletAddress, 'Wallet address');
        const signedMessage = requireText(lastSignedMessage, 'Signed message');
        const signature = requireText(lastSignature, 'Signature');
        setSignatureStatus('Signature status: verification in progress...');
        const isValid = await verifyMessageSignature({
          chainId: network.chainId,
          walletAddress: address,
          message: signedMessage,
          signature,
        });
        setSignatureStatus(
          isValid
            ? `Signature status: valid on chain ${network.chainId}.`
            : 'Signature status: invalid.'
        );
        appendLog(`Verify signature => isValid=${String(isValid)}`);
      },
      () => {
        setSignatureStatus('Signature status: verification failed.');
      }
    );
  };

  const sendCurrentTransaction = () => {
    runAction(
      'Send transaction',
      async () => {
        const network = requireNetwork(selectedNetwork);
        setTransactionStatus('Transaction status: sending in progress...');
        const txHash = await sendTransaction({
          chainId: network.chainId,
          to: requireText(transactionTo, 'Transaction destination'),
          value: decimalToBaseUnits(transactionValue, 18),
        });
        setLastTransactionHash(txHash);
        setTransactionStatus(
          `Transaction status: sent on chain ${network.chainId}.`
        );
        appendLog(`Transaction hash=${txHash}`);
      },
      () => {
        setTransactionStatus('Transaction status: send failed.');
      }
    );
  };

  const openExplorer = () => {
    if (!lastTransactionHash || !selectedNetwork) return;
    Linking.openURL(
      explorerUrlFor(selectedNetwork.chainId, lastTransactionHash)
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback
            accessible={false}
            onPress={Keyboard.dismiss}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Auth Demo</Text>
                  <Text style={styles.subtitle}>
                    OMS Client React Native SDK
                  </Text>
                </View>
                <DemoButton
                  disabled={isBusy || !isSignedIn}
                  label="Logout"
                  onPress={logout}
                  variant="outline"
                />
              </View>

              {!isSignedIn ? (
                <Card title="Sign-In">
                  <Text style={styles.status}>{authStatus}</Text>
                  {authStage === 'email' ? (
                    <>
                      <Field
                        keyboardType="email-address"
                        label="Email"
                        onChangeText={setEmail}
                        value={email}
                      />
                      <DemoButton
                        disabled={isBusy}
                        label="Send Login Code"
                        onPress={requestEmailCode}
                        style={styles.fullWidthButton}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.sectionLabel}>Verification Code</Text>
                      <Field
                        keyboardType="number-pad"
                        label="Enter code"
                        onChangeText={setCode}
                        value={code}
                      />
                      <View style={styles.row}>
                        <DemoButton
                          disabled={isBusy}
                          label="Cancel"
                          onPress={cancelCodeStep}
                          style={styles.rowButton}
                          variant="outline"
                        />
                        <DemoButton
                          disabled={isBusy}
                          label="Send"
                          onPress={confirmCode}
                          style={styles.rowButton}
                        />
                      </View>
                    </>
                  )}
                </Card>
              ) : (
                <>
                  <Card title="Wallet">
                    <Text selectable style={styles.walletText}>
                      Wallet address:{'\n'}
                      {walletAddress}
                    </Text>
                    <View style={styles.sessionDetails}>
                      <SessionDetail
                        label="Login type"
                        value={formatLoginType(session.loginType)}
                      />
                      <SessionDetail
                        label="Email"
                        value={session.sessionEmail ?? 'Unavailable'}
                      />
                      <SessionDetail
                        label="Expiration"
                        value={formatSessionExpiration(session.expiresAt)}
                      />
                    </View>
                    <Text style={styles.fieldLabel}>Network</Text>
                    <View style={styles.networkList}>
                      {networks.map((network) => (
                        <DemoButton
                          key={network.chainId}
                          disabled={isBusy}
                          label={`${network.displayName} (${network.chainId})`}
                          onPress={() => {
                            setSelectedChainId(network.chainId);
                            setLastSignedMessage(null);
                            setLastSignature(null);
                            setLastTransactionHash(null);
                            setSignatureStatus(
                              'Signature status: ready to sign.'
                            );
                            setTransactionStatus(
                              'Transaction status: ready to send.'
                            );
                            appendLog(
                              `Selected network: ${network.displayName} (${network.chainId})`
                            );
                          }}
                          style={styles.networkButton}
                          variant={
                            network.chainId === selectedChainId
                              ? 'primary'
                              : 'outline'
                          }
                        />
                      ))}
                    </View>
                  </Card>

                  <Card title="Signature">
                    <Field
                      label="Message to sign"
                      multiline
                      onChangeText={setMessage}
                      value={message}
                    />
                    <View style={styles.row}>
                      <DemoButton
                        disabled={isBusy}
                        label="Sign Message"
                        onPress={signCurrentMessage}
                        style={styles.rowButton}
                      />
                      <DemoButton
                        disabled={isBusy || !lastSignature}
                        label="Verify Signature"
                        onPress={verifyLastSignature}
                        style={styles.rowButton}
                        variant="outline"
                      />
                    </View>
                    <Text selectable style={styles.mono}>
                      Last signature: {lastSignature ?? 'none'}
                    </Text>
                    <Text style={styles.status}>{signatureStatus}</Text>
                  </Card>

                  <Card title="Transaction">
                    <Field
                      label="Transaction destination"
                      onChangeText={setTransactionTo}
                      value={transactionTo}
                    />
                    <Field
                      keyboardType="decimal-pad"
                      label="Transaction value"
                      onChangeText={setTransactionValue}
                      value={transactionValue}
                    />
                    <DemoButton
                      disabled={isBusy}
                      label="Send Transaction"
                      onPress={sendCurrentTransaction}
                      style={styles.fullWidthButton}
                    />
                    <Text selectable style={styles.mono}>
                      Last tx hash: {lastTransactionHash ?? 'none'}
                    </Text>
                    <Text style={styles.status}>{transactionStatus}</Text>
                    <DemoButton
                      disabled={isBusy || !lastTransactionHash}
                      label="Open Tx In Explorer"
                      onPress={openExplorer}
                      style={styles.fullWidthButton}
                      variant="outline"
                    />
                  </Card>
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
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function sortNetworks(networks: OmsNetwork[]): OmsNetwork[] {
  return [...networks].sort((left, right) => {
    const leftIndex = PREFERRED_NETWORK_ORDER.indexOf(left.chainId);
    const rightIndex = PREFERRED_NETWORK_ORDER.indexOf(right.chainId);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return normalizeOrder(leftIndex) - normalizeOrder(rightIndex);
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function normalizeOrder(index: number): number {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function requireNetwork(network: OmsNetwork | undefined): OmsNetwork {
  if (!network) {
    throw new Error('Network is required');
  }
  return network;
}

function requireText(value: string | null, label: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

function formatLoginType(
  loginType: OmsClientSessionState['loginType']
): string {
  switch (loginType) {
    case 'Email':
      return 'Email';
    case 'GoogleAuth':
      return 'Google Auth';
    case 'Oidc':
      return 'OIDC';
    default:
      return 'Unavailable';
  }
}

function formatSessionExpiration(expiresAt: string | null): string {
  if (!expiresAt) {
    return 'Unavailable';
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return expiresAt;
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZoneName: 'short',
    year: 'numeric',
  });
}

function decimalToBaseUnits(value: string, decimals: number): string {
  const normalized = value.trim() || '0';
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Transaction value must be a non-negative decimal');
  }

  const [whole = '0', fraction = ''] = normalized.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Transaction value supports at most ${decimals} decimals`);
  }

  const paddedFraction = fraction.padEnd(decimals, '0');
  return `${whole}${paddedFraction}`.replace(/^0+/, '') || '0';
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function explorerUrlFor(chainId: string, txHash: string): string {
  if (chainId === '137') {
    return `https://polygonscan.com/tx/${txHash}`;
  }
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    gap: 14,
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop:
      Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 20 : 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#11141B',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0B0D12',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    color: '#F8FAFC',
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputMultiline: {
    minHeight: 86,
  },
  button: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  buttonOutline: {
    backgroundColor: '#171B24',
    borderColor: '#303644',
  },
  buttonPressed: {
    opacity: 0.76,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonPrimaryLabel: {
    color: '#000000',
  },
  buttonOutlineLabel: {
    color: '#F8FAFC',
  },
  buttonDisabledLabel: {
    color: '#94A3B8',
  },
  fullWidthButton: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowButton: {
    flex: 1,
  },
  sectionLabel: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  walletText: {
    color: '#7EE787',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 13,
    lineHeight: 19,
  },
  sessionDetails: {
    gap: 8,
  },
  sessionDetailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sessionDetailLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 76,
    textTransform: 'uppercase',
  },
  sessionDetailValue: {
    color: '#E2E8F0',
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  status: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
  },
  mono: {
    color: '#CBD5E1',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  logText: {
    color: '#CBD5E1',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
    minHeight: 160,
  },
  loading: {
    color: '#7DD3FC',
    fontSize: 12,
  },
  networkList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  networkButton: {
    flexGrow: 1,
    minWidth: 140,
  },
});
