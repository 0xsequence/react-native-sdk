import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Button,
} from 'react-native';
import { type Relayer } from '@0xsequence/react-native-sdk';
import { formatUnits } from 'viem';

interface FeeOptionPickerProps {
  feeOptions: Relayer.FeeOption[];
  balances: (bigint | null)[];
  isLoadingBalances: boolean;
  balancesError: string | null;
  onSelectFee: (feeOption: Relayer.FeeOption) => void;
  onCancel: () => void;
  isActionLoading: boolean;
}

const FeeOptionPicker = ({
  feeOptions,
  balances,
  isLoadingBalances,
  balancesError,
  onSelectFee,
  onCancel,
  isActionLoading,
}: FeeOptionPickerProps) => {
  return (
    <View style={styles.feeContainer}>
      <Text style={styles.cardTitle}>Choose Fee</Text>
      {isLoadingBalances && <ActivityIndicator size="small" color="#888" />}
      {balancesError && (
        <Text style={styles.errorText}>
          Error loading balances: {balancesError}
        </Text>
      )}
      {!isLoadingBalances &&
        !balancesError &&
        feeOptions.map((option, index) => {
          const balance = balances[index];
          const hasBalance = balance !== null && balance !== undefined;
          const isInsufficient = !hasBalance || balance < BigInt(option.value);
          const feeAmount = formatUnits(
            BigInt(option.value),
            option.token.decimals ?? 18
          );
          const balanceAmount = hasBalance
            ? formatUnits(balance, option.token.decimals ?? 18)
            : '0.0';

          return (
            <TouchableOpacity
              key={option.token.symbol}
              style={[
                styles.feeButton,
                isInsufficient && styles.disabledFeeButton,
              ]}
              onPress={() => onSelectFee(option)}
              disabled={isActionLoading || isInsufficient}
            >
              <Text style={styles.feeButtonText}>
                {`Pay ${Number(feeAmount).toFixed(5)} ${option.token.symbol}`}
              </Text>
              <Text style={styles.balanceText}>
                {`Balance: ${Number(balanceAmount).toFixed(5)}`}
              </Text>
              {isInsufficient && (
                <Text style={styles.insufficientText}>Insufficient Funds</Text>
              )}
            </TouchableOpacity>
          );
        })}
      <View style={styles.cancelButtonContainer}>
        <Button title="Cancel" onPress={onCancel} color="#888" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  feeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 20,
  },
  feeButton: {
    backgroundColor: '#6B59CC',
    paddingVertical: 12,
    paddingHorizontal: 20,
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
  disabledFeeButton: {
    backgroundColor: '#BDBDBD',
    elevation: 0,
  },
  feeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceText: {
    color: '#EAEAEA',
    fontSize: 12,
    marginTop: 2,
  },
  insufficientText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    backgroundColor: '#EF5350',
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 10,
  },
  cancelButtonContainer: {
    marginTop: 8,
  },
});

export default FeeOptionPicker;
