import Foundation
import OMS_SDK
import React

@objc(OmsClientReactNativeSdkImpl)
public final class OmsClientReactNativeSdkImpl: NSObject, @unchecked Sendable {
  private var clients: [String: OMSClient] = [:]
  private let clientsLock = NSLock()
  private var feeOptionSelectionRequestEmitter: ((NSDictionary) -> Void)?
  private var sessionExpiredEventEmitter: ((NSDictionary) -> Void)?
  private var pendingFeeOptionSelections: [String: CheckedContinuation<FeeOptionSelection?, Error>] = [:]
  private let pendingFeeOptionSelectionsLock = NSLock()
  private var pendingWalletSelections: [String: StoredPendingWalletSelection] = [:]
  private let pendingWalletSelectionsLock = NSLock()
  private static let defaultSessionLifetimeSeconds: UInt32 = 604_800

  @objc(setFeeOptionSelectionRequestEmitter:)
  public func setFeeOptionSelectionRequestEmitter(_ emitter: @escaping (NSDictionary) -> Void) {
    feeOptionSelectionRequestEmitter = emitter
  }

  @objc(setSessionExpiredEventEmitter:)
  public func setSessionExpiredEventEmitter(_ emitter: @escaping (NSDictionary) -> Void) {
    sessionExpiredEventEmitter = emitter
  }

  @objc(createClientWithClientId:publishableKey:resolve:reject:)
  public func createClient(
    clientId: String,
    publishableKey: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      clearPendingWalletSelections(clientId: clientId)
      let client = try OMSClient(publishableKey: publishableKey)
      client.wallet.onSessionExpired = { [weak self] event in
        guard let self else {
          return
        }
        self.sessionExpiredEventEmitter?(
          self.sessionExpiredEventDictionary(clientId: clientId, event: event) as NSDictionary
        )
      }
      storeClient(client, clientId: clientId)
      resolve(nil)
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(getWalletAddressWithClientId:resolve:reject:)
  public func getWalletAddress(
    clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      guard let address = try requireClient(clientId).wallet.walletAddress?.nonEmpty else {
        resolve(NSNull())
        return
      }
      resolve(address)
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(getSessionWithClientId:resolve:reject:)
  public func getSession(
    clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      resolve(sessionDictionary(try requireClient(clientId).wallet.session))
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(startEmailAuthWithClientId:email:resolve:reject:)
  public func startEmailAuth(
    clientId: String,
    email: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      try await client.wallet.startEmailAuth(email: email)
      return nil
    }
  }

  @objc(completeEmailAuthWithClientId:code:walletSelection:walletType:sessionLifetimeSeconds:resolve:reject:)
  public func completeEmailAuth(
    clientId: String,
    code: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.completeEmailAuth(
        code: code,
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        walletType: try self.walletType(walletType),
        sessionLifetimeSeconds: try self.sessionLifetimeSeconds(sessionLifetimeSeconds)
      )
      return try self.completeAuthResultDictionary(clientId: clientId, result)
    }
  }

  @objc(signInWithOidcIdTokenWithClientId:idToken:issuer:audience:walletSelection:walletType:sessionLifetimeSeconds:resolve:reject:)
  public func signInWithOidcIdToken(
    clientId: String,
    idToken: String,
    issuer: String,
    audience: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.signInWithOidcIdToken(
        idToken: idToken,
        issuer: issuer,
        audience: audience,
        walletType: try self.walletType(walletType),
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        sessionLifetimeSeconds: try self.sessionLifetimeSeconds(sessionLifetimeSeconds)
      )
      return try self.completeAuthResultDictionary(clientId: clientId, result)
    }
  }

