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
  }
  return self;
}

- (void)configure:(NSString *)projectAccessKey
     walletApiUrl:(nullable NSString *)walletApiUrl
        apiRpcUrl:(nullable NSString *)apiRpcUrl
indexerUrlTemplate:(nullable NSString *)indexerUrlTemplate
            scope:(nullable NSString *)scope
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  [_impl configureWithProjectAccessKey:projectAccessKey
                          walletApiUrl:walletApiUrl
                             apiRpcUrl:apiRpcUrl
                    indexerUrlTemplate:indexerUrlTemplate
                                 scope:scope
                               resolve:resolve
                                reject:reject];
}

- (void)getWalletAddress:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl getWalletAddressWithResolve:resolve reject:reject];
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
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [_impl completeEmailAuthWithCode:code resolve:resolve reject:reject];
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

- (void)sendTransaction:(NSString *)chainId
                     to:(NSString *)to
                  value:(NSString *)value
                   data:(nullable NSString *)data
                resolve:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  [_impl sendTransactionWithChainId:chainId
                                 to:to
                              value:value
                               data:data
                            resolve:resolve
                             reject:reject];
}

- (void)getTokenBalances:(NSString *)chainId
         contractAddress:(NSString *)contractAddress
           walletAddress:(NSString *)walletAddress
         includeMetadata:(BOOL)includeMetadata
                 resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  [_impl getTokenBalancesWithChainId:chainId
                      contractAddress:contractAddress
                        walletAddress:walletAddress
                      includeMetadata:includeMetadata
                              resolve:resolve
                               reject:reject];
}

- (void)verifyMessageSignature:(NSString *)chainId
                 walletAddress:(NSString *)walletAddress
                       message:(NSString *)message
                     signature:(NSString *)signature
                       resolve:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  [_impl verifyMessageSignatureWithChainId:chainId
                             walletAddress:walletAddress
                                   message:message
                                 signature:signature
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
