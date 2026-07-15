import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import {
  OMSWallet,
  Networks,
  OmsRelayOidcProviders,
  type OMSWalletSessionExpiredEvent,
  type OMSWalletSessionState,
  type FeeOptionSelection,
  type FeeOptionWithBalance,
  type Network,
  type OmsRelayOidcProvider,
  type PendingWalletSelection,
  type WalletAccount,
  type WalletActivationResult,
} from '@polygonlabs/oms-wallet-react-native';
import GoogleIdTokenAuth from '../specs/NativeGoogleIdTokenAuth';

const DEMO_PUBLISHABLE_KEY =
  'pk_dev_sdbx_01kqa06hyyetj_01kv5ceg4xefattzmm9fyx04ev';
const DEMO_OIDC_REDIRECT_URI = 'omsclientrndemo://auth/callback';
const DEMO_GOOGLE_ISSUER = 'https://accounts.google.com';
const DEMO_GOOGLE_WEB_CLIENT_ID =
  '970987756660-0dh5gubqfiugm452raf7mm39qaq639hn.apps.googleusercontent.com';
const DEMO_GOOGLE_IOS_CLIENT_ID =
  '970987756660-remcfkci9g8bh1gjd4alg14elgtnsukt.apps.googleusercontent.com';

const DEFAULT_TRANSACTION_TO = '0xE5E8B483FfC05967FcFed58cc98D053265af6D99';
const PREFERRED_NETWORK_ORDER = ['80002', '137'];
const DEFAULT_SESSION_LIFETIME_SECONDS = '604800';
const SIGNED_OUT_SESSION: OMSWalletSessionState = {
  walletAddress: undefined,
  expiresAt: undefined,
  auth: undefined,
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
      <Text style={styles.authMethodSeparatorText}>or continue with email</Text>
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
  wallet: WalletAccount;
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

function FeeOptionPickerModal({
  options,
  visible,
  onCancel,
  onSelect,
}: {
  options: FeeOptionWithBalance[];
  visible: boolean;
  onCancel: () => void;
  onSelect: (selection: FeeOptionSelection) => void;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <Pressable onPress={onCancel} style={styles.modalBackdrop}>
        <Pressable style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Fee Option</Text>
            <DemoButton label="Cancel" onPress={onCancel} variant="outline" />
          </View>
          <FlatList
            data={options}
            keyExtractor={(option, index) =>
              `${option.selection.token}-${index}`
            }
            renderItem={({ item }) => {
              const selectable = feeOptionIsSelectable(item);
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={!selectable}
                  onPress={() => onSelect(item.selection)}
                  style={({ pressed }) => [
                    styles.feeOption,
                    !selectable && styles.buttonDisabled,
                    pressed && selectable && styles.buttonPressed,
                  ]}
                >
                  <View style={styles.feeOptionText}>
                    <Text numberOfLines={1} style={styles.feeOptionTitle}>
                      {feeOptionTitle(item)}
                    </Text>
                    <Text numberOfLines={2} style={styles.feeOptionSubtitle}>
                      {feeOptionSubtitle(item)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      selectable
                      style={styles.feeOptionToken}
                    >
                      {item.selection.token}
                    </Text>
                  </View>
                  <Text style={styles.networkOptionState}>
                    {selectable ? 'Select' : 'Insufficient'}
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

function NetworkPickerModal({
  networks,
  selectedChainId,
  visible,
  onClose,
  onSelect,
}: {
  networks: Network[];
  selectedChainId: string;
  visible: boolean;
  onClose: () => void;
  onSelect: (network: Network) => void;
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
            keyExtractor={(network) => String(network.id)}
            renderItem={({ item }) => {
              const selected = String(item.id) === selectedChainId;
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
                      Chain {item.id} · {item.nativeTokenSymbol}
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
  const omsWallet = useMemo(
    () => new OMSWallet({ publishableKey: DEMO_PUBLISHABLE_KEY }),
    []
  );
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedChainId, setSelectedChainId] = useState('80002');
  const [sdkReady, setSdkReady] = useState(false);
  const [session, setSession] =
    useState<OMSWalletSessionState>(SIGNED_OUT_SESSION);
  const [authStage, setAuthStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [authStatus, setAuthStatus] = useState('Waiting for sign-in.');
  const [manualWalletSelection, setManualWalletSelection] = useState(false);
  const [sessionLifetimeSeconds, setSessionLifetimeSeconds] = useState(
    DEFAULT_SESSION_LIFETIME_SECONDS
  );
  const [expiredSessionEvent, setExpiredSessionEvent] =
    useState<OMSWalletSessionExpiredEvent | null>(null);
  const [pendingWalletSelection, setPendingWalletSelection] =
    useState<PendingWalletSelection | null>(null);
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
  const [feeOptionPickerOptions, setFeeOptionPickerOptions] = useState<
    FeeOptionWithBalance[]
  >([]);
  const handledRedirectUrlsRef = useRef(new Set<string>());
  const handlingRedirectUrlRef = useRef<string | null>(null);
  const feeOptionSelectionResolverRef = useRef<
    ((selection: FeeOptionSelection | undefined) => void) | null
  >(null);

  const selectedNetwork = useMemo(
    () =>
      networks.find((network) => String(network.id) === selectedChainId) ??
      networks[0],
    [networks, selectedChainId]
  );

  const appendLog = useCallback((messageToAppend: string) => {
    setLogLines((current) => [...current, messageToAppend].slice(-80));
  }, []);

  const resolveFeeOptionSelection = useCallback(
    (selection: FeeOptionSelection | undefined) => {
      const resolver = feeOptionSelectionResolverRef.current;
      feeOptionSelectionResolverRef.current = null;
      setFeeOptionPickerOptions([]);
      resolver?.(selection);
    },
    []
  );

  const selectFeeOption = useCallback(
    async (
      feeOptions: FeeOptionWithBalance[]
    ): Promise<FeeOptionSelection | undefined> => {
      if (feeOptions.length === 0) {
        appendLog('No fee options available.');
        return undefined;
      }

      feeOptionSelectionResolverRef.current?.(undefined);
      setFeeOptionPickerOptions(feeOptions);
      appendLog(`Fee options available: ${feeOptions.length}`);

      return new Promise((resolve) => {
        feeOptionSelectionResolverRef.current = resolve;
      });
    },
    [appendLog]
  );

  const chooseFeeOption = useCallback(
    (selection: FeeOptionSelection) => {
      appendLog(`Selected fee option: ${selection.token}`);
      resolveFeeOptionSelection(selection);
    },
    [appendLog, resolveFeeOptionSelection]
  );

  const cancelFeeOptionSelection = useCallback(() => {
    appendLog('Fee option selection cancelled.');
    resolveFeeOptionSelection(undefined);
  }, [appendLog, resolveFeeOptionSelection]);

  useEffect(() => {
    return () => {
      feeOptionSelectionResolverRef.current?.(undefined);
      feeOptionSelectionResolverRef.current = null;
    };
  }, []);

  const refreshSession = useCallback(async () => {
    const nextSession = await omsWallet.wallet.getSession();
    setSession(nextSession);
    if (nextSession.walletAddress) {
      setExpiredSessionEvent(null);
      setAuthStatus('Restored persisted wallet session');
      setSignatureStatus('Signature status: ready to sign.');
      setTransactionStatus('Transaction status: ready to send.');
    }
    return nextSession;
  }, [omsWallet]);

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

  const requestedSessionLifetimeSeconds = useCallback(
    () => parseSessionLifetimeSeconds(sessionLifetimeSeconds),
    [sessionLifetimeSeconds]
  );

  const clearExpiredSessionState = useCallback(() => {
    setExpiredSessionEvent(null);
  }, []);

  const handleSessionExpired = useCallback(
    (event: OMSWalletSessionExpiredEvent) => {
      const emailHint = expiredSessionEmail(event);

      setExpiredSessionEvent(event);
      setSession(SIGNED_OUT_SESSION);
      setPendingWalletSelection(null);
      setCode('');
      setAuthStage('email');
      setAuthStatus(
        emailHint
          ? `Wallet session expired. Sign in again as ${emailHint}.`
          : 'Wallet session expired. Sign in again.'
      );
      if (emailHint) {
        setEmail(emailHint);
      }
      setLastSignedMessage(null);
      setLastSignature(null);
      setLastTransactionHash(null);
      setSignatureStatus('Signature status: waiting for reauth.');
      setTransactionStatus('Transaction status: waiting for reauth.');
      appendLog(
        `Wallet session expired at ${event.expiredAt}: wallet=${event.session.walletAddress ?? 'none'} email=${sessionEmail(event.session) ?? 'none'}`
      );
    },
    [appendLog]
  );

  const activateWallet = useCallback(
    async (result: WalletActivationResult) => {
      const nextSession = await omsWallet.wallet.getSession();
      const address = nextSession.walletAddress ?? result.walletAddress;
      clearExpiredSessionState();
      setPendingWalletSelection(null);
      setCode('');
      setAuthStage('email');
      setSession(
        nextSession.walletAddress
          ? nextSession
          : { ...SIGNED_OUT_SESSION, walletAddress: address }
      );
      setAuthStatus('Login complete');
      setSignatureStatus('Signature status: ready to sign.');
      setTransactionStatus('Transaction status: ready to send.');
      appendLog(`Wallet ready: ${address}`);
    },
    [appendLog, clearExpiredSessionState, omsWallet]
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
      let callbackHandled = false;
      try {
        setAuthStatus('Completing redirect sign-in...');
        const result = await omsWallet.wallet.handleOidcRedirectCallback({
          callbackUrl,
        });
        callbackHandled = true;

        switch (result.type) {
          case 'completed':
            if (result.result.type === 'walletSelection') {
              setPendingWalletSelection(result.result.pendingSelection);
              setCode('');
              setAuthStage('email');
              setAuthStatus('Choose a wallet to finish sign-in.');
              appendLog(
                `Redirect wallet selection available: ${result.result.pendingSelection.wallets.length} existing wallet(s)`
              );
              break;
            }
            await activateWallet({
              walletAddress: result.result.walletAddress,
              wallet: result.result.wallet,
            });
            setAuthStatus('Redirect login complete');
            appendLog(
              `Redirect sign-in complete: ${result.result.walletAddress}`
            );
            break;
          case 'noPendingAuth':
            setAuthStatus('No pending redirect sign-in.');
            await refreshSession();
            break;
          case 'notOidcRedirectCallback':
            setAuthStatus('Ignored non-auth redirect.');
            break;
        }
      } finally {
        if (callbackHandled) {
          handledRedirectUrlsRef.current.add(callbackUrl);
        }
        handlingRedirectUrlRef.current = null;
      }
    },
    [activateWallet, appendLog, omsWallet, refreshSession]
  );

  const selectNetwork = useCallback(
    (network: Network) => {
      setSelectedChainId(String(network.id));
      setNetworkPickerVisible(false);
      setLastSignedMessage(null);
      setLastSignature(null);
      setLastTransactionHash(null);
      setSignatureStatus('Signature status: ready to sign.');
      setTransactionStatus('Transaction status: ready to send.');
      appendLog(`Selected network: ${network.displayName} (${network.id})`);
    },
    [appendLog]
  );

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      await runAction('Initializing SDK', async () => {
        const supportedNetworks = sortNetworks(Object.values(Networks));
        if (disposed) return;

        setNetworks(supportedNetworks);
        setSelectedChainId(String(supportedNetworks[0]?.id ?? 80002));
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
  }, [appendLog, omsWallet, refreshSession, runAction]);

  useEffect(() => {
    if (!sdkReady) return undefined;

    const sessionExpiredSubscription =
      omsWallet.wallet.onSessionExpired(handleSessionExpired);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isDemoOidcRedirectUrl(url)) {
        runAction(
          'Handle redirect sign-in callback',
          () => finishOidcRedirectSignIn(url),
          (error) => {
            setAuthStatus(
              `Redirect completion failed: ${describeError(error)}`
            );
          }
        );
      }
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url && isDemoOidcRedirectUrl(url)) {
          runAction(
            'Handle redirect sign-in callback',
            () => finishOidcRedirectSignIn(url),
            (error) => {
              setAuthStatus(
                `Redirect completion failed: ${describeError(error)}`
              );
            }
          );
        }
      })
      .catch((error: unknown) => {
        appendLog(`!! ${describeError(error)}`);
      });

    return () => {
      sessionExpiredSubscription.remove();
      subscription.remove();
    };
  }, [
    appendLog,
    finishOidcRedirectSignIn,
    handleSessionExpired,
    omsWallet,
    runAction,
    sdkReady,
  ]);

  const walletAddress = session.walletAddress;
  const isSignedIn = walletAddress != null;
  const isBusy = loadingAction != null;

  const requestEmailCode = () => {
    runAction(
      'Start email sign-in',
      async () => {
        const normalizedEmail = email.trim();
        setAuthStatus('Requesting email code...');
        setPendingWalletSelection(null);
        const emailForSignIn =
          normalizedEmail || expiredSessionEmail(expiredSessionEvent);
        if (!emailForSignIn) {
          throw new Error('Email is required');
        }
        await omsWallet.wallet.startEmailAuth({
          email: emailForSignIn,
          sessionLifetimeSeconds: requestedSessionLifetimeSeconds(),
        });
        setEmail('');
        setAuthStage('code');
        setAuthStatus(`Code requested for ${emailForSignIn}`);
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
        const authResult = await omsWallet.wallet.completeEmailAuth({
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

  const startGoogleIdTokenSignIn = () => {
    runAction(
      'Start Google ID token sign-in',
      async () => {
        setPendingWalletSelection(null);
        setAuthStatus('Requesting Google ID token...');
        const sessionLifetime = requestedSessionLifetimeSeconds();
        const idToken = await GoogleIdTokenAuth.requestGoogleIdToken(
          DEMO_GOOGLE_WEB_CLIENT_ID,
          Platform.OS === 'ios' ? DEMO_GOOGLE_IOS_CLIENT_ID : null
        );
        const authResult = await omsWallet.wallet.signInWithOidcIdToken({
          idToken,
          issuer: DEMO_GOOGLE_ISSUER,
          audience: DEMO_GOOGLE_WEB_CLIENT_ID,
          walletSelection: manualWalletSelection ? 'manual' : 'automatic',
          sessionLifetimeSeconds: sessionLifetime,
          provider: 'google',
          providerLabel: 'Google',
        });

        if (authResult.type === 'walletSelection') {
          setPendingWalletSelection(authResult.pendingSelection);
          setAuthStatus('Choose a wallet to finish Google sign-in.');
          appendLog(
            `Google ID token wallet selection available: ${authResult.wallets.length} existing wallet(s)`
          );
          return;
        }

        await activateWallet({
          walletAddress: authResult.walletAddress,
          wallet: authResult.wallet,
        });
        setAuthStatus('Google ID token login complete');
        appendLog(
          `Google ID token sign-in complete: ${authResult.walletAddress}`
        );
      },
      (error) => {
        setAuthStatus(
          `Google ID token sign-in failed: ${describeError(error)}`
        );
      }
    );
  };

  const startRedirectSignIn = (
    provider: OmsRelayOidcProvider,
    providerLabel: string
  ) => {
    runAction(
      `Start ${providerLabel} redirect sign-in`,
      async () => {
        setPendingWalletSelection(null);
        setAuthStatus(`Opening ${providerLabel} redirect sign-in...`);
        const sessionLifetime = requestedSessionLifetimeSeconds();
        if (!(await InAppBrowser.isAvailable())) {
          throw new Error('In-app browser is not available on this device');
        }

        const started = await omsWallet.wallet.startOidcRedirectAuth({
          provider,
          omsRelayReturnUri: DEMO_OIDC_REDIRECT_URI,
          walletSelection: manualWalletSelection ? 'manual' : 'automatic',
          sessionLifetimeSeconds: sessionLifetime,
          loginHint: expiredSessionEmail(expiredSessionEvent),
        });
        appendLog(`${providerLabel} redirect auth started.`);

        setAuthStatus(`Waiting for ${providerLabel} redirect callback...`);
        const result = await InAppBrowser.openAuth(
          started.authorizationUrl,
          DEMO_OIDC_REDIRECT_URI,
          {
            dismissButtonStyle: 'cancel',
            ephemeralWebSession: false,
            preferredBarTintColor: '#11141B',
            preferredControlTintColor: '#F8FAFC',
            showTitle: true,
            toolbarColor: '#11141B',
            navigationBarColor: '#000000',
            enableUrlBarHiding: true,
            enableDefaultShare: false,
            forceCloseOnRedirection: true,
          }
        ).catch(async (error: unknown) => {
          await omsWallet.wallet.signOut();
          throw error;
        });

        if (result.type === 'success') {
          await finishOidcRedirectSignIn(result.url);
        } else {
          await omsWallet.wallet.signOut();
          setAuthStatus(`${providerLabel} redirect sign-in cancelled.`);
          appendLog(`${providerLabel} redirect browser closed: ${result.type}`);
        }
      },
      (error) => {
        setAuthStatus(
          `${providerLabel} redirect sign-in failed: ${describeError(error)}`
        );
      }
    );
  };

  const cancelCodeStep = () => {
    runAction('Cancel email code step', async () => {
      await omsWallet.wallet.signOut();
      clearExpiredSessionState();
      setSession(SIGNED_OUT_SESSION);
      setCode('');
      setPendingWalletSelection(null);
      setAuthStage('email');
      setAuthStatus('Waiting for sign-in.');
    });
  };

  const selectPendingWallet = (wallet: WalletAccount) => {
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
      await omsWallet.wallet.signOut();
      clearExpiredSessionState();
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
      try {
        await GoogleIdTokenAuth.clearCredentialState();
      } catch (error) {
        appendLog(
          `!! Failed to clear Google credential state: ${describeError(error)}`
        );
      }
    });
  };

  const signCurrentMessage = () => {
    runAction(
      'Sign message',
      async () => {
        const network = requireNetwork(selectedNetwork);
        const nextMessage = requireText(message, 'Message');
        setSignatureStatus('Signature status: signing in progress...');
        const signature = await omsWallet.wallet.signMessage({
          network,
          message: nextMessage,
        });
        setLastSignedMessage(nextMessage);
        setLastSignature(signature);
        setSignatureStatus('Signature status: signed. Ready to verify.');
        appendLog(`Signed message on chain ${network.id}`);
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
        const isValid = await omsWallet.wallet.isValidMessageSignature({
          network,
          message: signedMessage,
          signature,
        });
        setSignatureStatus(
          isValid
            ? `Signature status: valid on chain ${network.id}.`
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
        const txResult = await omsWallet.wallet.sendTransaction({
          network,
          to: requireText(transactionTo, 'Transaction destination'),
          value: decimalToBaseUnits(transactionValue, 18),
          selectFeeOption,
        });
        setLastTransactionHash(txResult.txnHash ?? null);
        setTransactionStatus(
          txResult.txnHash
            ? `Transaction status: sent on chain ${network.id}.`
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
    Linking.openURL(explorerUrlFor(selectedNetwork, lastTransactionHash));
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
                  {expiredSessionEvent ? (
                    <View style={styles.sessionDetails}>
                      <SessionDetail
                        label="Expired"
                        value={formatSessionExpiration(
                          expiredSessionEvent.expiredAt
                        )}
                      />
                      <SessionDetail
                        label="Wallet"
                        value={
                          expiredSessionEvent.session.walletAddress ??
                          'Unavailable'
                        }
                      />
                      <SessionDetail
                        label="Email"
                        value={
                          sessionEmail(expiredSessionEvent.session) ??
                          'Unavailable'
                        }
                      />
                    </View>
                  ) : null}
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
                        keyboardType="number-pad"
                        label="Session lifetime seconds"
                        onChangeText={setSessionLifetimeSeconds}
                        value={sessionLifetimeSeconds}
                      />
                      <View
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={styles.fieldSeparator}
                      />
                      <DemoButton
                        disabled={isBusy}
                        label="Continue with Google ID token"
                        onPress={startGoogleIdTokenSignIn}
                        style={styles.fullWidthButton}
                      />
                      <DemoButton
                        disabled={isBusy}
                        label="Continue with Google redirect"
                        onPress={() =>
                          startRedirectSignIn(
                            OmsRelayOidcProviders.google,
                            'Google'
                          )
                        }
                        style={styles.fullWidthButton}
                        variant="outline"
                      />
                      <DemoButton
                        disabled={isBusy}
                        label="Continue with Apple"
                        onPress={() =>
                          startRedirectSignIn(
                            OmsRelayOidcProviders.apple,
                            'Apple'
                          )
                        }
                        style={styles.fullWidthButton}
                        variant="outline"
                      />
                      <AuthMethodSeparator />
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
                      <ManualWalletSelectionToggle
                        disabled={isBusy}
                        enabled={manualWalletSelection}
                        onToggle={() =>
                          setManualWalletSelection((current) => !current)
                        }
                      />
                      <Field
                        keyboardType="number-pad"
                        label="Session lifetime seconds"
                        onChangeText={setSessionLifetimeSeconds}
                        value={sessionLifetimeSeconds}
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
                      value={formatSessionAuth(session)}
                    />
                    <SessionDetail
                      label="Email"
                      value={sessionEmail(session) ?? 'Unavailable'}
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
                          ? `Chain ${selectedNetwork.id} · ${selectedNetwork.nativeTokenSymbol}`
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
      <FeeOptionPickerModal
        onCancel={cancelFeeOptionSelection}
        onSelect={chooseFeeOption}
        options={feeOptionPickerOptions}
        visible={feeOptionPickerOptions.length > 0}
      />
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

function sortNetworks(networks: Network[]): Network[] {
  return [...networks].sort((left, right) => {
    const leftIndex = PREFERRED_NETWORK_ORDER.indexOf(String(left.id));
    const rightIndex = PREFERRED_NETWORK_ORDER.indexOf(String(right.id));
    if (leftIndex !== -1 || rightIndex !== -1) {
      return normalizeOrder(leftIndex) - normalizeOrder(rightIndex);
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

function normalizeOrder(index: number): number {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function requireNetwork(network: Network | undefined): Network {
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

function parseSessionLifetimeSeconds(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Session lifetime seconds must be a positive whole number');
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Session lifetime seconds must be a positive whole number');
  }

  return parsed;
}

function expiredSessionEmail(
  event: OMSWalletSessionExpiredEvent | null
): string | undefined {
  const email = event == null ? undefined : sessionEmail(event.session)?.trim();
  return email || undefined;
}

function feeOptionTitle(option: FeeOptionWithBalance): string {
  const symbol = feeOptionSymbol(option);
  return `${symbol} fee`;
}

function feeOptionSubtitle(option: FeeOptionWithBalance): string {
  const symbol = feeOptionSymbol(option);
  const fee = `${option.feeOption.displayValue} ${symbol}`;
  const available = option.available
    ? `${option.available} ${symbol}`
    : 'unknown';

  return `Fee ${fee} · Available ${available}`;
}

function feeOptionSymbol(option: FeeOptionWithBalance): string {
  return option.feeOption.token.symbol || option.selection.token;
}

function feeOptionIsSelectable(option: FeeOptionWithBalance): boolean {
  const available = optionalBigInt(option.availableRaw);
  const fee = optionalBigInt(option.feeOption.value);
  return available == null || fee == null || available >= fee;
}

function optionalBigInt(value: string | null | undefined): bigint | null {
  if (!value) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function sessionEmail(session: OMSWalletSessionState): string | undefined {
  return session.auth?.email;
}

function formatSessionAuth(session: OMSWalletSessionState): string {
  switch (session.auth?.type) {
    case 'email':
      return 'Email';
    case 'oidc': {
      const provider =
        session.auth.providerLabel ?? session.auth.provider ?? 'OIDC';
      return `${provider} (${session.auth.flow})`;
    }
    default:
      return 'Unavailable';
  }
}

function formatSessionExpiration(expiresAt: string | undefined): string {
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

function explorerUrlFor(network: Network, txHash: string): string {
  return `${network.explorerUrl}/tx/${txHash}`;
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
  fieldSeparator: {
    backgroundColor: '#303644',
    height: 1,
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
  feeOption: {
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
  feeOptionText: {
    flex: 1,
    gap: 4,
  },
  feeOptionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  feeOptionSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  feeOptionToken: {
    color: '#94A3B8',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 11,
    lineHeight: 16,
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
