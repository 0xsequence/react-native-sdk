import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import type { ViewStyle } from 'react-native';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
  View,
} from 'react-native';
import {
  OMSClient,
  OidcProviders,
  type OmsClientSessionState,
  type OmsNetwork,
  type OmsPendingWalletSelection,
  type OmsWallet,
  type OmsWalletActivationResult,
} from '@0xsequence/oms-react-native-sdk';

WebBrowser.maybeCompleteAuthSession();

const DEMO_PUBLISHABLE_KEY =
  'pk_dev_sdbx_01kqa06hyyetj_01kv5ceg4xefattzmm9fyx04ev';
const DEMO_OIDC_REDIRECT_URI = 'omsclientrndemo://auth/callback';

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

function AuthMethodSeparator() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.authMethodSeparator}
    >
      <View style={styles.authMethodSeparatorLine} />
      <Text style={styles.authMethodSeparatorText}>or</Text>
      <View style={styles.authMethodSeparatorLine} />
    </View>
  );
}

function ManualWalletSelectionToggle({
  enabled,
  disabled,
  onToggle,
}: {
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.toggleRow,
        disabled && styles.toggleDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <View style={[styles.checkbox, enabled && styles.checkboxSelected]}>
        {enabled ? <View style={styles.checkboxDot} /> : null}
      </View>
      <View style={styles.toggleTextGroup}>
        <Text style={styles.toggleLabel}>Manual wallet selection</Text>
        <Text style={styles.toggleCaption}>
          Choose an existing wallet or create one after login.
        </Text>
      </View>
    </Pressable>
  );
}

function WalletSelectionOption({
  wallet,
  disabled,
  onPress,
}: {
  wallet: OmsWallet;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.walletOption,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text selectable style={styles.walletOptionAddress}>
        {wallet.address}
      </Text>
      <Text style={styles.walletOptionMeta}>
        {wallet.type}
        {wallet.reference ? ` · ${wallet.reference}` : ''}
      </Text>
    </Pressable>
  );
}

