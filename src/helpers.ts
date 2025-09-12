import { useEffect, useState } from 'react';
import { mmkvStorage } from './setup';

export function useLocalState<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const jsonValue = mmkvStorage.getString(key);
      return jsonValue !== undefined ? JSON.parse(jsonValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      mmkvStorage.set(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to save state to MMKV for key "${key}"`, e);
    }
  }, [key, value]);

  return [value, setValue];
}
