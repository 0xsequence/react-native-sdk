#import "OmsWalletReactNativeSdk.h"
#import <React/RCTUtils.h>

#if __has_include("OmsWalletReactNativeSdk-Swift.h")
#import "OmsWalletReactNativeSdk-Swift.h"
#else
#import <OmsWalletReactNativeSdk/OmsWalletReactNativeSdk-Swift.h>
#endif

@implementation OmsWalletReactNativeSdk {
  OmsWalletReactNativeSdkImpl *_impl;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _impl = [OmsWalletReactNativeSdkImpl new];
    __weak OmsWalletReactNativeSdk *weakSelf = self;
    [_impl setFeeOptionSelectionRequestEmitter:^(NSDictionary *payload) {
      OmsWalletReactNativeSdk *strongSelf = weakSelf;
      if (strongSelf) {
        [strongSelf emitOnFeeOptionSelectionRequest:payload];
      }
    }];
    [_impl setSessionExpiredEventEmitter:^(NSDictionary *payload) {
      OmsWalletReactNativeSdk *strongSelf = weakSelf;
      if (strongSelf) {
        [strongSelf emitOnSessionExpired:payload];
      }
    }];
  }
  return self;
}

- (void)createClient:(NSString *)clientId
      publishableKey:(NSString *)publishableKey
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl createClientWithClientId:clientId
                    publishableKey:publishableKey
                           resolve:resolve
                            reject:reject];
}

- (void)getWalletAddress:(NSString *)clientId
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl getWalletAddressWithClientId:clientId resolve:resolve reject:reject];
}

- (void)getSession:(NSString *)clientId
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl getSessionWithClientId:clientId resolve:resolve reject:reject];
}

- (void)startEmailAuth:(NSString *)clientId
                 email:(NSString *)email
sessionLifetimeSeconds:(nullable NSString *)sessionLifetimeSeconds
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_impl startEmailAuthWithClientId:clientId
                              email:email
             sessionLifetimeSeconds:sessionLifetimeSeconds
                            resolve:resolve
                             reject:reject];
}

- (void)completeEmailAuth:(NSString *)clientId
                     code:(NSString *)code
          walletSelection:(nullable NSString *)walletSelection
               walletType:(nullable NSString *)walletType
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [_impl completeEmailAuthWithClientId:clientId
                                  code:code
                       walletSelection:walletSelection
                            walletType:walletType
                               resolve:resolve
                                reject:reject];
}

- (void)signInWithOidcIdToken:(NSString *)clientId
                      idToken:(NSString *)idToken
                       issuer:(NSString *)issuer
                     audience:(NSString *)audience
              walletSelection:(nullable NSString *)walletSelection
                   walletType:(nullable NSString *)walletType
       sessionLifetimeSeconds:(nullable NSString *)sessionLifetimeSeconds
                     provider:(nullable NSString *)provider
                providerLabel:(nullable NSString *)providerLabel
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl signInWithOidcIdTokenWithClientId:clientId
                                   idToken:idToken
                                    issuer:issuer
                                  audience:audience
                           walletSelection:walletSelection
                                walletType:walletType
                     sessionLifetimeSeconds:sessionLifetimeSeconds
                                  provider:provider
                             providerLabel:providerLabel
                                   resolve:resolve
                                    reject:reject];
}

- (void)startOidcRedirectAuth:(NSString *)clientId
                 providerJson:(NSString *)providerJson
           omsRelayReturnUri:(nullable NSString *)omsRelayReturnUri
                   walletType:(nullable NSString *)walletType
              walletSelection:(nullable NSString *)walletSelection
        sessionLifetimeSeconds:(nullable NSString *)sessionLifetimeSeconds
          authorizeParamsJson:(nullable NSString *)authorizeParamsJson
                    loginHint:(nullable NSString *)loginHint
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl startOIDCRedirectAuthWithClientId:clientId
                              providerJson:providerJson
                        omsRelayReturnUri:omsRelayReturnUri
                                walletType:walletType
                       walletSelection:walletSelection
                 sessionLifetimeSeconds:sessionLifetimeSeconds
                       authorizeParamsJson:authorizeParamsJson
                                 loginHint:loginHint
                                  resolve:resolve
                                   reject:reject];
}

