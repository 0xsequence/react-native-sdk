#import "GoogleIdTokenAuth.h"

#import <GoogleSignIn/GoogleSignIn.h>
#import <React/RCTUtils.h>

static NSString *const GoogleIdTokenAuthErrorCode = @"GOOGLE_ID_TOKEN_AUTH_ERROR";

static NSString *GoogleReversedClientId(NSString *clientId)
{
  return [[[[clientId componentsSeparatedByString:@"."] reverseObjectEnumerator] allObjects]
      componentsJoinedByString:@"."];
}

static BOOL BundleSupportsUrlScheme(NSString *scheme)
{
  NSArray *urlTypes = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleURLTypes"];
  for (NSDictionary *urlType in urlTypes) {
    NSArray *schemes = urlType[@"CFBundleURLSchemes"];
    if ([schemes containsObject:scheme]) {
      return YES;
    }
  }
  return NO;
}

@implementation GoogleIdTokenAuth

- (void)requestGoogleIdToken:(NSString *)serverClientId
                 iosClientId:(nullable NSString *)iosClientId
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (iosClientId.length == 0 || [iosClientId hasPrefix:@"REPLACE_WITH_"]) {
      reject(
          GoogleIdTokenAuthErrorCode,
          @"Set DEMO_GOOGLE_IOS_CLIENT_ID to an iOS OAuth client for this example app",
          nil);
      return;
    }

    NSString *reversedClientId = GoogleReversedClientId(iosClientId);
    if (!BundleSupportsUrlScheme(reversedClientId)) {
      reject(
          GoogleIdTokenAuthErrorCode,
          [NSString stringWithFormat:@"Add %@ as a URL scheme for this example app", reversedClientId],
          nil);
      return;
    }

    UIViewController *presentingViewController = RCTPresentedViewController();
    if (presentingViewController == nil) {
      reject(GoogleIdTokenAuthErrorCode, @"Unable to present Google sign-in", nil);
      return;
    }

    GIDSignIn.sharedInstance.configuration =
        [[GIDConfiguration alloc] initWithClientID:iosClientId serverClientID:serverClientId];
    [GIDSignIn.sharedInstance
        signInWithPresentingViewController:presentingViewController
                                completion:^(GIDSignInResult *_Nullable result,
                                             NSError *_Nullable error) {
      if (error != nil) {
        reject(GoogleIdTokenAuthErrorCode, error.localizedDescription, error);
        return;
      }
      if (result.user == nil) {
        reject(GoogleIdTokenAuthErrorCode, @"Google sign-in did not return a user", nil);
        return;
      }

      [result.user refreshTokensIfNeededWithCompletion:^(GIDGoogleUser *_Nullable user,
                                                          NSError *_Nullable refreshError) {
        if (refreshError != nil) {
          reject(GoogleIdTokenAuthErrorCode, refreshError.localizedDescription, refreshError);
          return;
        }
        NSString *idToken = user.idToken.tokenString;
        if (idToken.length == 0) {
          reject(GoogleIdTokenAuthErrorCode, @"Google sign-in did not return an ID token", nil);
          return;
        }
        resolve(idToken);
      }];
    }];
  });
}

- (void)clearCredentialState:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [GIDSignIn.sharedInstance signOut];
    resolve(nil);
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeGoogleIdTokenAuthSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return @"GoogleIdTokenAuth";
}

@end
