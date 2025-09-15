import {
  Button,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  useSequence,
  type SendTransactionResult,
  type Transaction,
  getExplorerUrl,
} from 'react-native-sdk';
import { useState } from 'react';
import { AbiFunction } from 'ox';
import * as WebBrowser from 'expo-web-browser';

import {
  DEMO_TYPED_DATA,
  EMITTER_CONTRACT_ADDRESS,
  getRestrictivePermissions,
  EMITTER_ABI,
} from './example-constants';

// A simple utility to shorten addresses
const shortenAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

export default function Connect() {
  const {
    isInitializing,
    isInitialized,
    walletAddress,
    userEmail,
    loginMethod,
    chainId,
    connect,
    disconnect,
    signMessage,
    signTypedData,
    sendTransaction,
  } = useSequence();

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [preparedTx, setPreparedTx] = useState<Extract<
    SendTransactionResult,
    { isFeeRequired: true }
  > | null>(null);

  // State to track which transaction flow is waiting for fee selection
  const [preparedTxOrigin, setPreparedTxOrigin] = useState<
    'permission' | 'no_permission' | null
  >(null);

  // State for the resulting transaction hashes
  const [permissionTxHash, setPermissionTxHash] = useState<string | null>(null);
  const [noPermissionTxHash, setNoPermissionTxHash] = useState<string | null>(
    null
  );

  const handleConnect = async () => {
    try {
      await connect({
        loginMethod: 'google',
        permissions: getRestrictivePermissions(chainId),
      });
    } catch (e) {
      console.error('Error during connect:', e);
      Alert.alert('Connection Error', 'Failed to connect. Please try again.');
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
      Alert.alert(
        'Signature Success',
        `Signed by: ${result.walletAddress}\nSignature: ${result.signature}`
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
        domain: {
          ...DEMO_TYPED_DATA.domain,
          chainId: chainId,
        },
      };
      const result = await signTypedData(typedDataToSign as any);
      Alert.alert(
        'Typed Data Signature Success',
        `Signed by: ${result.walletAddress}\nSignature: ${result.signature}`
      );
    } catch (e) {
      console.error('Error signing typed data:', e);
      Alert.alert('Signing Error', 'Failed to sign the typed data.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // A generic handler to execute a transaction and manage UI state
  const executeTransaction = async (
    tx: Transaction,
    origin: 'permission' | 'no_permission'
  ) => {
    setIsActionLoading(true);
    setPreparedTx(null);
    setPermissionTxHash(null);
    setNoPermissionTxHash(null);

    try {
      const result = await sendTransaction([tx]);

      if (result.isFeeRequired) {
        setPreparedTx(result);
        setPreparedTxOrigin(origin); // Remember which button triggered this
        setIsActionLoading(false);
      } else {
        Alert.alert('Transaction Sent', `Transaction hash: ${result.txHash}`);
        if (origin === 'permission') {
          setPermissionTxHash(result.txHash);
        } else {
          setNoPermissionTxHash(result.txHash);
        }
        setIsActionLoading(false);
      }
    } catch (e) {
      console.error('Error sending transaction:', e);
      Alert.alert('Transaction Error', 'Failed to send the transaction.');
      setIsActionLoading(false);
    }
  };

  const handleSendTransactionWithPermission = () => {
    const tx = {
      to: EMITTER_CONTRACT_ADDRESS as `0x${string}`,
      data: AbiFunction.getSelector(EMITTER_ABI[0]), // Corresponds to `explicitEmit()`
      value: 0n,
    };
    executeTransaction(tx, 'permission');
  };

  const handleSendTransactionWithoutPermission = () => {
    const tx = {
      to: EMITTER_CONTRACT_ADDRESS as `0x${string}`,
      data: AbiFunction.getSelector(EMITTER_ABI[1]), // Corresponds to `implicitEmit()`
      value: 0n,
    };
    executeTransaction(tx, 'no_permission');
  };

  const handleSendWithFee = async (feeOption: any) => {
    if (!preparedTx) return;

    setIsActionLoading(true);
    try {
      const txHash = await preparedTx.send(feeOption);
      Alert.alert(
        'Transaction Sent',
        `Transaction hash: ${txHash}\nCheck your block explorer!`
      );

      if (preparedTxOrigin === 'permission') {
        setPermissionTxHash(txHash);
      } else {
        setNoPermissionTxHash(txHash);
      }
    } catch (e) {
      console.error('Error sending transaction with fee:', e);
      Alert.alert(
        'Transaction Error',
        'Failed to send the transaction with the selected fee.'
      );
    } finally {
      setPreparedTx(null);
      setPreparedTxOrigin(null);
      setIsActionLoading(false);
    }
  };

  if (isInitializing) {
    return <ActivityIndicator size="large" color="#6B59CC" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sequence SDK Demo</Text>
      <Text style={styles.subtitle}>React Native</Text>

      {!isInitialized ? (
        <TouchableOpacity style={styles.primaryButton} onPress={handleConnect}>
          <Text style={styles.buttonText}>Connect with Google</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          {preparedTx ? (
            <View style={styles.feeContainer}>
              <Text style={styles.cardTitle}>Choose Fee</Text>
              {preparedTx.feeOptions.map((option) => (
                <TouchableOpacity
                  key={option.token.symbol}
                  style={styles.primaryButton}
                  onPress={() => handleSendWithFee(option)}
                  disabled={isActionLoading}
                >
                  <Text style={styles.buttonText}>
                    {`Pay with ${option.token.symbol}`}
                  </Text>
                </TouchableOpacity>
              ))}
              <Button
                title="Cancel"
                onPress={() => setPreparedTx(null)}
                color="#888"
              />
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>Connected!</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Wallet:</Text>
                <Text style={styles.infoValue}>
                  {walletAddress ? shortenAddress(walletAddress) : 'N/A'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{userEmail || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Login:</Text>
                <Text style={styles.infoValue}>{loginMethod || 'N/A'}</Text>
              </View>

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
                <View>
                  <Button
                    title="Send Tx (With Permission)"
                    onPress={handleSendTransactionWithPermission}
                    disabled={isActionLoading}
                    color="#6B59CC"
                  />
                  {permissionTxHash && (
                    <View style={styles.txHashButton}>
                      <Button
                        title={`View Tx: ${shortenAddress(permissionTxHash)}`}
                        onPress={() => openExplorer(permissionTxHash)}
                        color="#007AFF"
                      />
                    </View>
                  )}
                </View>
                <View>
                  <Button
                    title="Send Tx (No Permission)"
                    onPress={handleSendTransactionWithoutPermission}
                    disabled={isActionLoading}
                    color="#6B59CC"
                  />
                  {noPermissionTxHash && (
                    <View style={styles.txHashButton}>
                      <Button
                        title={`View Tx: ${shortenAddress(noPermissionTxHash)}`}
                        onPress={() => openExplorer(noPermissionTxHash)}
                        color="#007AFF"
                      />
                    </View>
                  )}
                </View>
              </View>
            </>
          )}

          {isActionLoading && (
            <ActivityIndicator
              style={styles.loader}
              size="small"
              color="#6B59CC"
            />
          )}

          <TouchableOpacity
            style={[styles.secondaryButton, styles.disconnectButton]}
            onPress={disconnect}
            disabled={isActionLoading || !!preparedTx}
          >
            <Text style={styles.secondaryButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: '#6B59CC',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '100%',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
  actionsContainer: {
    marginTop: 24,
    width: '100%',
    gap: 12,
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
  feeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  txHashButton: {
    marginTop: 8,
  },
});