- (void)handleOidcRedirectCallback:(NSString *)clientId
                       callbackUrl:(NSString *)callbackUrl
                   walletSelection:(nullable NSString *)walletSelection
             sessionLifetimeSeconds:(nullable NSString *)sessionLifetimeSeconds
                            resolve:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  [_impl handleOIDCRedirectCallbackWithClientId:clientId
                                    callbackUrl:callbackUrl
                                walletSelection:walletSelection
                         sessionLifetimeSeconds:sessionLifetimeSeconds
                                        resolve:resolve
                                         reject:reject];
}

- (void)listWallets:(NSString *)clientId
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [_impl listWalletsWithClientId:clientId resolve:resolve reject:reject];
}

- (void)useWallet:(NSString *)clientId
         walletId:(NSString *)walletId
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [_impl useWalletWithClientId:clientId walletId:walletId resolve:resolve reject:reject];
}

- (void)createWallet:(NSString *)clientId
          walletType:(nullable NSString *)walletType
           reference:(nullable NSString *)reference
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl createWalletWithClientId:clientId
                        walletType:walletType
                         reference:reference
                           resolve:resolve
                            reject:reject];
}

- (void)selectWalletForPendingSelection:(NSString *)clientId
                     pendingSelectionId:(NSString *)pendingSelectionId
                               walletId:(NSString *)walletId
                                resolve:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  [_impl selectWalletForPendingSelectionWithClientId:clientId
                                 pendingSelectionId:pendingSelectionId
                                           walletId:walletId
                                            resolve:resolve
                                             reject:reject];
}

- (void)createAndSelectWalletForPendingSelection:(NSString *)clientId
                              pendingSelectionId:(NSString *)pendingSelectionId
                                       reference:(nullable NSString *)reference
                                         resolve:(RCTPromiseResolveBlock)resolve
                                          reject:(RCTPromiseRejectBlock)reject
{
  [_impl createAndSelectWalletForPendingSelectionWithClientId:clientId
                                           pendingSelectionId:pendingSelectionId
                                                    reference:reference
                                                      resolve:resolve
                                                       reject:reject];
}

- (void)signOut:(NSString *)clientId
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [_impl signOutWithClientId:clientId resolve:resolve reject:reject];
}

- (void)signMessage:(NSString *)clientId
            chainId:(NSString *)chainId
            message:(NSString *)message
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [_impl signMessageWithClientId:clientId
                         chainId:chainId
                         message:message
                         resolve:resolve
                          reject:reject];
}

- (void)signTypedData:(NSString *)clientId
              chainId:(NSString *)chainId
        typedDataJson:(NSString *)typedDataJson
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [_impl signTypedDataWithClientId:clientId
                           chainId:chainId
                     typedDataJson:typedDataJson
                           resolve:resolve
                            reject:reject];
}

- (void)sendTransaction:(NSString *)clientId
                chainId:(NSString *)chainId
                     to:(NSString *)to
                  value:(NSString *)value
                   data:(nullable NSString *)data
                   mode:(nullable NSString *)mode
    feeOptionSelectorId:(nullable NSString *)feeOptionSelectorId
          waitForStatus:(BOOL)waitForStatus
 statusPollingTimeoutMs:(nullable NSString *)statusPollingTimeoutMs
statusPollingIntervalMs:(nullable NSString *)statusPollingIntervalMs
statusPollingFastIntervalMs:(nullable NSString *)statusPollingFastIntervalMs
statusPollingFastPollCount:(nullable NSString *)statusPollingFastPollCount
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [_impl sendTransactionWithClientId:clientId
                             chainId:chainId
                                  to:to
                               value:value
                                data:data
                                mode:mode
                 feeOptionSelectorId:feeOptionSelectorId
                       waitForStatus:waitForStatus
              statusPollingTimeoutMs:statusPollingTimeoutMs
             statusPollingIntervalMs:statusPollingIntervalMs
         statusPollingFastIntervalMs:statusPollingFastIntervalMs
         statusPollingFastPollCount:statusPollingFastPollCount
                             resolve:resolve
                              reject:reject];
}

