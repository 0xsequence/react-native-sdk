import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSequence, type LoginMethod } from 'react-native-sdk';

import { getPermissionsForNFTMint } from './example-constants';
import Connected from './Connected';
import ChainPicker from './ChainPicker';

export default function Connect() {
  const { isInitializing, isInitialized, connect, chainId, setChainId } =
    useSequence();

  const handleConnect = async (loginWith: LoginMethod) => {
    try {
      await connect({
        loginMethod: loginWith,
        permissions: getPermissionsForNFTMint(chainId),
      });
    } catch (e) {
      console.error('Error during connect:', e);
      Alert.alert('Connection Error', 'Failed to connect. Please try again.');
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
        <>
          <View style={styles.connectChainPicker}>
            <ChainPicker selectedChainId={chainId} onSelectChain={setChainId} />
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleConnect('google')}
          >
            <Text style={styles.buttonText}>Connect with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleConnect('passkey')}
          >
            <Text style={styles.buttonText}>Connect with Passkey</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Connected />
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
    marginBottom: 20,
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
  connectChainPicker: {
    width: '100%',
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  chainPickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
});
