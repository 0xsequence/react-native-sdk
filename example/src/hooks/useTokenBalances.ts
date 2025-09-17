// File: example/src/hooks/useTokenBalances.ts
import { useState, useEffect, useMemo } from 'react';
import { erc20Abi, zeroAddress, type PublicClient } from 'viem';

export function useTokenBalances(
  client: PublicClient | null,
  tokens: `0x${string}`[],
  walletAddress: `0x${string}` | null
) {
  const [balances, setBalances] = useState<(bigint | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize the stringified tokens array to create a stable dependency for useEffect.
  const tokensKey = useMemo(() => JSON.stringify(tokens), [tokens]);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      // Fix: Renamed variable to avoid shadowing the 'tokens' prop.
      const parsedTokens = JSON.parse(tokensKey) as `0x${string}`[];

      if (!client || !walletAddress || parsedTokens.length === 0) {
        setBalances([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          parsedTokens.map((token) => {
            // Use the renamed variable
            if (token === zeroAddress) {
              // Handle native token balance
              return client.getBalance({ address: walletAddress });
            } else {
              // Handle ERC20 token balance
              return client.readContract({
                address: token,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [walletAddress],
              });
            }
          })
        );
        if (!cancelled) {
          setBalances(results as bigint[]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [client, tokensKey, walletAddress]);

  return { balances, isLoading, error };
}
