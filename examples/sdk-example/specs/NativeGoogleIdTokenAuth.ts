import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  requestGoogleIdToken(
    serverClientId: string,
    iosClientId: string | null
  ): Promise<string>;
  clearCredentialState(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GoogleIdTokenAuth');
