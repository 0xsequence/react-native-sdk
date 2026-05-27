#import "OmsClientReactNativeSdk.h"
#import <React/RCTUtils.h>

#if __has_include("OmsClientReactNativeSdk-Swift.h")
#import "OmsClientReactNativeSdk-Swift.h"
#else
#import <OmsClientReactNativeSdk/OmsClientReactNativeSdk-Swift.h>
#endif

@implementation OmsClientReactNativeSdk {
  OmsClientReactNativeSdkImpl *_impl;
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    _impl = [OmsClientReactNativeSdkImpl new];
    __weak OmsClientReactNativeSdk *weakSelf = self;
    [_impl setFeeOptionSelectionRequestEmitter:^(NSDictionary *payload) {
      OmsClientReactNativeSdk *strongSelf = weakSelf;
      if (strongSelf) {
        [strongSelf emitOnFeeOptionSelectionRequest:payload];
      }
    }];
  }
  return self;
}

- (void)configure:(NSString *)projectAccessKey
     walletApiUrl:(nullable NSString *)walletApiUrl
        apiRpcUrl:(nullable NSString *)apiRpcUrl
indexerUrlTemplate:(nullable NSString *)indexerUrlTemplate
        projectId:(NSString *)projectId
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [_impl configureWithProjectAccessKey:projectAccessKey
                          walletApiUrl:walletApiUrl
                             apiRpcUrl:apiRpcUrl
                    indexerUrlTemplate:indexerUrlTemplate
                             projectId:projectId
                               resolve:resolve
                                reject:reject];
}

- (void)getWalletAddress:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl getWalletAddressWithResolve:resolve reject:reject];
}

- (void)getSession:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl getSessionWithResolve:resolve reject:reject];
}

- (void)getSupportedNetworks:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [_impl getSupportedNetworksWithResolve:resolve reject:reject];
}

- (void)startEmailAuth:(NSString *)email
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_impl startEmailAuthWithEmail:email resolve:resolve reject:reject];
}

- (void)completeEmailAuth:(NSString *)code
          walletSelection:(nullable NSString *)walletSelection
               walletType:(nullable NSString *)walletType
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [_impl completeEmailAuthWithCode:code
                    walletSelection:walletSelection
                         walletType:walletType
                            resolve:resolve
                             reject:reject];
}

- (void)signInWithOidcIdToken:(NSString *)idToken
                       issuer:(NSString *)issuer
                     audience:(NSString *)audience
              walletSelection:(nullable NSString *)walletSelection
                    walletType:(nullable NSString *)walletType
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl signInWithOidcIdTokenWithIdToken:idToken
                                   issuer:issuer
                                 audience:audience
                          walletSelection:walletSelection
                                walletType:walletType
                                  resolve:resolve
                                   reject:reject];
}

- (void)startOidcRedirectAuth:(NSString *)providerJson
                  redirectUri:(NSString *)redirectUri
                   walletType:(nullable NSString *)walletType
             relayRedirectUri:(nullable NSString *)relayRedirectUri
          authorizeParamsJson:(nullable NSString *)authorizeParamsJson
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl startOidcRedirectAuthWithProviderJson:providerJson
                                   redirectUri:redirectUri
                                    walletType:walletType
                              relayRedirectUri:relayRedirectUri
                           authorizeParamsJson:authorizeParamsJson
                                       resolve:resolve
                                        reject:reject];
}

- (void)handleOidcRedirectCallback:(nullable NSString *)callbackUrl
                   walletSelection:(nullable NSString *)walletSelection
                            resolve:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  [_impl handleOidcRedirectCallbackWithCallbackUrl:callbackUrl
                                   walletSelection:walletSelection
                                           resolve:resolve
                                            reject:reject];
}

- (void)listWallets:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [_impl listWalletsWithResolve:resolve reject:reject];
}

- (void)useWallet:(NSString *)walletId
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [_impl useWalletWithWalletId:walletId resolve:resolve reject:reject];
}

- (void)createWallet:(nullable NSString *)walletType
           reference:(nullable NSString *)reference
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl createWalletWithWalletType:walletType
                           reference:reference
                             resolve:resolve
                              reject:reject];
}

