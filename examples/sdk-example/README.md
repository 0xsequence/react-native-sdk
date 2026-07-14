# OMS Wallet React Native Example

This bare React Native app exercises the main OMS Wallet flows on iOS and Android. It includes email authentication, Google ID-token authentication, OMS Google and Apple redirect authentication, wallet selection, signing, and transactions.

## Run the App

Install the workspace dependencies from the repository root:

```sh
yarn install
```

For iOS, install the pods after cloning or changing native dependencies:

```sh
cd examples/sdk-example/ios
bundle install
bundle exec pod install
cd ../../..
```

Start Metro in one terminal:

```sh
yarn sdk-example start
```

Run one platform from another terminal:

```sh
yarn sdk-example ios
```

```sh
yarn sdk-example android
```

## Configure Google ID Token Authentication

The example uses this web OAuth client as the ID-token audience:

```text
970987756660-0dh5gubqfiugm452raf7mm39qaq639hn.apps.googleusercontent.com
```

Create platform OAuth clients in the same Google Cloud project.

### Android

Create an Android OAuth client with:

```text
Package name: omsclientreactnativesdk.example
SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

The SHA-1 belongs to the committed example debug keystore. Use the fingerprint of your release signing key for release builds.

### iOS

The example uses the same iOS OAuth client as the Swift SDK example:

```text
970987756660-remcfkci9g8bh1gjd4alg14elgtnsukt.apps.googleusercontent.com
```

Google and Apple redirect authentication use `omsclientrndemo://auth/callback` and do not use these platform OAuth clients.
