# Trails Actions Example

React Native demo app for using the OMS Client React Native SDK wallet flow with
Trails action resolution.

The demo keeps wallet auth and transaction sending in `oms-client-react-native-sdk`
and keeps Trails-specific code inside this app.

## Examples

- Sign in with email OTP or Google OIDC redirect auth.
- Swap POL to USDC on Polygon.
- Deposit USDC into a Polygon earn market.
- Swap POL to USDC and deposit the resulting USDC in one transaction.
- View and withdraw deposited earn positions.

## Run

From the repository root:

```sh
corepack yarn install
corepack yarn trails-actions-example start
```

Then run the native app:

```sh
corepack yarn trails-actions-example android
```

or:

```sh
corepack yarn trails-actions-example ios
```

## Trails package

This app uses the published `0xtrails` and `@0xtrails/api` packages.