- (void)callContract:(NSString *)clientId
             chainId:(NSString *)chainId
     contractAddress:(NSString *)contractAddress
              method:(NSString *)method
            argsJson:(nullable NSString *)argsJson
                mode:(nullable NSString *)mode
 feeOptionSelectorId:(nullable NSString *)feeOptionSelectorId
       waitForStatus:(BOOL)waitForStatus
statusPollingTimeoutMs:(nullable NSString *)statusPollingTimeoutMs
statusPollingIntervalMs:(nullable NSString *)statusPollingIntervalMs
statusPollingFastIntervalMs:(nullable NSString *)statusPollingFastIntervalMs
statusPollingFastPollCount:(nullable NSString *)statusPollingFastPollCount
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl callContractWithClientId:clientId
                          chainId:chainId
                  contractAddress:contractAddress
                           method:method
                         argsJson:argsJson
                             mode:mode
              feeOptionSelectorId:feeOptionSelectorId
                    waitForStatus:waitForStatus
           statusPollingTimeoutMs:statusPollingTimeoutMs
          statusPollingIntervalMs:statusPollingIntervalMs
      statusPollingFastIntervalMs:statusPollingFastIntervalMs
      statusPollingFastPollCount:statusPollingFastPollCount
                          resolve:resolve
                           reject:reject];
}

- (void)respondToFeeOptionSelection:(NSString *)requestId
                     selectionToken:(nullable NSString *)selectionToken
                       errorMessage:(nullable NSString *)errorMessage
                            resolve:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  [_impl respondToFeeOptionSelectionWithRequestId:requestId
                                   selectionToken:selectionToken
                                     errorMessage:errorMessage
                                          resolve:resolve
                                           reject:reject];
}

- (void)getTransactionStatus:(NSString *)clientId
                       txnId:(NSString *)txnId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [_impl getTransactionStatusWithClientId:clientId txnId:txnId resolve:resolve reject:reject];
}

- (void)getBalances:(NSString *)clientId
         paramsJson:(NSString *)paramsJson
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [_impl getBalancesWithClientId:clientId paramsJson:paramsJson resolve:resolve reject:reject];
}

- (void)getTransactionHistory:(NSString *)clientId
                   paramsJson:(NSString *)paramsJson
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl getTransactionHistoryWithClientId:clientId
                                paramsJson:paramsJson
                                   resolve:resolve
                                    reject:reject];
}

- (void)verifyMessageSignature:(NSString *)clientId
                       chainId:(NSString *)chainId
                       message:(NSString *)message
                     signature:(NSString *)signature
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [_impl verifyMessageSignatureWithClientId:clientId
                                    chainId:chainId
                                    message:message
                                  signature:signature
                                    resolve:resolve
                                     reject:reject];
}

- (void)verifyTypedDataSignature:(NSString *)clientId
                         chainId:(NSString *)chainId
                    typedDataJson:(NSString *)typedDataJson
                        signature:(NSString *)signature
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  [_impl verifyTypedDataSignatureWithClientId:clientId
                                      chainId:chainId
                                typedDataJson:typedDataJson
                                    signature:signature
                                      resolve:resolve
                                       reject:reject];
}

- (void)getIdToken:(NSString *)clientId
        ttlSeconds:(nullable NSString *)ttlSeconds
  customClaimsJson:(nullable NSString *)customClaimsJson
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl getIdTokenWithClientId:clientId
                     ttlSeconds:ttlSeconds
               customClaimsJson:customClaimsJson
                        resolve:resolve
                         reject:reject];
}

- (void)listAccess:(NSString *)clientId
          pageSize:(nullable NSString *)pageSize
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl listAccessWithClientId:clientId pageSize:pageSize resolve:resolve reject:reject];
}

- (void)listAccessPage:(NSString *)clientId
              pageSize:(nullable NSString *)pageSize
                cursor:(nullable NSString *)cursor
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_impl listAccessPageWithClientId:clientId
                            pageSize:pageSize
                              cursor:cursor
                             resolve:resolve
                              reject:reject];
}

- (void)revokeAccess:(NSString *)clientId
  targetCredentialId:(NSString *)targetCredentialId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl revokeAccessWithClientId:clientId
               targetCredentialId:targetCredentialId
                           resolve:resolve
                            reject:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeOmsWalletReactNativeSdkSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"OmsWalletReactNativeSdk";
}

@end
