import {
  Button,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Clipboard,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  useSequence,
  type SendTransactionResult,
  type Transaction,
  getExplorerUrl,
  type Relayer,
  type Signers,
} from '@0xsequence/react-native-sdk';
import { useState, useMemo, useEffect } from 'react';
import { AbiFunction, Address } from 'ox';
import { createPublicClient, http, type PublicClient } from 'viem';

import {
  DEMO_TYPED_DATA,
  EMITTER_ABI,
  getNFTContractAddress,
  mint,
  getPermissionsForNFTMint,
  ACTIVE_CHAINS,
} from './example-constants';
import ChainPicker from './ChainPicker';
import { useTokenBalances } from './hooks/useTokenBalances';
import FeeOptionPicker from './components/FeeOptionPicker';

// A simple utility to shorten addresses
const shortenAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

export default function Connected() {
  const {
    walletAddress,
    userEmail,
    loginMethod,
    chainId,
    setChainId,
    disconnect,
    signMessage,
    signTypedData,
    hasPermission,
    addExplicitSession,
    sendTransaction,
    sessions,
  } = useSequence();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [hasMintPermission, setHasMintPermission] = useState(false);
  const [isPermissionCheckLoading, setIsPermissionCheckLoading] =
    useState(true);

  const [isCopied, setIsCopied] = useState(false);
  const [preparedTx, setPreparedTx] = useState<Extract<
    SendTransactionResult,
    { isFeeRequired: true }
  > | null>(null);
  const [preparedTxOrigin, setPreparedTxOrigin] = useState<
    'mint' | 'emitter' | null
  >(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [emitterTxHash, setEmitterTxHash] = useState<string | null>(null);

  const currentChain = useMemo(
    () => ACTIVE_CHAINS.find((c) => c.id === chainId) || ACTIVE_CHAINS[0]!,
    [chainId]
  );

  // Clear transaction hashes when the chain changes
  useEffect(() => {
    setMintTxHash(null);
    setEmitterTxHash(null);
  }, [chainId]);

  const mintTransaction = useMemo<Transaction>(() => {
    if (!walletAddress) {
      return {
        to: '0x0000000000000000000000000000000000000000' as Address.Address,
        data: '0x',
        value: 0n,
      };
    }
    return {
      to: getNFTContractAddress(chainId),
      data: AbiFunction.encodeData(mint, [walletAddress as `0x${string}`]),
      value: 0n,
    };
  }, [chainId, walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setHasMintPermission(false);
      setIsPermissionCheckLoading(false);
      return;
    }

    const checkPermission = async () => {
      setIsPermissionCheckLoading(true);
      try {
        const hasPerms = await hasPermission([mintTransaction]);
        setHasMintPermission(hasPerms);
      } catch (e) {
        console.error('Error checking permission:', e);
        setHasMintPermission(false);
      } finally {
        setIsPermissionCheckLoading(false);
      }
    };

    checkPermission();
  }, [hasPermission, mintTransaction, walletAddress, sessions]);

  const publicClient = useMemo(
    () => createPublicClient({ chain: currentChain, transport: http() }),
    [currentChain]
  );

  // Prepare token list for balance fetching when fee options are available
  const feeTokenAddresses = useMemo(() => {
    if (!preparedTx) return [];
    return preparedTx.feeOptions.map(
      (opt) => opt.token.contractAddress as `0x${string}`
    );
  }, [preparedTx]);

  // Fetch balances for the fee tokens
  const {
    balances: feeTokenBalances,
    isLoading: isBalancesLoading,
    error: balancesError,
  } = useTokenBalances(
    publicClient as PublicClient,
    feeTokenAddresses,
    walletAddress
  );

  const handleCopyAddress = () => {
    if (walletAddress) {
      Clipboard.setString(walletAddress);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    }
  };

  const openExplorer = (txHash: string) => {
    const url = getExplorerUrl(chainId, txHash);
    WebBrowser.openBrowserAsync(url);
  };

  const handleSignMessage = async () => {
    setIsActionLoading(true);
    try {
      const message = 'Hello Sequence!';
      const result = await signMessage(message);
      const isValid = await publicClient.verifyMessage({
        address: walletAddress!,
        message,
        signature: result.signature,
      });
      Alert.alert(
        'Signature Verification',
        `Signature valid: ${isValid}\n\nSigned by: ${result.walletAddress}`
      );
    } catch (e) {
      console.error('Error signing message:', e);
      Alert.alert('Signing Error', 'Failed to sign the message.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSignTypedData = async () => {
    setIsActionLoading(true);
    try {
      const typedDataToSign = {
        ...DEMO_TYPED_DATA,
        domain: { ...DEMO_TYPED_DATA.domain, chainId: chainId },
      };
      const result = await signTypedData(typedDataToSign as any);
      const isValid = await publicClient.verifyTypedData({
        address: walletAddress!,
        ...typedDataToSign,
        signature: result.signature,
      } as any);
      Alert.alert(
        'Typed Data Signature Verification',
        `Signature valid: ${isValid}\n\nSigned by: ${result.walletAddress}`
      );
    } catch (e) {
      console.error('Error signing typed data:', e);
      Alert.alert('Signing Error', 'Failed to sign the typed data.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const executeTransaction = async (
    tx: Transaction,
    origin: 'mint' | 'emitter'
  ) => {
    setIsActionLoading(true);
    setPreparedTx(null);
    setMintTxHash(null);
    setEmitterTxHash(null);

    try {
      const result = await sendTransaction([tx]);
      if (result.isFeeRequired) {
        setPreparedTx(result);
        setPreparedTxOrigin(origin);
      } else {
        Alert.alert('Transaction Sent', `Transaction hash: ${result.txHash}`);
        if (origin === 'mint') setMintTxHash(result.txHash);
        else setEmitterTxHash(result.txHash);
      }
    } catch (e) {
      console.error('Error sending transaction:', e);
      Alert.alert('Transaction Error', 'Failed to send the transaction.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAddPermission = async () => {
    setIsActionLoading(true);
    try {
      const permissions = getPermissionsForNFTMint(
        chainId
      ) as Signers.Session.ExplicitParams;
      await addExplicitSession(permissions);
    } catch (e) {
      console.error('Error adding permission:', e);
      Alert.alert('Error', 'Failed to add mint permission.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMintNFT = () => {
    executeTransaction(mintTransaction, 'mint');
  };

  // This is a test txn to demonstrate sending a transaction via the wallet for a txn without permissions
  // Any call to a contract method that does not have explicit permissions will work here
  const handleCallEmitter = () => {
    const tx = {
      to: '0xb7bE532959236170064cf099e1a3395aEf228F44' as Address.Address,
      data: AbiFunction.getSelector(EMITTER_ABI[0]), // explicitEmit()
      value: 0n,
    };
    executeTransaction(tx, 'emitter');
  };

  const handleSendWithFee = async (feeOption: Relayer.FeeOption) => {
    if (!preparedTx) return;

    // Immediately hide the fee picker and show a global loading state
    const txToSend = preparedTx;
    setPreparedTx(null);
    setIsActionLoading(true);

    try {
      const txHash = await txToSend.send(feeOption);
      Alert.alert('Transaction Sent', `Transaction hash: ${txHash}`);
      if (preparedTxOrigin === 'mint') {
        setMintTxHash(txHash);
      } else {
        setEmitterTxHash(txHash);
      }
    } catch (e) {
      console.error('Error sending transaction with fee:', e);
      Alert.alert('Transaction Error', 'Failed to send transaction with fee.');
    } finally {
      setPreparedTxOrigin(null);
      setIsActionLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      {preparedTx ? (
        <FeeOptionPicker
          feeOptions={preparedTx.feeOptions}
          balances={feeTokenBalances}
          isLoadingBalances={isBalancesLoading}
          balancesError={balancesError}
          onSelectFee={handleSendWithFee}
          onCancel={() => setPreparedTx(null)}
          isActionLoading={isActionLoading}
        />
      ) : (
        <>
          <Text style={styles.cardTitle}>Connected!</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wallet:</Text>
            <View style={styles.addressContainer}>
              <Text style={styles.infoValue}>
                {shortenAddress(walletAddress!)}
              </Text>
              <TouchableOpacity
                onPress={handleCopyAddress}
                style={styles.copyButton}
              >
                <Text style={styles.copyButtonText}>
                  {isCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{userEmail || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Login:</Text>
            <Text style={styles.infoValue}>{loginMethod || 'N/A'}</Text>
          </View>

          <ChainPicker selectedChainId={chainId} onSelectChain={setChainId} />

          <View style={styles.actionsContainer}>
            <Button
              title="Sign Message"
              onPress={handleSignMessage}
              disabled={isActionLoading}
              color="#6B59CC"
            />
            <Button
              title="Sign Typed Data"
              onPress={handleSignTypedData}
              disabled={isActionLoading}
              color="#6B59CC"
            />
            <View style={styles.permissionedActionContainer}>
              {isPermissionCheckLoading ? (
                <ActivityIndicator size="small" color="#6B59CC" />
              ) : hasMintPermission ? (
                <Button
                  title="Send txn within app"
                  onPress={handleMintNFT}
                  disabled={isActionLoading}
                  color="#6B59CC"
                />
              ) : (
                <Button
                  title="Add Mint Permission"
                  onPress={handleAddPermission}
                  disabled={isActionLoading || isPermissionCheckLoading}
                  color="#F5B94A"
                />
              )}
              {mintTxHash && !isPermissionCheckLoading && (
                <View style={styles.txHashButton}>
                  <Button
                    title={`View Tx: ${shortenAddress(mintTxHash)}`}
                    onPress={() => openExplorer(mintTxHash)}
                    color="#007AFF"
                  />
                </View>
              )}
            </View>
            <View>
              <Button
                title="Send txn via wallet"
                onPress={handleCallEmitter}
                disabled={isActionLoading}
                color="#6B59CC"
              />
              {emitterTxHash && (
                <View style={styles.txHashButton}>
                  <Button
                    title={`View Tx: ${shortenAddress(emitterTxHash)}`}
                    onPress={() => openExplorer(emitterTxHash)}
                    color="#007AFF"
                  />
                </View>
              )}
            </View>
          </View>
        </>
      )}

      {isActionLoading && !preparedTx && (
        <ActivityIndicator style={styles.loader} size="small" color="#6B59CC" />
      )}
      <TouchableOpacity
        style={[styles.secondaryButton, styles.disconnectButton]}
        onPress={disconnect}
        disabled={isActionLoading || !!preparedTx}
      >
        <Text style={styles.secondaryButtonText}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  infoLabel: {
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#111',
    fontWeight: '600',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#eee',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#555',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsContainer: {
    marginTop: 12,
    width: '100%',
    gap: 12,
  },
  permissionedActionContainer: {
    minHeight: 36, // Approximate height of a button
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginTop: 16,
  },
  disconnectButton: {
    marginTop: 24,
  },
  txHashButton: {
    marginTop: 8,
  },
});
