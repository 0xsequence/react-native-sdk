import Foundation
import OMS_SDK
import React

@objc(OmsClientReactNativeSdkImpl)
public final class OmsClientReactNativeSdkImpl: NSObject, @unchecked Sendable {
  private var client: OMSClient?
  private var feeOptionSelectionRequestEmitter: ((NSDictionary) -> Void)?
  private var pendingFeeOptionSelections: [String: CheckedContinuation<FeeOptionSelection?, Error>] = [:]
  private let pendingFeeOptionSelectionsLock = NSLock()
  private var pendingWalletSelections: [String: PendingWalletSelection] = [:]
  private let pendingWalletSelectionsLock = NSLock()

  @objc(setFeeOptionSelectionRequestEmitter:)
  public func setFeeOptionSelectionRequestEmitter(_ emitter: @escaping (NSDictionary) -> Void) {
    feeOptionSelectionRequestEmitter = emitter
  }

  @objc(configureWithProjectAccessKey:walletApiUrl:apiRpcUrl:indexerUrlTemplate:projectId:resolve:reject:)
  public func configure(
    projectAccessKey: String,
    walletApiUrl: String?,
    apiRpcUrl: String?,
    indexerUrlTemplate: String?,
    projectId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let environment = OMSClientEnvironment(
      walletApiUrl: walletApiUrl ?? OMSClientEnvironment.defaultWalletApiUrl,
      apiRpcUrl: apiRpcUrl ?? OMSClientEnvironment.defaultApiRpcUrl,
      indexerUrlTemplate: indexerUrlTemplate ?? OMSClientEnvironment.defaultIndexerUrlTemplate
    )

    clearPendingWalletSelections()
    client = OMSClient(
      projectAccessKey: projectAccessKey,
      projectId: projectId,
      environment: environment
    )
    resolve(nil)
  }

  @objc(getWalletAddressWithResolve:reject:)
  public func getWalletAddress(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let address = client?.wallet.walletAddress, !address.isEmpty else {
      resolve(NSNull())
      return
    }
    resolve(address)
  }

  @objc(getSessionWithResolve:reject:)
  public func getSession(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(sessionDictionary(client?.wallet.session))
  }

  @objc(getSupportedNetworksWithResolve:reject:)
  public func getSupportedNetworks(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(Network.supportedNetworks.map(networkDictionary))
  }

