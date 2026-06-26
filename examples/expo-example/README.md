# OMS Expo Example

Expo development-build example for `@0xsequence/oms-react-native-sdk`.

This app mirrors the SDK demo flow with email login, Google redirect login,
wallet selection, message signing, signature verification, and transaction
sending. It uses `expo-web-browser` for redirect auth and depends on the
published npm package:

```json
"@0xsequence/oms-react-native-sdk": "0.1.0-alpha.3"
```

This example is intentionally excluded from the root Yarn workspace. It is not
linked to the local SDK package, which keeps it useful as a consumer-style smoke
test for the published npm artifact.

## Run

Install dependencies from this folder:

```sh
npm install
```

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
