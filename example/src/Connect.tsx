import {
  Button,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSequence, type TypedData } from 'react-native-sdk';
import { useState } from 'react';

import {
  DEMO_TYPED_DATA,
  EMITTER_CONTRACT_ADDRESS,
  getRestrictivePermissions,
} from './example-constants';

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

      const result = await signTypedData(
        typedDataToSign as unknown as TypedData
      );

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

  const handleSendTransaction = async () => {
    setIsActionLoading(true);
    try {
      const tx = {
        to: EMITTER_CONTRACT_ADDRESS as `0x${string}`,
        data: '0xab6f6fac' as `0x${string}`,
        value: 0n,
      };
      const txHash = await sendTransaction([tx]);
      Alert.alert(
        'Transaction Sent',
        `Transaction hash: ${txHash}\nCheck your block explorer!`
      );
    } catch (e) {
      console.error('Error sending transaction:', e);
      Alert.alert('Transaction Error', 'Failed to send the transaction.');
    } finally {
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
            <Button
              title="Send Transaction"
              onPress={handleSendTransaction}
              disabled={isActionLoading}
              color="#6B59CC"
            />
          </View>

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
            disabled={isActionLoading}
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
    borderColor: '#6B59CC',
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#6B59CC',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginTop: 16,
  },
  disconnectButton: {
    marginTop: 24,
  },
});
