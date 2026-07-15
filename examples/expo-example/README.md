# OMS Expo Example

Expo development-build example for `@polygonlabs/oms-wallet-react-native`.

This app mirrors the SDK demo flow with email login, Google redirect login,
wallet selection, message signing, signature verification, and transaction
sending. It uses `expo-web-browser` for redirect auth and depends on the SDK
version declared in `package.json`.

This example is intentionally excluded from the root Yarn workspace. It is not
linked to the local SDK package, which keeps it useful as a consumer-style smoke
test for the published npm artifact.

## Run

Install dependencies from the repo root:

```sh
yarn expo-example:install
```

The install helper uses the published npm package when this SDK version exists.
Before publication, it packs the local SDK and installs that tarball into this
example.

Build and launch a development build:

```sh
npm run ios
npm run android
```

Start Metro for an already-installed development build:

```sh
npm start
```

Native configuration is set through `app.json`. The generated `ios/` and
`android/` folders are intentionally ignored.