  @objc(startEmailAuthWithEmail:resolve:reject:)
  public func startEmailAuth(
    email: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      try await client.wallet.startEmailAuth(email: email)
      return nil
    }
  }

  @objc(completeEmailAuthWithCode:walletSelection:walletType:resolve:reject:)
  public func completeEmailAuth(
    code: String,
    walletSelection: String?,
    walletType: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.completeEmailAuth(
        code: code,
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        walletType: try self.walletType(walletType)
      )
      return try self.completeAuthResultDictionary(result)
    }
  }

  @objc(signInWithOidcIdTokenWithIdToken:issuer:audience:walletSelection:walletType:resolve:reject:)
  public func signInWithOidcIdToken(
    idToken: String,
    issuer: String,
    audience: String,
    walletSelection: String?,
    walletType: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.signInWithOidcIdToken(
        idToken: idToken,
        issuer: issuer,
        audience: audience,
        walletType: try self.walletType(walletType),
        walletSelection: try self.walletSelectionBehavior(walletSelection)
      )
      return try self.completeAuthResultDictionary(result)
    }
  }

  @objc(startOidcRedirectAuthWithProviderJson:redirectUri:walletType:relayRedirectUri:authorizeParamsJson:resolve:reject:)
  public func startOidcRedirectAuth(
    providerJson: String,
    redirectUri: String,
    walletType: String?,
    relayRedirectUri: String?,
    authorizeParamsJson: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.startOidcRedirectAuth(
        provider: try self.decodeOidcProvider(providerJson),
        redirectUri: redirectUri,
        walletType: try self.walletType(walletType),
        relayRedirectUri: relayRedirectUri,
        authorizeParams: try self.decodeStringMap(authorizeParamsJson, name: "authorizeParams") ?? [:]
      )
      return [
        "authorizationUrl": result.authorizationUrl,
        "state": result.state,
        "challenge": result.challenge
      ]
    }
  }

  @objc(handleOidcRedirectCallbackWithCallbackUrl:walletSelection:resolve:reject:)
  public func handleOidcRedirectCallback(
    callbackUrl: String?,
    walletSelection: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.handleOidcRedirectCallback(
        callbackUrl,
        walletSelection: try self.walletSelectionBehavior(walletSelection)
      )
      switch result {
      case .completed(let wallet):
        self.clearPendingWalletSelections()
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
        self.clearPendingWalletSelections()
        return [
          "type": "walletSelection",
          "pendingSelection": self.pendingWalletSelectionDictionary(pendingSelection)
        ]
      }
    }
  }

  @objc(listWalletsWithResolve:reject:)
  public func listWallets(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      try await client.wallet.listWallets().map(self.walletDictionary)
    }
  }

  @objc(useWalletWithWalletId:resolve:reject:)
  public func useWallet(
    walletId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      self.walletActivationResultDictionary(try await client.wallet.useWallet(walletId: walletId))
    }
  }

  @objc(createWalletWithWalletType:reference:resolve:reject:)
  public func createWallet(
    walletType: String?,
    reference: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      self.walletActivationResultDictionary(
        try await client.wallet.createWallet(
          walletType: try self.walletType(walletType),
          reference: reference
        )
      )
    }
  }

  @objc(selectWalletForPendingSelectionWithPendingSelectionId:walletId:resolve:reject:)
  public func selectWalletForPendingSelection(
    pendingSelectionId: String,
    walletId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let pendingSelection = try requirePendingWalletSelection(pendingSelectionId)
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

  @objc(createAndSelectWalletForPendingSelectionWithPendingSelectionId:reference:resolve:reject:)
  public func createAndSelectWalletForPendingSelection(
    pendingSelectionId: String,
    reference: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let pendingSelection = try requirePendingWalletSelection(pendingSelectionId)
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

  @objc(signOutWithResolve:reject:)
  public func signOut(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      clearPendingWalletSelections()
      try requireClient().wallet.signOut()
      resolve(nil)
    } catch {
      rejectError(reject, error)
    }
  }

  @objc(signMessageWithChainId:message:resolve:reject:)
  public func signMessage(
    chainId: String,
    message: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.signMessage(network: network, message: message)
    }
  }

  @objc(signTypedDataWithChainId:typedDataJson:resolve:reject:)
  public func signTypedData(
    chainId: String,
    typedDataJson: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.signTypedData(
        network: network,
        typedData: try self.decodeJsonValue(typedDataJson, name: "typedData")
      )
    }
  }

  @objc(sendTransactionWithChainId:to:value:data:mode:feeOptionSelectorId:resolve:reject:)
  public func sendTransaction(
    chainId: String,
    to: String,
    value: String,
    data: String?,
    mode: String?,
    feeOptionSelectorId: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let result = try await client.wallet.sendTransaction(
        network: network,
        request: SendTransactionRequest(
          to: to,
          value: value,
          data: data,
          mode: try self.transactionMode(mode)
        ),
        selectFeeOption: self.feeOptionSelector(feeOptionSelectorId)
      )

      return self.sendTransactionResponseDictionary(result)
    }
  }

  @objc(callContractWithChainId:contractAddress:method:argsJson:mode:feeOptionSelectorId:resolve:reject:)
  public func callContract(
    chainId: String,
    contractAddress: String,
    method: String,
    argsJson: String?,
    mode: String?,
    feeOptionSelectorId: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let result = try await client.wallet.callContract(
        network: network,
        contract: contractAddress,
        method: method,
        args: try self.decodeAbiArgs(argsJson),
        selectFeeOption: self.feeOptionSelector(feeOptionSelectorId),
        mode: try self.transactionMode(mode)
      )

      return self.sendTransactionResponseDictionary(result)
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

  @objc(getTransactionStatusWithTxnId:resolve:reject:)
  public func getTransactionStatus(
    txnId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      self.transactionStatusDictionary(
        try await client.wallet.getTransactionStatus(txnId: txnId)
      )
    }
  }

  @objc(getTokenBalancesWithChainId:contractAddress:walletAddress:includeMetadata:resolve:reject:)
  public func getTokenBalances(
    chainId: String,
    contractAddress: String,
    walletAddress: String,
    includeMetadata: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let result = try await client.indexer.getTokenBalances(
        network: network,
        contractAddress: contractAddress,
        walletAddress: walletAddress,
        includeMetadata: includeMetadata
      )
      return self.tokenBalancesResultDictionary(result)
    }
  }

  @objc(getNativeTokenBalanceWithChainId:walletAddress:resolve:reject:)
  public func getNativeTokenBalance(
    chainId: String,
    walletAddress: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      guard let balance = try await client.indexer.getNativeTokenBalance(
        network: network,
        walletAddress: walletAddress
      ) else {
        return NSNull()
      }
      return self.tokenBalanceDictionary(balance)
    }
  }

  @objc(verifyMessageSignatureWithChainId:message:signature:resolve:reject:)
  public func verifyMessageSignature(
    chainId: String,
    message: String,
    signature: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.isValidMessageSignature(
        network: network,
        walletAddress: try self.requireActiveWalletAddress(client),
        message: message,
        signature: signature
      )
    }
  }

  @objc(verifyTypedDataSignatureWithChainId:typedDataJson:signature:resolve:reject:)
  public func verifyTypedDataSignature(
    chainId: String,
    typedDataJson: String,
    signature: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.isValidTypedDataSignature(
        network: network,
        walletAddress: try self.requireActiveWalletAddress(client),
        typedData: try self.decodeJsonValue(typedDataJson, name: "typedData"),
        signature: signature
      )
    }
  }

  @objc(getIdTokenWithTtlSeconds:customClaimsJson:resolve:reject:)
  public func getIdToken(
    ttlSeconds: String?,
    customClaimsJson: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      try await client.wallet.getIdToken(
        ttlSeconds: try self.uint32(ttlSeconds, name: "ttlSeconds"),
        customClaims: try self.decodeCustomClaims(customClaimsJson)
      )
    }
  }

  @objc(listAccessWithPageSize:resolve:reject:)
  public func listAccess(
    pageSize: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      try await client.wallet.listAccess(
        pageSize: try self.uint32(pageSize, name: "pageSize")
      ).map(self.credentialInfoDictionary)
    }
  }

  @objc(listAccessPageWithPageSize:cursor:resolve:reject:)
  public func listAccessPage(
    pageSize: String?,
    cursor: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      self.listAccessResponseDictionary(
        try await client.wallet.listAccessPage(
          pageSize: try self.uint32(pageSize, name: "pageSize"),
          cursor: cursor
        )
      )
    }
  }

  @objc(revokeAccessWithTargetCredentialId:resolve:reject:)
  public func revokeAccess(
    targetCredentialId: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
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
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
    operation: @escaping @Sendable (OMSClient) async throws -> Any?
  ) {
    do {
      let activeClient = ClientBox(try requireClient())
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

  private func requireClient() throws -> OMSClient {
    guard let client else {
      throw makeError("Call configure before using the OMS client")
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
    let walletAddress = client.wallet.walletAddress
    guard !walletAddress.isEmpty else {
      throw makeError("No active wallet session")
    }
    return walletAddress
  }

  private func completeAuthResultDictionary(_ result: CompleteAuthResult) throws -> [String: Any] {
    switch result {
    case .walletSelected(let walletAddress, let wallet, let wallets, let credential):
      clearPendingWalletSelections()
      return [
        "type": "walletSelected",
        "walletAddress": walletAddress,
        "wallet": walletDictionary(wallet),
        "wallets": wallets.map(walletDictionary),
        "credential": credentialInfoDictionary(credential)
      ]
    case .walletSelection(let pendingSelection):
      clearPendingWalletSelections()
      return [
        "type": "walletSelection",
        "walletAddress": NSNull(),
        "wallet": NSNull(),
        "wallets": pendingSelection.wallets.map(walletDictionary),
        "credential": credentialInfoDictionary(pendingSelection.credential),
        "pendingSelection": pendingWalletSelectionDictionary(pendingSelection)
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

  private func pendingWalletSelectionDictionary(_ pendingSelection: PendingWalletSelection) -> [String: Any] {
    let id = UUID().uuidString
    pendingWalletSelectionsLock.lock()
    pendingWalletSelections[id] = pendingSelection
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

  private func requirePendingWalletSelection(_ id: String) throws -> PendingWalletSelection {
    pendingWalletSelectionsLock.lock()
    let selection = pendingWalletSelections[id]
    pendingWalletSelectionsLock.unlock()

    guard let selection else {
      throw makeError("Pending wallet selection is no longer available")
    }
    return selection
  }

  private func removePendingWalletSelection(_ id: String) {
    pendingWalletSelectionsLock.lock()
    pendingWalletSelections.removeValue(forKey: id)
    pendingWalletSelectionsLock.unlock()
  }

  private func clearPendingWalletSelections() {
    pendingWalletSelectionsLock.lock()
    pendingWalletSelections.removeAll()
    pendingWalletSelectionsLock.unlock()
  }

  private func sessionDictionary(_ session: SessionState?) -> [String: Any] {
    [
      "walletAddress": nullableString(session?.walletAddress),
      "expiresAt": nullableString(session?.expiresAt.map(iso8601String)),
      "loginType": nullableString(session?.loginType?.rawValue),
      "sessionEmail": nullableString(session?.sessionEmail)
    ]
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

  private func tokenBalancesResultDictionary(_ result: TokenBalancesResult) -> [String: Any] {
    var dictionary: [String: Any] = [
      "status": result.status,
      "balances": result.balances.map(tokenBalanceDictionary)
    ]

    if let page = result.page {
      dictionary["page"] = [
        "page": page.page,
        "pageSize": page.pageSize,
        "more": page.more
      ]
    }

    return dictionary
  }

  private func tokenBalanceDictionary(_ balance: TokenBalance) -> [String: Any] {
    var dictionary: [String: Any] = [:]
    dictionary["contractType"] = balance.contractType ?? NSNull()
    dictionary["contractAddress"] = balance.contractAddress ?? NSNull()
    dictionary["accountAddress"] = balance.accountAddress ?? NSNull()
    dictionary["tokenId"] = balance.tokenId ?? NSNull()
    dictionary["balance"] = balance.balance ?? NSNull()
    dictionary["blockHash"] = balance.blockHash ?? NSNull()
    dictionary["blockNumber"] = balance.blockNumber.map(NSNumber.init(value:)) ?? NSNull()
    dictionary["chainId"] = balance.chainId.map(NSNumber.init(value:)) ?? NSNull()
    return dictionary
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
      "balance": option.balance.map(tokenBalanceDictionary) ?? NSNull(),
      "available": option.available ?? NSNull(),
      "availableRaw": option.availableRaw ?? NSNull(),
      "decimals": option.decimals.map(NSNumber.init(value:)) ?? NSNull()
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
      "logoUrl": token.logoUrl,
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

  private func makeError(_ message: String) -> NSError {
    NSError(
      domain: "OmsClientReactNativeSdk",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: message]
    )
  }

  private func rejectError(_ reject: RCTPromiseRejectBlock, _ error: Error) {
    let nsError = error as NSError
    reject("oms_client_error", nsError.localizedDescription, nsError)
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

private struct SerializableOidcProviderConfig: Decodable {
  let issuer: String
  let clientId: String
  let authorizationUrl: String
  let scopes: [String]?
  let relayRedirectUri: String?
  let authorizeParams: [String: String]?
}