function NetworkPickerModal({
  networks,
  selectedChainId,
  visible,
  onClose,
  onSelect,
}: {
  networks: OmsNetwork[];
  selectedChainId: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (network: OmsNetwork) => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Network</Text>
            <DemoButton label="Close" onPress={onClose} variant="outline" />
          </View>
          <FlatList
            data={networks}
            keyExtractor={(network) => network.chainId}
            renderItem={({ item }) => {
              const selected = item.chainId === selectedChainId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.networkOption,
                    selected && styles.networkOptionSelected,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <View style={styles.networkOptionText}>
                    <Text style={styles.networkOptionTitle}>
                      {item.displayName}
                    </Text>
                    <Text style={styles.networkOptionSubtitle}>
                      Chain {item.chainId} · {item.nativeTokenSymbol}
                    </Text>
                  </View>
                  <Text style={styles.networkOptionState}>
                    {selected ? 'Selected' : 'Select'}
                  </Text>
                </Pressable>
              );
            }}
            style={styles.networkPickerList}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function App() {
  const oms = useMemo(
    () => new OMSClient({ publishableKey: DEMO_PUBLISHABLE_KEY }),
    []
  );
  const [networks, setNetworks] = useState<OmsNetwork[]>([]);
  const [selectedChainId, setSelectedChainId] = useState('80002');
  const [sdkReady, setSdkReady] = useState(false);
  const [session, setSession] =
    useState<OmsClientSessionState>(SIGNED_OUT_SESSION);
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [authStatus, setAuthStatus] = useState('Waiting for sign-in.');
  const [manualWalletSelection, setManualWalletSelection] = useState(false);
  const [pendingWalletSelection, setPendingWalletSelection] =
    useState<OmsPendingWalletSelection | null>(null);
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
  const [networkPickerVisible, setNetworkPickerVisible] = useState(false);
  const [logLines, setLogLines] = useState(['Ready.']);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const handledRedirectUrlsRef = useRef(new Set<string>());
  const handlingRedirectUrlRef = useRef<string | null>(null);

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
    const nextSession = await oms.wallet.getSession();
    setSession(nextSession);
    if (nextSession.walletAddress) {
      setAuthStatus('Restored persisted wallet session');
      setSignatureStatus('Signature status: ready to sign.');
      setTransactionStatus('Transaction status: ready to send.');
    }
    return nextSession;
  }, [oms]);

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

  const activateWallet = useCallback(
    async (result: OmsWalletActivationResult) => {
      const nextSession = await oms.wallet.getSession();
      const address = nextSession.walletAddress ?? result.walletAddress;
      setPendingWalletSelection(null);
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
    [appendLog, oms]
  );

  const finishOidcRedirectSignIn = useCallback(
    async (callbackUrl: string) => {
      if (
        handlingRedirectUrlRef.current === callbackUrl ||
        handledRedirectUrlsRef.current.has(callbackUrl)
      ) {
        return;
      }

      handlingRedirectUrlRef.current = callbackUrl;
      try {
        setAuthStatus('Completing Google redirect sign-in...');
        const result = await oms.wallet.handleOidcRedirectCallback({
          callbackUrl,
          walletSelection: manualWalletSelection ? 'manual' : 'automatic',
        });

        switch (result.type) {
          case 'completed':
            await activateWallet({
              walletAddress: result.wallet.address,
              wallet: result.wallet,
            });
            setAuthStatus('Google redirect login complete');
            appendLog(
              `Google redirect sign-in complete: ${result.wallet.address}`
            );
            break;
          case 'walletSelection':
            setPendingWalletSelection(result.pendingSelection);
            setCode('');
            setAuthStage('email');
            setAuthStatus('Choose a wallet to finish Google sign-in.');
            appendLog(
              `Google redirect wallet selection available: ${result.pendingSelection.wallets.length} existing wallet(s)`
            );
            break;
          case 'failed':
            throw new Error(result.message);
          case 'noPendingAuth':
            setAuthStatus('No pending Google redirect sign-in.');
            await refreshSession();
            break;
          case 'notOidcRedirectCallback':
            setAuthStatus('Ignored non-auth redirect.');
            break;
        }
      } finally {
        handledRedirectUrlsRef.current.add(callbackUrl);
        handlingRedirectUrlRef.current = null;
      }
    },
    [activateWallet, appendLog, manualWalletSelection, oms, refreshSession]
  );

  const selectNetwork = useCallback(
    (network: OmsNetwork) => {
      setSelectedChainId(network.chainId);
      setNetworkPickerVisible(false);
      setLastSignedMessage(null);
      setLastSignature(null);
      setLastTransactionHash(null);
      setSignatureStatus('Signature status: ready to sign.');
      setTransactionStatus('Transaction status: ready to send.');
      appendLog(
        `Selected network: ${network.displayName} (${network.chainId})`
      );
    },
    [appendLog]
  );

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      await runAction('Initializing SDK', async () => {
        const supportedNetworks = sortNetworks(oms.supportedNetworks);
        if (disposed) return;

        setNetworks(supportedNetworks);
        setSelectedChainId(supportedNetworks[0]?.chainId ?? '80002');
        const nextSession = await refreshSession();
        if (nextSession.walletAddress) {
          appendLog(`Wallet ready: ${nextSession.walletAddress}`);
        }
        setSdkReady(true);
      });
    }

    bootstrap().catch((error: unknown) => {
      appendLog(`!! ${describeError(error)}`);
    });

    return () => {
      disposed = true;
    };
  }, [appendLog, oms, refreshSession, runAction]);

  useEffect(() => {
    if (!sdkReady) return undefined;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isDemoOidcRedirectUrl(url)) {
        runAction(
          'Handle Google redirect sign-in callback',
          () => finishOidcRedirectSignIn(url),
          (error) => {
            setAuthStatus(
              `Google redirect completion failed: ${describeError(error)}`
            );
          }
        );
      }
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url && isDemoOidcRedirectUrl(url)) {
          runAction(
            'Handle Google redirect sign-in callback',
            () => finishOidcRedirectSignIn(url),
            (error) => {
              setAuthStatus(
                `Google redirect completion failed: ${describeError(error)}`
              );
            }
          );
        }
      })
      .catch((error: unknown) => {
        appendLog(`!! ${describeError(error)}`);
      });

    return () => subscription.remove();
  }, [appendLog, finishOidcRedirectSignIn, runAction, sdkReady]);

  const walletAddress = session.walletAddress;
  const isSignedIn = walletAddress != null;
  const isBusy = loadingAction != null;

  const requestEmailCode = () => {
    runAction(
      'Start email sign-in',
      async () => {
        const normalizedEmail = requireText(email, 'Email');
        setAuthStatus('Requesting email code...');
        setPendingWalletSelection(null);
        await oms.wallet.startEmailAuth(normalizedEmail);
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
        const authResult = await oms.wallet.completeEmailAuth({
          code: requireText(code, 'Verification code'),
          walletSelection: manualWalletSelection ? 'manual' : 'automatic',
        });

        if (authResult.type === 'walletSelection') {
          setPendingWalletSelection(authResult.pendingSelection);
          setAuthStatus('Choose a wallet to finish sign-in.');
          appendLog(
            `Wallet selection available: ${authResult.wallets.length} existing wallet(s)`
          );
          return;
        }

        await activateWallet({
          walletAddress: authResult.walletAddress,
          wallet: authResult.wallet,
        });
      },
      (error) => {
        setAuthStatus(`Code confirmation failed: ${describeError(error)}`);
      }
    );
  };

  const startGoogleRedirectSignIn = () => {
    runAction(
      'Start Google redirect sign-in',
      async () => {
        setPendingWalletSelection(null);
        setAuthStatus('Opening Google redirect sign-in...');
        const started = await oms.wallet.startOidcRedirectAuth({
          provider: OidcProviders.google(),
          redirectUri: DEMO_OIDC_REDIRECT_URI,
        });
        appendLog(`Google redirect auth started: state=${started.state}`);

        setAuthStatus('Waiting for Google redirect callback...');
        const result = await WebBrowser.openAuthSessionAsync(
          started.authorizationUrl,
          DEMO_OIDC_REDIRECT_URI
        );

        if (result.type === 'success') {
          await finishOidcRedirectSignIn(result.url);
        } else {
          setAuthStatus('Google redirect sign-in cancelled.');
          appendLog(`Google redirect browser closed: ${result.type}`);
        }
      },
      (error) => {
        setAuthStatus(
          `Google redirect sign-in failed: ${describeError(error)}`
        );
      }
    );
  };

  const cancelCodeStep = () => {
    runAction('Cancel email code step', async () => {
      await oms.wallet.signOut();
      setSession(SIGNED_OUT_SESSION);
      setCode('');
      setPendingWalletSelection(null);
      setAuthStage('email');
      setAuthStatus('Waiting for sign-in.');
    });
  };

  const selectPendingWallet = (wallet: OmsWallet) => {
    const selection = pendingWalletSelection;
    if (!selection) return;
    runAction(
      'Select wallet',
      async () => {
        setAuthStatus('Selecting wallet...');
        await activateWallet(await selection.selectWallet(wallet.id));
      },
      (error) => {
        setAuthStatus(`Wallet selection failed: ${describeError(error)}`);
      }
    );
  };

  const createPendingWallet = () => {
    const selection = pendingWalletSelection;
    if (!selection) return;
    runAction(
      'Create wallet',
      async () => {
        setAuthStatus('Creating wallet...');
        await activateWallet(await selection.createAndSelectWallet());
      },
      (error) => {
        setAuthStatus(`Wallet creation failed: ${describeError(error)}`);
      }
    );
  };

  const logout = () => {
    runAction('Logout', async () => {
      await oms.wallet.signOut();
      setSession(SIGNED_OUT_SESSION);
      setAuthStage('email');
      setPendingWalletSelection(null);
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
        const signature = await oms.wallet.signMessage(
          network.chainId,
          nextMessage
        );
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
        const signedMessage = requireText(lastSignedMessage, 'Signed message');
        const signature = requireText(lastSignature, 'Signature');
        setSignatureStatus('Signature status: verification in progress...');
        const isValid = await oms.wallet.verifyMessageSignature({
          chainId: network.chainId,
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
        const txResult = await oms.wallet.sendTransaction({
          chainId: network.chainId,
          to: requireText(transactionTo, 'Transaction destination'),
          value: decimalToBaseUnits(transactionValue, 18),
        });
        setLastTransactionHash(txResult.txnHash);
        setTransactionStatus(
          txResult.txnHash
            ? `Transaction status: sent on chain ${network.chainId}.`
            : `Transaction status: ${txResult.status}. Transaction hash pending.`
        );
        appendLog(
          txResult.txnHash
            ? `Transaction hash=${txResult.txnHash}`
            : `Transaction ${txResult.txnId} status=${txResult.status}; hash pending`
        );
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
          scrollsChildToFocus={false}
        >
          <View onTouchStart={Keyboard.dismiss} style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Auth Demo</Text>
                <Text style={styles.subtitle}>OMS Client React Native SDK</Text>
                <Text style={styles.subtitle}>Expo example</Text>
              </View>
              <DemoButton
                disabled={isBusy || !isSignedIn}
                label="Logout"
                onPress={logout}
                variant="outline"
              />
            </View>

            {!isSignedIn ? (
              <>
                <Card title="Sign-In">
                  <Text style={styles.status}>{authStatus}</Text>
                  {pendingWalletSelection ? (
                    <Text style={styles.status}>
                      Finish sign-in by selecting a wallet below.
                    </Text>
                  ) : authStage === 'email' ? (
                    <>
                      <ManualWalletSelectionToggle
                        disabled={isBusy}
                        enabled={manualWalletSelection}
                        onToggle={() =>
                          setManualWalletSelection((current) => !current)
                        }
                      />
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
                      <AuthMethodSeparator />
                      <DemoButton
                        disabled={isBusy}
                        label="Sign In With Google"
                        onPress={startGoogleRedirectSignIn}
                        style={styles.fullWidthButton}
                        variant="outline"
                      />
                    </>
                  ) : (
                    <>
                      <ManualWalletSelectionToggle
                        disabled={isBusy}
                        enabled={manualWalletSelection}
                        onToggle={() =>
                          setManualWalletSelection((current) => !current)
                        }
                      />
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

                {pendingWalletSelection ? (
                  <Card title="Select Wallet">
                    <Text style={styles.status}>
                      {pendingWalletSelection.wallets.length > 0
                        ? 'Choose an existing wallet or create a new one.'
                        : 'No existing wallet is available for this account.'}
                    </Text>
                    {pendingWalletSelection.wallets.map((wallet) => (
                      <WalletSelectionOption
                        key={wallet.id}
                        disabled={isBusy}
                        onPress={() => selectPendingWallet(wallet)}
                        wallet={wallet}
                      />
                    ))}
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
                        label="Create New Wallet"
                        onPress={createPendingWallet}
                        style={styles.rowButton}
                      />
                    </View>
                  </Card>
                ) : null}
              </>
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
                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy || networks.length === 0}
                    onPress={() => setNetworkPickerVisible(true)}
                    style={({ pressed }) => [
                      styles.networkPickerButton,
                      (isBusy || networks.length === 0) &&
                        styles.buttonDisabled,
                      pressed && !isBusy && styles.buttonPressed,
                    ]}
                  >
                    <View style={styles.networkPickerText}>
                      <Text style={styles.networkPickerTitle}>
                        {selectedNetwork?.displayName ?? 'No network'}
                      </Text>
                      <Text style={styles.networkPickerSubtitle}>
                        {selectedNetwork
                          ? `Chain ${selectedNetwork.chainId} · ${selectedNetwork.nativeTokenSymbol}`
                          : 'Supported networks unavailable'}
                      </Text>
                    </View>
                    <Text style={styles.networkPickerAction}>Change</Text>
                  </Pressable>
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
        </ScrollView>
      </KeyboardAvoidingView>
      <NetworkPickerModal
        networks={networks}
        onClose={() => setNetworkPickerVisible(false)}
        onSelect={selectNetwork}
        selectedChainId={selectedChainId}
        visible={networkPickerVisible}
      />
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

function isDemoOidcRedirectUrl(url: string): boolean {
  return url.startsWith(DEMO_OIDC_REDIRECT_URI);
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
  authMethodSeparator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  authMethodSeparatorLine: {
    backgroundColor: '#303644',
    flex: 1,
    height: 1,
  },
  authMethodSeparatorText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  toggleRow: {
    alignItems: 'center',
    backgroundColor: '#171B24',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  toggleDisabled: {
    opacity: 0.6,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#64748B',
    borderRadius: 4,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxSelected: {
    backgroundColor: '#F8FAFC',
    borderColor: '#F8FAFC',
  },
  checkboxDot: {
    backgroundColor: '#000000',
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  toggleTextGroup: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleCaption: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  walletOption: {
    backgroundColor: '#0B0D12',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  walletOptionAddress: {
    color: '#7EE787',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  walletOptionMeta: {
    color: '#94A3B8',
    fontSize: 12,
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
  networkPickerButton: {
    alignItems: 'center',
    backgroundColor: '#0B0D12',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  networkPickerText: {
    flex: 1,
    gap: 3,
  },
  networkPickerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  networkPickerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  networkPickerAction: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  pickerSheet: {
    backgroundColor: '#11141B',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: '72%',
    padding: 16,
  },
  pickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  networkPickerList: {
    flexGrow: 0,
  },
  networkOption: {
    alignItems: 'center',
    borderColor: '#303644',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 12,
  },
  networkOptionSelected: {
    backgroundColor: '#1F2937',
    borderColor: '#F8FAFC',
  },
  networkOptionText: {
    flex: 1,
    gap: 3,
  },
  networkOptionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  networkOptionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  networkOptionState: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '700',
  },
});
