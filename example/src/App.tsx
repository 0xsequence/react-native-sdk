import {
  SafeAreaView,
  StyleSheet,
  StatusBar,
  useColorScheme,
} from 'react-native';
import {
  SequenceProvider,
  type SequenceProviderConfig,
} from '@0xsequence/react-native-sdk';
import Connect from './Connect';
import { arbitrumSepolia } from 'viem/chains';

// Configuration for the Sequence Provider
const config: SequenceProviderConfig = {
  walletUrl: 'https://v3.sequence-dev.app',
  // IMPORTANT: This must match the "scheme" in your app.json
  origin: 'rndemosequencev3://',
  projectAccessKey: 'AQAAAAAAAEGvyZiWA9FMslYeG_yayXaHnSI',
  defaultChainId: arbitrumSepolia.id,
};

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#1A1A1A' : '#F2F2F7',
  };

  return (
    <SequenceProvider config={config}>
      <SafeAreaView style={[styles.container, backgroundStyle]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={backgroundStyle.backgroundColor}
        />
        <Connect />
      </SafeAreaView>
    </SequenceProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