  @objc(startOidcRedirectAuthWithClientId:providerJson:redirectUri:walletType:relayRedirectUri:authorizeParamsJson:loginHint:resolve:reject:)
  public func startOidcRedirectAuth(
    clientId: String,
    providerJson: String,
    redirectUri: String,
    walletType: String?,
    relayRedirectUri: String?,
    authorizeParamsJson: String?,
    loginHint: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.startOidcRedirectAuth(
        provider: try self.decodeOidcProvider(providerJson),
        redirectUri: redirectUri,
        walletType: try self.walletType(walletType),
        relayRedirectUri: relayRedirectUri,
        loginHint: loginHint,
        authorizeParams: try self.decodeStringMap(authorizeParamsJson, name: "authorizeParams") ?? [:]
      )
      return [
        "authorizationUrl": result.authorizationUrl,
        "state": result.state,
        "challenge": result.challenge
      ]
    }
  }

  @objc(handleOidcRedirectCallbackWithClientId:callbackUrl:walletSelection:sessionLifetimeSeconds:resolve:reject:)
  public func handleOidcRedirectCallback(
    clientId: String,
    callbackUrl: String?,
    walletSelection: String?,
    sessionLifetimeSeconds: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.handleOidcRedirectCallback(
        callbackUrl,
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        sessionLifetimeSeconds: try self.sessionLifetimeSeconds(sessionLifetimeSeconds)
      )
      switch result {
      case .completed(let wallet):
        self.clearPendingWalletSelections(clientId: clientId)
        return [
          "type": "completed",
          "wallet": self.walletDictionary(wallet)
        ]
      case .notOidcRedirectCallback:
        return ["type": "notOidcRedirectCallback"]
      case .noPendingAuth:
        return ["type": "noPendingAuth"]
      case .failed(let error):
        return [
          "type": "failed",
          "message": (error as NSError).localizedDescription
        ]
      case .walletSelection(let pendingSelection):
        self.clearPendingWalletSelections(clientId: clientId)
        return [
          "type": "walletSelection",
          "pendingSelection": self.pendingWalletSelectionDictionary(clientId: clientId, pendingSelection)
        ]
      }
    }
  }

  @objc(listWalletsWithClientId:resolve:reject:)
  public func listWallets(
    clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      try await client.wallet.listWallets().map(self.walletDictionary)
    }
  }

  @objc(useWalletWithClientId:walletId:resolve:reject:)
  public func useWallet(
    clientId: String,
    walletId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      self.walletActivationResultDictionary(try await client.wallet.useWallet(walletId: walletId))
    }
  }

  @objc(createWalletWithClientId:walletType:reference:resolve:reject:)
  public func createWallet(
    clientId: String,
    walletType: String?,
    reference: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      self.walletActivationResultDictionary(
        try await client.wallet.createWallet(
          walletType: try self.walletType(walletType),
          reference: reference
        )
      )
    }
  }

  @objc(selectWalletForPendingSelectionWithClientId:pendingSelectionId:walletId:resolve:reject:)
  public func selectWalletForPendingSelection(
    clientId: String,
    pendingSelectionId: String,
    walletId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let pendingSelection = try requirePendingWalletSelection(pendingSelectionId, clientId: clientId)
      let callbacks = PromiseCallbacks(resolve: resolve, reject: reject)
      Task { [callbacks, pendingSelection] in
        do {
          let result = try await pendingSelection.selectWallet(walletId: walletId)
          self.removePendingWalletSelection(pendingSelectionId)
          callbacks.resolve(self.walletActivationResultDictionary(result))
        } catch {
          self.rejectError(callbacks.reject, error)
        }
      }
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(createAndSelectWalletForPendingSelectionWithClientId:pendingSelectionId:reference:resolve:reject:)
  public func createAndSelectWalletForPendingSelection(
    clientId: String,
    pendingSelectionId: String,
    reference: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let pendingSelection = try requirePendingWalletSelection(pendingSelectionId, clientId: clientId)
      let callbacks = PromiseCallbacks(resolve: resolve, reject: reject)
      Task { [callbacks, pendingSelection] in
        do {
          let result = try await pendingSelection.createAndSelectWallet(reference: reference)
          self.removePendingWalletSelection(pendingSelectionId)
          callbacks.resolve(self.walletActivationResultDictionary(result))
        } catch {
          self.rejectError(callbacks.reject, error)
        }
      }
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(signOutWithClientId:resolve:reject:)
  public func signOut(
    clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      clearPendingWalletSelections(clientId: clientId)
      try requireClient(clientId).wallet.signOut()
      resolve(nil)
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(signMessageWithClientId:chainId:message:resolve:reject:)
  public func signMessage(
    clientId: String,
    chainId: String,
    message: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.signMessage(network: network, message: message)
    }
  }

  @objc(signTypedDataWithClientId:chainId:typedDataJson:resolve:reject:)
  public func signTypedData(
    clientId: String,
    chainId: String,
    typedDataJson: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.signTypedData(
        network: network,
        typedData: try self.decodeJsonValue(typedDataJson, name: "typedData")
      )
    }
  }

  @objc(sendTransactionWithClientId:chainId:to:value:data:mode:feeOptionSelectorId:waitForStatus:statusPollingTimeoutMs:statusPollingIntervalMs:statusPollingFastIntervalMs:statusPollingFastPollCount:resolve:reject:)
  public func sendTransaction(
    clientId: String,
    chainId: String,
    to: String,
    value: String,
    data: String?,
    mode: String?,
    feeOptionSelectorId: String?,
    waitForStatus: Bool,
    statusPollingTimeoutMs: String?,
    statusPollingIntervalMs: String?,
    statusPollingFastIntervalMs: String?,
    statusPollingFastPollCount: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let request = SendTransactionRequest(
        to: to,
        value: value,
        data: data,
        mode: try self.transactionMode(mode)
      )
      let selectFeeOption = self.feeOptionSelector(feeOptionSelectorId)
      let statusPolling = try self.statusPollingOptions(
        timeoutMs: statusPollingTimeoutMs,
        intervalMs: statusPollingIntervalMs,
        fastIntervalMs: statusPollingFastIntervalMs,
        fastPollCount: statusPollingFastPollCount
      )
      return self.sendTransactionResponseDictionary(
        try await client.wallet.sendTransaction(
          network: network,
          request: request,
          selectFeeOption: selectFeeOption,
          waitForStatus: waitForStatus,
          statusPolling: statusPolling ?? TransactionStatusPollingOptions()
        )
      )
    }
  }

  @objc(callContractWithClientId:chainId:contractAddress:method:argsJson:mode:feeOptionSelectorId:waitForStatus:statusPollingTimeoutMs:statusPollingIntervalMs:statusPollingFastIntervalMs:statusPollingFastPollCount:resolve:reject:)
  public func callContract(
    clientId: String,
    chainId: String,
    contractAddress: String,
    method: String,
    argsJson: String?,
    mode: String?,
    feeOptionSelectorId: String?,
    waitForStatus: Bool,
    statusPollingTimeoutMs: String?,
    statusPollingIntervalMs: String?,
    statusPollingFastIntervalMs: String?,
    statusPollingFastPollCount: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let args = try self.decodeAbiArgs(argsJson)
      let transactionMode = try self.transactionMode(mode)
      let selectFeeOption = self.feeOptionSelector(feeOptionSelectorId)
      let statusPolling = try self.statusPollingOptions(
        timeoutMs: statusPollingTimeoutMs,
        intervalMs: statusPollingIntervalMs,
        fastIntervalMs: statusPollingFastIntervalMs,
        fastPollCount: statusPollingFastPollCount
      )
      return self.sendTransactionResponseDictionary(
        try await client.wallet.callContract(
          network: network,
          contract: contractAddress,
          method: method,
          args: args,
          selectFeeOption: selectFeeOption,
          mode: transactionMode,
          waitForStatus: waitForStatus,
          statusPolling: statusPolling ?? TransactionStatusPollingOptions()
        )
      )
    }
  }

  @objc(respondToFeeOptionSelectionWithRequestId:selectionToken:errorMessage:resolve:reject:)
  public func respondToFeeOptionSelection(
    requestId: String,
    selectionToken: String?,
    errorMessage: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let continuation = takePendingFeeOptionSelection(requestId) else {
      rejectError(reject, makeError("Unknown fee option selection request: \(requestId)"))
      return
    }

    if let errorMessage {
      continuation.resume(throwing: makeError(errorMessage))
    } else {
      continuation.resume(returning: selectionToken.map(FeeOptionSelection.init(token:)))
    }
    resolve(nil)
  }

  @objc(getTransactionStatusWithClientId:txnId:resolve:reject:)
  public func getTransactionStatus(
    clientId: String,
    txnId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      self.transactionStatusDictionary(
        try await client.wallet.getTransactionStatus(txnId: txnId)
      )
    }
  }

  @objc(getBalancesWithClientId:paramsJson:resolve:reject:)
  public func getBalances(
    clientId: String,
    paramsJson: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let params = try self.decodeGetBalancesParams(paramsJson, client: client)
      return self.tokenBalancesResultDictionary(
        try await client.indexer.getBalances(params)
      )
    }
  }

  @objc(getTransactionHistoryWithClientId:paramsJson:resolve:reject:)
  public func getTransactionHistory(
    clientId: String,
    paramsJson: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let params = try self.decodeGetTransactionHistoryParams(paramsJson, client: client)
      return self.transactionHistoryResultDictionary(
        try await client.indexer.getTransactionHistory(params)
      )
    }
  }

  @objc(verifyMessageSignatureWithClientId:chainId:message:signature:resolve:reject:)
  public func verifyMessageSignature(
    clientId: String,
    chainId: String,
    message: String,
    signature: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.isValidMessageSignature(
        network: network,
        walletAddress: try self.requireActiveWalletAddress(client),
        message: message,
        signature: signature
      )
    }
  }

  @objc(verifyTypedDataSignatureWithClientId:chainId:typedDataJson:signature:resolve:reject:)
  public func verifyTypedDataSignature(
    clientId: String,
    chainId: String,
    typedDataJson: String,
    signature: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.isValidTypedDataSignature(
        network: network,
        walletAddress: try self.requireActiveWalletAddress(client),
        typedData: try self.decodeJsonValue(typedDataJson, name: "typedData"),
        signature: signature
      )
    }
  }

  @objc(getIdTokenWithClientId:ttlSeconds:customClaimsJson:resolve:reject:)
  public func getIdToken(
    clientId: String,
    ttlSeconds: String?,
    customClaimsJson: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      try await client.wallet.getIdToken(
        ttlSeconds: try self.uint32(ttlSeconds, name: "ttlSeconds"),
        customClaims: try self.decodeCustomClaims(customClaimsJson)
      )
    }
  }

  @objc(listAccessWithClientId:pageSize:resolve:reject:)
  public func listAccess(
    clientId: String,
    pageSize: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      try await client.wallet.listAccess(
        pageSize: try self.uint32(pageSize, name: "pageSize")
      ).map(self.credentialInfoDictionary)
    }
  }

  @objc(listAccessPageWithClientId:pageSize:cursor:resolve:reject:)
  public func listAccessPage(
    clientId: String,
    pageSize: String?,
    cursor: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      self.listAccessResponseDictionary(
        try await client.wallet.listAccessPage(
          pageSize: try self.uint32(pageSize, name: "pageSize"),
          cursor: cursor
        )
      )
    }
  }

  @objc(revokeAccessWithClientId:targetCredentialId:resolve:reject:)
  public func revokeAccess(
    clientId: String,
    targetCredentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(clientId: clientId, resolve: resolve, reject: reject) { client in
      try await client.wallet.revokeAccess(targetCredentialId: targetCredentialId)
      return nil
    }
  }

  private func feeOptionSelector(_ selectorId: String?) -> FeeOptionSelector? {
    guard let selectorId else {
      return nil
    }

    return .custom { options in
      try await self.requestFeeOptionSelection(
        selectorId: selectorId,
        options: options
      )
    }
  }

  private func requestFeeOptionSelection(
    selectorId: String,
    options: [FeeOptionWithBalance]
  ) async throws -> FeeOptionSelection? {
    guard let emitter = feeOptionSelectionRequestEmitter else {
      throw makeError("Fee option selector listener is not registered")
    }

    let requestId = UUID().uuidString
    let payload: NSDictionary = [
      "selectorId": selectorId,
      "requestId": requestId,
      "options": options.map(feeOptionWithBalanceDictionary)
    ]

    return try await withCheckedThrowingContinuation { continuation in
      storePendingFeeOptionSelection(requestId, continuation: continuation)
      emitter(payload)
    }
  }

  private func storePendingFeeOptionSelection(
    _ requestId: String,
    continuation: CheckedContinuation<FeeOptionSelection?, Error>
  ) {
    pendingFeeOptionSelectionsLock.lock()
    pendingFeeOptionSelections[requestId] = continuation
    pendingFeeOptionSelectionsLock.unlock()
  }

  private func takePendingFeeOptionSelection(
    _ requestId: String
  ) -> CheckedContinuation<FeeOptionSelection?, Error>? {
    pendingFeeOptionSelectionsLock.lock()
    let continuation = pendingFeeOptionSelections.removeValue(forKey: requestId)
    pendingFeeOptionSelectionsLock.unlock()
    return continuation
  }

  private func run(
    clientId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
    operation: @escaping @Sendable (OMSClient) async throws -> Any?
  ) {
    do {
      let activeClient = ClientBox(try requireClient(clientId))
      let callbacks = PromiseCallbacks(resolve: resolve, reject: reject)
      Task { [activeClient, callbacks, operation] in
        do {
          callbacks.resolve(try await operation(activeClient.client))
        } catch {
          self.rejectError(callbacks.reject, error)
        }
      }
    } catch {
      rejectError(reject, error)
    }
  }

  private func storeClient(_ client: OMSClient, clientId: String) {
    clientsLock.lock()
    clients[clientId] = client
    clientsLock.unlock()
  }

  private func requireClient(_ clientId: String) throws -> OMSClient {
    clientsLock.lock()
    let client = clients[clientId]
    clientsLock.unlock()
    guard let client else {
      throw makeError("OMS client is not initialized: \(clientId)")
    }
    return client
  }

  private func requireNetwork(_ client: OMSClient, chainId: String) throws -> Network {
    guard let chainIdValue = Int(chainId), let network = client.findNetworkById(chainId: chainIdValue) else {
      throw makeError("Unsupported chain id: \(chainId)")
    }
    return network
  }

  private func requireActiveWalletAddress(_ client: OMSClient) throws -> String {
    guard let walletAddress = client.wallet.walletAddress?.nonEmpty else {
      throw makeError("No active wallet session")
    }
    return walletAddress
  }

  private func completeAuthResultDictionary(clientId: String, _ result: CompleteAuthResult) throws -> [String: Any] {
    switch result {
    case .walletSelected(let walletAddress, let wallet, let wallets, let credential):
      clearPendingWalletSelections(clientId: clientId)
      return [
        "type": "walletSelected",
        "walletAddress": walletAddress,
        "wallet": walletDictionary(wallet),
        "wallets": wallets.map(walletDictionary),
        "credential": credentialInfoDictionary(credential)
      ]
    case .walletSelection(let pendingSelection):
      clearPendingWalletSelections(clientId: clientId)
      return [
        "type": "walletSelection",
        "walletAddress": NSNull(),
        "wallet": NSNull(),
        "wallets": pendingSelection.wallets.map(walletDictionary),
        "credential": credentialInfoDictionary(pendingSelection.credential),
        "pendingSelection": pendingWalletSelectionDictionary(clientId: clientId, pendingSelection)
      ]
    }
  }

  private func walletDictionary(_ wallet: Wallet) -> [String: Any] {
    [
      "id": wallet.id,
      "type": wallet.type.wireValue,
      "address": wallet.address,
      "reference": wallet.reference ?? NSNull()
    ]
  }

  private func pendingWalletSelectionDictionary(
    clientId: String,
    _ pendingSelection: PendingWalletSelection
  ) -> [String: Any] {
    let id = UUID().uuidString
    pendingWalletSelectionsLock.lock()
    pendingWalletSelections[id] = StoredPendingWalletSelection(clientId: clientId, selection: pendingSelection)
    pendingWalletSelectionsLock.unlock()
    return [
      "id": id,
      "walletType": pendingSelection.walletType.wireValue,
      "wallets": pendingSelection.wallets.map(walletDictionary),
      "credential": credentialInfoDictionary(pendingSelection.credential)
    ]
  }

  private func walletActivationResultDictionary(_ result: WalletActivationResult) -> [String: Any] {
    [
      "walletAddress": result.walletAddress,
      "wallet": walletDictionary(result.wallet)
    ]
  }

  private func requirePendingWalletSelection(_ id: String, clientId: String) throws -> PendingWalletSelection {
    pendingWalletSelectionsLock.lock()
    let storedSelection = pendingWalletSelections[id]
    pendingWalletSelectionsLock.unlock()

    guard let storedSelection else {
      throw makeError("Pending wallet selection is no longer available")
    }
    guard storedSelection.clientId == clientId else {
      throw makeError("Pending wallet selection belongs to a different OMS client")
    }
    return storedSelection.selection
  }

  private func removePendingWalletSelection(_ id: String) {
    pendingWalletSelectionsLock.lock()
    pendingWalletSelections.removeValue(forKey: id)
    pendingWalletSelectionsLock.unlock()
  }

  private func clearPendingWalletSelections(clientId: String) {
    pendingWalletSelectionsLock.lock()
    pendingWalletSelections = pendingWalletSelections.filter { $0.value.clientId != clientId }
    pendingWalletSelectionsLock.unlock()
  }

  private func sessionDictionary(_ session: SessionState?) -> [String: Any] {
    [
      "walletAddress": nullableString(session?.walletAddress),
      "expiresAt": nullableString(session?.expiresAt.map(iso8601String)),
      "loginType": nullableString(session?.loginType.map(sessionLoginTypeString)),
      "sessionEmail": nullableString(session?.sessionEmail)
    ]
  }

  private func sessionExpiredEventDictionary(clientId: String, event: SessionExpiredEvent) -> [String: Any] {
    [
      "clientId": clientId,
      "session": sessionDictionary(event.session),
      "expiredAt": iso8601String(event.expiredAt)
    ]
  }

  private func sessionLoginTypeString(_ loginType: SessionLoginType) -> String {
    switch loginType {
    case .email:
      return "Email"
    case .googleAuth:
      return "GoogleAuth"
    case .oidc:
      return "Oidc"
    }
  }

  private func nullableString(_ value: String?) -> Any {
    value ?? NSNull()
  }

  private func iso8601String(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }

  private func networkDictionary(_ network: Network) -> [String: Any] {
    [
      "chainId": network.chainId,
      "name": network.name,
      "nativeTokenSymbol": network.nativeTokenSymbol,
      "explorerUrl": network.explorerUrl,
      "displayName": network.displayName
    ]
  }

  private func tokenBalancesResultDictionary(_ result: BalancesResult) -> [String: Any] {
    let dictionary: [String: Any] = [
      "status": result.status,
      "page": result.page.map(tokenBalancesPageDictionary) ?? NSNull(),
      "nativeBalances": result.nativeBalances.map(tokenBalanceDictionary),
      "balances": result.balances.map(tokenBalanceDictionary)
    ]

    return dictionary
  }

  private func transactionHistoryResultDictionary(_ result: TransactionHistoryResult) -> [String: Any] {
    [
      "status": result.status,
      "page": result.page.map(tokenBalancesPageDictionary) ?? NSNull(),
      "transactions": result.transactions.map(transactionDictionary)
    ]
  }

  private func tokenBalancesPageDictionary(_ page: TokenBalancesPage) -> [String: Any] {
    [
      "page": page.page.map(NSNumber.init(value:)) ?? NSNull(),
      "pageSize": page.pageSize.map(NSNumber.init(value:)) ?? NSNull(),
      "more": page.more.map(NSNumber.init(value:)) ?? NSNull()
    ]
  }

  private func tokenBalanceDictionary(_ balance: TokenBalance) -> [String: Any] {
    var dictionary: [String: Any] = [:]
    dictionary["contractType"] = balance.contractType ?? NSNull()
    dictionary["contractAddress"] = balance.contractAddress ?? NSNull()
    dictionary["accountAddress"] = balance.accountAddress ?? NSNull()
    dictionary["tokenId"] = balance.tokenId ?? NSNull()
    dictionary["balance"] = balance.balance ?? NSNull()
    dictionary["name"] = balance.name ?? NSNull()
    dictionary["symbol"] = balance.symbol ?? NSNull()
    dictionary["balanceUSD"] = balance.balanceUSD ?? NSNull()
    dictionary["priceUSD"] = balance.priceUSD ?? NSNull()
    dictionary["priceUpdatedAt"] = balance.priceUpdatedAt ?? NSNull()
    dictionary["blockHash"] = balance.blockHash ?? NSNull()
    dictionary["blockNumber"] = balance.blockNumber.map(NSNumber.init(value:)) ?? NSNull()
    dictionary["chainId"] = balance.chainId.map(NSNumber.init(value:)) ?? NSNull()
    dictionary["uniqueCollectibles"] = balance.uniqueCollectibles ?? NSNull()
    dictionary["isSummary"] = balance.isSummary.map(NSNumber.init(value:)) ?? NSNull()
    dictionary["contractInfo"] = balance.contractInfo.map(tokenContractInfoDictionary) ?? NSNull()
    dictionary["tokenMetadata"] = balance.tokenMetadata.map(tokenMetadataDictionary) ?? NSNull()
    return dictionary
  }

  private func tokenContractInfoDictionary(_ info: TokenContractInfo) -> [String: Any] {
    [
      "chainId": info.chainId.map(NSNumber.init(value:)) ?? NSNull(),
      "address": info.address ?? NSNull(),
      "source": info.source ?? NSNull(),
      "name": info.name ?? NSNull(),
      "type": info.type ?? NSNull(),
      "symbol": info.symbol ?? NSNull(),
      "decimals": info.decimals.map(NSNumber.init(value:)) ?? NSNull(),
      "logoURI": info.logoURI ?? NSNull(),
      "deployed": info.deployed.map(NSNumber.init(value:)) ?? NSNull(),
      "bytecodeHash": info.bytecodeHash ?? NSNull(),
      "extensions": info.extensions.map(webRPCJSONObject) ?? NSNull(),
      "updatedAt": info.updatedAt ?? NSNull(),
      "queuedAt": info.queuedAt ?? NSNull(),
      "status": info.status ?? NSNull()
    ]
  }

  private func transactionDictionary(_ transaction: Transaction) -> [String: Any] {
    [
      "txnHash": transaction.txnHash,
      "blockNumber": NSNumber(value: transaction.blockNumber),
      "blockHash": transaction.blockHash,
      "chainId": NSNumber(value: transaction.chainId),
      "metaTxnId": transaction.metaTxnId ?? NSNull(),
      "transfers": transaction.transfers?.map(transactionTransferDictionary) ?? NSNull(),
      "timestamp": transaction.timestamp
    ]
  }

  private func transactionTransferDictionary(_ transfer: TransactionTransfer) -> [String: Any] {
    [
      "transferType": transfer.transferType ?? NSNull(),
      "contractAddress": transfer.contractAddress ?? NSNull(),
      "contractType": transfer.contractType ?? NSNull(),
      "from": transfer.from ?? NSNull(),
      "to": transfer.to ?? NSNull(),
      "tokenIds": transfer.tokenIds ?? NSNull(),
      "amounts": transfer.amounts ?? NSNull(),
      "logIndex": transfer.logIndex.map(NSNumber.init(value:)) ?? NSNull(),
      "amountsUSD": transfer.amountsUSD ?? NSNull(),
      "pricesUSD": transfer.pricesUSD ?? NSNull(),
      "contractInfo": transfer.contractInfo.map(tokenContractInfoDictionary) ?? NSNull(),
      "tokenMetadata": transfer.tokenMetadata?.mapValues(tokenMetadataDictionary) ?? NSNull()
    ]
  }

  private func tokenMetadataDictionary(_ metadata: TokenMetadata) -> [String: Any] {
    [
      "chainId": metadata.chainId.map(NSNumber.init(value:)) ?? NSNull(),
      "contractAddress": metadata.contractAddress ?? NSNull(),
      "tokenId": metadata.tokenId ?? NSNull(),
      "source": metadata.source ?? NSNull(),
      "name": metadata.name ?? NSNull(),
      "description": metadata.description ?? NSNull(),
      "image": metadata.image ?? NSNull(),
      "video": metadata.video ?? NSNull(),
      "audio": metadata.audio ?? NSNull(),
      "properties": metadata.properties.map(webRPCJSONObject) ?? NSNull(),
      "attributes": metadata.attributes?.map(webRPCJSONObject) ?? NSNull(),
      "imageData": metadata.imageData ?? NSNull(),
      "externalUrl": metadata.externalUrl ?? NSNull(),
      "backgroundColor": metadata.backgroundColor ?? NSNull(),
      "animationUrl": metadata.animationUrl ?? NSNull(),
      "decimals": metadata.decimals.map(NSNumber.init(value:)) ?? NSNull(),
      "updatedAt": metadata.updatedAt ?? NSNull(),
      "assets": metadata.assets?.map(tokenMetadataAssetDictionary) ?? NSNull(),
      "status": metadata.status ?? NSNull(),
      "queuedAt": metadata.queuedAt ?? NSNull(),
      "lastFetched": metadata.lastFetched ?? NSNull()
    ]
  }

  private func tokenMetadataAssetDictionary(_ asset: TokenMetadataAsset) -> [String: Any] {
    [
      "id": asset.id.map(NSNumber.init(value:)) ?? NSNull(),
      "collectionId": asset.collectionId.map(NSNumber.init(value:)) ?? NSNull(),
      "tokenId": asset.tokenId ?? NSNull(),
      "url": asset.url ?? NSNull(),
      "metadataField": asset.metadataField ?? NSNull(),
      "name": asset.name ?? NSNull(),
      "filesize": asset.filesize.map(NSNumber.init(value:)) ?? NSNull(),
      "mimeType": asset.mimeType ?? NSNull(),
      "width": asset.width.map(NSNumber.init(value:)) ?? NSNull(),
      "height": asset.height.map(NSNumber.init(value:)) ?? NSNull(),
      "updatedAt": asset.updatedAt ?? NSNull()
    ]
  }

  private func transactionStatusDictionary(_ result: TransactionStatusResponse) -> [String: Any] {
    [
      "status": result.status.wireValue,
      "txnHash": result.txnHash ?? NSNull()
    ]
  }

  private func sendTransactionResponseDictionary(_ result: SendTransactionResponse) -> [String: Any] {
    [
      "txnId": result.txnId,
      "status": result.status.wireValue,
      "txnHash": result.txnHash ?? NSNull()
    ]
  }

  private func feeOptionWithBalanceDictionary(_ option: FeeOptionWithBalance) -> [String: Any] {
    [
      "feeOption": feeOptionDictionary(option.feeOption),
      "selection": feeOptionSelectionDictionary(option.selection),
      "balance": option.balance.map(tokenBalanceDictionary) ?? NSNull(),
      "available": option.available ?? NSNull(),
      "availableRaw": option.availableRaw ?? NSNull(),
      "decimals": option.decimals.map(NSNumber.init(value:)) ?? NSNull()
    ]
  }

  private func feeOptionSelectionDictionary(_ selection: FeeOptionSelection) -> [String: Any] {
    [
      "token": selection.token
    ]
  }

  private func feeOptionDictionary(_ option: FeeOption) -> [String: Any] {
    [
      "token": feeTokenDictionary(option.token),
      "value": option.value,
      "displayValue": option.displayValue
    ]
  }

  private func feeTokenDictionary(_ token: FeeToken) -> [String: Any] {
    [
      "network": token.network,
      "name": token.name,
      "symbol": token.symbol,
      "type": token.type,
      "decimals": token.decimals.map(NSNumber.init(value:)) ?? NSNull(),
      "logoUrl": token.logoUrl ?? NSNull(),
      "contractAddress": token.contractAddress ?? NSNull(),
      "tokenId": token.tokenId ?? NSNull()
    ]
  }

  private func credentialInfoDictionary(_ credential: CredentialInfo) -> [String: Any] {
    [
      "credentialId": credential.credentialId,
      "expiresAt": credential.expiresAt,
      "isCaller": credential.isCaller
    ]
  }

  private func listAccessResponseDictionary(_ response: ListAccessResponse) -> [String: Any] {
    [
      "credentials": response.credentials.map(credentialInfoDictionary),
      "page": response.page.map(pageDictionary) ?? NSNull()
    ]
  }

  private func pageDictionary(_ page: Page) -> [String: Any] {
    [
      "limit": page.limit.map(NSNumber.init(value:)) ?? NSNull(),
      "cursor": page.cursor ?? NSNull()
    ]
  }

  private func walletType(_ value: String?) throws -> WalletType {
    switch value?.lowercased() {
    case nil, "ethereum":
      return .ethereum
    default:
      throw makeError("Unsupported wallet type: \(value ?? "")")
    }
  }

  private func walletSelectionBehavior(_ value: String?) throws -> WalletSelectionBehavior {
    switch value?.lowercased() {
    case nil, "automatic":
      return .automatic
    case "manual":
      return .manual
    default:
      throw makeError("Unsupported wallet selection behavior: \(value ?? "")")
    }
  }

  private func transactionMode(_ value: String?) throws -> TransactionMode {
    switch value?.lowercased() {
    case nil, "relayer":
      return .relayer
    case "native":
      return .native
    default:
      throw makeError("Unsupported transaction mode: \(value ?? "")")
    }
  }

  private func uint32(_ value: String?, name: String) throws -> UInt32? {
    guard let value else {
      return nil
    }
    guard let parsed = UInt32(value) else {
      throw makeError("\(name) must be an unsigned integer")
    }
    return parsed
  }

  private func sessionLifetimeSeconds(_ value: String?) throws -> UInt32 {
    let parsed = try uint32(value, name: "sessionLifetimeSeconds")
      ?? Self.defaultSessionLifetimeSeconds
    guard parsed > 0 else {
      throw makeError("sessionLifetimeSeconds must be a positive whole number")
    }
    return parsed
  }

  private func statusPollingOptions(
    timeoutMs: String?,
    intervalMs: String?,
    fastIntervalMs: String?,
    fastPollCount: String?
  ) throws -> TransactionStatusPollingOptions? {
    guard timeoutMs != nil
      || intervalMs != nil
      || fastIntervalMs != nil
      || fastPollCount != nil else {
      return nil
    }

    return TransactionStatusPollingOptions(
      timeoutMs: UInt64(try uint32(timeoutMs, name: "statusPolling.timeoutMs") ?? 60_000),
      intervalMs: UInt64(try uint32(intervalMs, name: "statusPolling.intervalMs") ?? 2_000),
      fastIntervalMs: UInt64(try uint32(fastIntervalMs, name: "statusPolling.fastIntervalMs") ?? 400),
      fastPollCount: Int(try uint32(fastPollCount, name: "statusPolling.fastPollCount") ?? 5)
    )
  }

  private func decodeJsonValue(_ jsonString: String, name: String) throws -> WebRPCJSONValue {
    guard let data = jsonString.data(using: .utf8) else {
      throw makeError("\(name) must be UTF-8 JSON")
    }
    return try JSONDecoder().decode(WebRPCJSONValue.self, from: data)
  }

  private func decodeCustomClaims(_ jsonString: String?) throws -> [String: WebRPCJSONValue]? {
    guard let jsonString else {
      return nil
    }
    guard let data = jsonString.data(using: .utf8) else {
      throw makeError("customClaims must be UTF-8 JSON")
    }
    return try JSONDecoder().decode([String: WebRPCJSONValue].self, from: data)
  }

  private func decodeStringMap(_ jsonString: String?, name: String) throws -> [String: String]? {
    guard let jsonString else {
      return nil
    }
    guard let data = jsonString.data(using: .utf8) else {
      throw makeError("\(name) must be UTF-8 JSON")
    }
    return try JSONDecoder().decode([String: String].self, from: data)
  }

  private func decodeGetBalancesParams(_ jsonString: String, client: OMSClient) throws -> GetBalancesParams {
    let value = try decodeJSON(SerializableGetBalancesParams.self, from: jsonString, name: "params")
    return GetBalancesParams(
      walletAddress: value.walletAddress,
      networks: try networks(value.networks, client: client),
      networkType: value.networkType,
      contractAddresses: value.contractAddresses,
      includeMetadata: value.includeMetadata ?? true,
      omitPrices: value.omitPrices,
      tokenIds: value.tokenIds,
      contractStatus: value.contractStatus,
      page: value.page?.tokenBalancesPageRequest
    )
  }

  private func decodeGetTransactionHistoryParams(
    _ jsonString: String,
    client: OMSClient
  ) throws -> GetTransactionHistoryParams {
    let value = try decodeJSON(
      SerializableGetTransactionHistoryParams.self,
      from: jsonString,
      name: "params"
    )
    return GetTransactionHistoryParams(
      walletAddress: value.walletAddress,
      networks: try networks(value.networks, client: client),
      networkType: value.networkType,
      contractAddresses: value.contractAddresses,
      transactionHashes: value.transactionHashes,
      metaTransactionIds: value.metaTransactionIds,
      fromBlock: value.fromBlock,
      toBlock: value.toBlock,
      tokenId: value.tokenId,
      includeMetadata: value.includeMetadata ?? true,
      omitPrices: value.omitPrices,
      metadataOptions: value.metadataOptions,
      page: value.page?.tokenBalancesPageRequest
    )
  }

  private func decodeJSON<T: Decodable>(_ type: T.Type, from jsonString: String, name: String) throws -> T {
    guard let data = jsonString.data(using: .utf8) else {
      throw makeError("\(name) must be UTF-8 JSON")
    }
    return try JSONDecoder().decode(type, from: data)
  }

  private func networks(_ chainIds: [String]?, client: OMSClient) throws -> [Network]? {
    guard let chainIds, !chainIds.isEmpty else {
      return nil
    }
    return try chainIds.map { try requireNetwork(client, chainId: $0) }
  }

  private func decodeOidcProvider(_ jsonString: String) throws -> OidcProviderConfig {
    guard let data = jsonString.data(using: .utf8) else {
      throw makeError("provider must be UTF-8 JSON")
    }
    let value = try JSONDecoder().decode(SerializableOidcProviderConfig.self, from: data)
    return OidcProviderConfig(
      issuer: value.issuer,
      clientId: value.clientId,
      authorizationUrl: value.authorizationUrl,
      scopes: value.scopes ?? ["openid", "email", "profile"],
      relayRedirectUri: value.relayRedirectUri,
      authorizeParams: value.authorizeParams ?? [:]
    )
  }

  private func decodeAbiArgs(_ jsonString: String?) throws -> [AbiArg]? {
    guard let jsonString else {
      return nil
    }
    guard let data = jsonString.data(using: .utf8) else {
      throw makeError("args must be UTF-8 JSON")
    }
    return try JSONDecoder().decode([AbiArg].self, from: data)
  }

  private func webRPCJSONObject(_ value: [String: WebRPCJSONValue]) -> [String: Any] {
    value.mapValues(webRPCJSONValue)
  }

  private func webRPCJSONValue(_ value: WebRPCJSONValue) -> Any {
    switch value {
    case .object(let object):
      return webRPCJSONObject(object)
    case .array(let array):
      return array.map(webRPCJSONValue)
    case .string(let string):
      return string
    case .integer(let integer):
      return NSNumber(value: integer)
    case .unsignedInteger(let unsignedInteger):
      return NSNumber(value: unsignedInteger)
    case .number(let number):
      return NSNumber(value: number)
    case .bool(let bool):
      return NSNumber(value: bool)
    case .null:
      return NSNull()
    }
  }

  private func makeError(_ message: String) -> NSError {
    NSError(
      domain: "OmsClientReactNativeSdk",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }

  private func rejectError(_ reject: RCTPromiseRejectBlock, _ error: Error) {
    if let omsError = error as? OmsSdkError {
      let code = omsError.code.rawValue
      var userInfo: [String: Any] = [
        NSLocalizedDescriptionKey: omsError.localizedDescription,
        "code": code
      ]
      userInfo["operation"] = omsError.operation?.rawValue ?? NSNull()
      userInfo["status"] = nullableNumber(omsError.status)
      userInfo["txnId"] = omsError.txnId ?? NSNull()
      userInfo["retryable"] = nullableBool(omsError.retryable)
      userInfo["upstreamError"] = nullableUpstreamError(omsError.upstreamError)
      reject(
        code,
        omsError.localizedDescription,
        NSError(domain: "OmsClientReactNativeSdk", code: 1, userInfo: userInfo)
      )
      return
    }

    let nsError = error as NSError
    reject("oms_client_error", nsError.localizedDescription, nsError)
  }

  private func upstreamErrorDictionary(_ error: OmsUpstreamError) -> [String: Any] {
    [
      "service": error.service.rawValue,
      "name": error.name ?? NSNull(),
      "code": error.code ?? NSNull(),
      "message": error.message ?? NSNull(),
      "status": nullableNumber(error.status)
    ]
  }

  private func nullableNumber(_ value: Int?) -> Any {
    guard let value else { return NSNull() }
    return NSNumber(value: value)
  }

  private func nullableBool(_ value: Bool?) -> Any {
    guard let value else { return NSNull() }
    return NSNumber(value: value)
  }

  private func nullableUpstreamError(_ error: OmsUpstreamError?) -> Any {
    guard let error else { return NSNull() }
    return upstreamErrorDictionary(error)
  }
}