- (void)selectWalletForPendingSelection:(NSString *)pendingSelectionId
                               walletId:(NSString *)walletId
                                resolve:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  [_impl selectWalletForPendingSelectionWithPendingSelectionId:pendingSelectionId
                                                      walletId:walletId
                                                       resolve:resolve
                                                        reject:reject];
}

- (void)createAndSelectWalletForPendingSelection:(NSString *)pendingSelectionId
                                      reference:(nullable NSString *)reference
                                        resolve:(RCTPromiseResolveBlock)resolve
                                         reject:(RCTPromiseRejectBlock)reject
{
  [_impl createAndSelectWalletForPendingSelectionWithPendingSelectionId:pendingSelectionId
                                                              reference:reference
                                                                resolve:resolve
                                                                 reject:reject];
}

- (void)signOut:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [_impl signOutWithResolve:resolve reject:reject];
}

- (void)signMessage:(NSString *)chainId
            message:(NSString *)message
            resolve:(RCTPromiseResolveBlock)resolve
             reject:(RCTPromiseRejectBlock)reject
{
  [_impl signMessageWithChainId:chainId message:message resolve:resolve reject:reject];
}

- (void)signTypedData:(NSString *)chainId
        typedDataJson:(NSString *)typedDataJson
              resolve:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [_impl signTypedDataWithChainId:chainId
                    typedDataJson:typedDataJson
                          resolve:resolve
                           reject:reject];
}

- (void)sendTransaction:(NSString *)chainId
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
  [_impl sendTransactionWithChainId:chainId
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

- (void)callContract:(NSString *)chainId
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
  [_impl callContractWithChainId:chainId
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

- (void)getTransactionStatus:(NSString *)txnId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [_impl getTransactionStatusWithTxnId:txnId resolve:resolve reject:reject];
}

- (void)getTokenBalances:(NSString *)chainId
         contractAddress:(nullable NSString *)contractAddress
           walletAddress:(NSString *)walletAddress
         includeMetadata:(BOOL)includeMetadata
                    page:(nullable NSString *)page
                pageSize:(nullable NSString *)pageSize
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl getTokenBalancesWithChainId:chainId
                      contractAddress:contractAddress
                        walletAddress:walletAddress
                      includeMetadata:includeMetadata
                                page:page
                            pageSize:pageSize
                              resolve:resolve
                               reject:reject];
}

- (void)getNativeTokenBalance:(NSString *)chainId
                walletAddress:(NSString *)walletAddress
                      resolve:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  [_impl getNativeTokenBalanceWithChainId:chainId
                            walletAddress:walletAddress
                                  resolve:resolve
                                   reject:reject];
}

- (void)verifyMessageSignature:(NSString *)chainId
                       message:(NSString *)message
                     signature:(NSString *)signature
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [_impl verifyMessageSignatureWithChainId:chainId
                                   message:message
                                 signature:signature
                                   resolve:resolve
                                    reject:reject];
}

- (void)verifyTypedDataSignature:(NSString *)chainId
                    typedDataJson:(NSString *)typedDataJson
                        signature:(NSString *)signature
                          resolve:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  [_impl verifyTypedDataSignatureWithChainId:chainId
                                typedDataJson:typedDataJson
                                    signature:signature
                                      resolve:resolve
                                       reject:reject];
}

- (void)getIdToken:(nullable NSString *)ttlSeconds
  customClaimsJson:(nullable NSString *)customClaimsJson
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl getIdTokenWithTtlSeconds:ttlSeconds
                 customClaimsJson:customClaimsJson
                          resolve:resolve
                           reject:reject];
}

- (void)listAccess:(nullable NSString *)pageSize
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  [_impl listAccessWithPageSize:pageSize resolve:resolve reject:reject];
}

- (void)listAccessPage:(nullable NSString *)pageSize
                cursor:(nullable NSString *)cursor
               resolve:(RCTPromiseResolveBlock)resolve
                reject:(RCTPromiseRejectBlock)reject
{
  [_impl listAccessPageWithPageSize:pageSize
                              cursor:cursor
                             resolve:resolve
                              reject:reject];
}

- (void)revokeAccess:(NSString *)targetCredentialId
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [_impl revokeAccessWithTargetCredentialId:targetCredentialId
                                    resolve:resolve
                                     reject:reject];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeOmsClientReactNativeSdkSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"OmsClientReactNativeSdk";
}

@end
