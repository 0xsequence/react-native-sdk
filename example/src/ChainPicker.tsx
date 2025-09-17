import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { ACTIVE_CHAINS } from './example-constants';

interface ChainPickerProps {
  selectedChainId: number;
  onSelectChain: (chainId: number) => void;
  style?: ViewStyle;
}

const ChainPicker = ({
  selectedChainId,
  onSelectChain,
  style,
}: ChainPickerProps) => (
  <View style={[styles.chainPickerContainer, style]}>
    <View style={styles.chainButtonsWrapper}>
      {ACTIVE_CHAINS.map((chain) => (
        <TouchableOpacity
          key={chain.id}
          style={[
            styles.chainButton,
            selectedChainId === chain.id && styles.selectedChainButton,
          ]}
          onPress={() => onSelectChain(chain.id)}
        >
          <Text
            style={[
              styles.chainButtonText,
              selectedChainId === chain.id && styles.selectedChainButtonText,
            ]}
          >
            {chain.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  chainPickerContainer: {
    width: '100%',
    marginVertical: 16,
  },
  chainButtonsWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    overflow: 'hidden',
  },
  chainButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  selectedChainButton: {
    backgroundColor: '#6B59CC',
    borderColor: '#6B59CC',
  },
  chainButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  selectedChainButtonText: {
    color: '#fff',
  },
});

export default ChainPicker;