private final class ClientBox: @unchecked Sendable {
  let client: OMSClient

  init(_ client: OMSClient) {
    self.client = client
  }
}

private final class PromiseCallbacks: @unchecked Sendable {
  let resolve: RCTPromiseResolveBlock
  let reject: RCTPromiseRejectBlock

  init(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    self.resolve = resolve
    self.reject = reject
  }
}

private struct StoredPendingWalletSelection {
  let clientId: String
  let selection: PendingWalletSelection
}

private struct SerializableTokenBalancesPageRequest: Decodable {
  let page: Int?
  let pageSize: Int?

  var tokenBalancesPageRequest: TokenBalancesPageRequest {
    TokenBalancesPageRequest(page: page, pageSize: pageSize)
  }
}

private struct SerializableGetBalancesParams: Decodable {
  let walletAddress: String
  let networks: [String]?
  let networkType: IndexerNetworkType?
  let contractAddresses: [String]?
  let includeMetadata: Bool?
  let omitPrices: Bool?
  let tokenIds: [String]?
  let contractStatus: ContractVerificationStatus?
  let page: SerializableTokenBalancesPageRequest?
}

private struct SerializableGetTransactionHistoryParams: Decodable {
  let walletAddress: String
  let networks: [String]?
  let networkType: IndexerNetworkType?
  let contractAddresses: [String]?
  let transactionHashes: [String]?
  let metaTransactionIds: [String]?
  let fromBlock: Int?
  let toBlock: Int?
  let tokenId: String?
  let includeMetadata: Bool?
  let omitPrices: Bool?
  let metadataOptions: MetadataOptions?
  let page: SerializableTokenBalancesPageRequest?
}

private struct SerializableOidcProviderConfig: Decodable {
  let issuer: String
  let clientId: String
  let authorizationUrl: String
  let scopes: [String]?
  let relayRedirectUri: String?
  let authorizeParams: [String: String]?
}

private extension String {
  var nonEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }
}
