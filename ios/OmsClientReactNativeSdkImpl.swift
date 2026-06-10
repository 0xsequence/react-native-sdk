import Foundation
import OMS_SDK
import React

@objc(OmsClientReactNativeSdkImpl)
public final class OmsClientReactNativeSdkImpl: NSObject, @unchecked Sendable {
  private var client: OMSClient?
  private var feeOptionSelectionRequestEmitter: ((NSDictionary) -> Void)?
  private var sessionExpiredEventEmitter: ((NSDictionary) -> Void)?
  private var pendingFeeOptionSelections: [String: CheckedContinuation<FeeOptionSelection?, Error>] = [:]
  private let pendingFeeOptionSelectionsLock = NSLock()
  private var pendingWalletSelections: [String: PendingWalletSelection] = [:]
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

  @objc(configureWithPublishableKey:walletApiUrl:apiRpcUrl:indexerUrlTemplate:projectId:resolve:reject:)
  public func configure(
    publishableKey: String,
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
      publishableKey: publishableKey,
      projectId: projectId,
      environment: environment
    )
    client?.wallet.onSessionExpired = { [weak self] event in
      guard let self else {
        return
      }
      self.sessionExpiredEventEmitter?(self.sessionExpiredEventDictionary(event) as NSDictionary)
    }
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

  @objc(completeEmailAuthWithCode:walletSelection:walletType:sessionLifetimeSeconds:resolve:reject:)
  public func completeEmailAuth(
    code: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.completeEmailAuth(
        code: code,
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        walletType: try self.walletType(walletType),
        sessionLifetimeSeconds: try self.sessionLifetimeSeconds(sessionLifetimeSeconds)
      )
      return try self.completeAuthResultDictionary(result)
    }
  }

  @objc(signInWithOidcIdTokenWithIdToken:issuer:audience:walletSelection:walletType:sessionLifetimeSeconds:resolve:reject:)
  public func signInWithOidcIdToken(
    idToken: String,
    issuer: String,
    audience: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.signInWithOidcIdToken(
        idToken: idToken,
        issuer: issuer,
        audience: audience,
        walletType: try self.walletType(walletType),
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        sessionLifetimeSeconds: try self.sessionLifetimeSeconds(sessionLifetimeSeconds)
      )
      return try self.completeAuthResultDictionary(result)
    }
  }

  @objc(startOidcRedirectAuthWithProviderJson:redirectUri:walletType:relayRedirectUri:authorizeParamsJson:loginHint:resolve:reject:)
  public func startOidcRedirectAuth(
    providerJson: String,
    redirectUri: String,
    walletType: String?,
    relayRedirectUri: String?,
    authorizeParamsJson: String?,
    loginHint: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
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

  @objc(handleOidcRedirectCallbackWithCallbackUrl:walletSelection:sessionLifetimeSeconds:resolve:reject:)
  public func handleOidcRedirectCallback(
    callbackUrl: String?,
    walletSelection: String?,
    sessionLifetimeSeconds: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let result = try await client.wallet.handleOidcRedirectCallback(
        callbackUrl,
        walletSelection: try self.walletSelectionBehavior(walletSelection),
        sessionLifetimeSeconds: try self.sessionLifetimeSeconds(sessionLifetimeSeconds)
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

  @objc(sendTransactionWithChainId:to:value:data:mode:feeOptionSelectorId:waitForStatus:statusPollingTimeoutMs:statusPollingIntervalMs:statusPollingFastIntervalMs:statusPollingFastPollCount:resolve:reject:)
  public func sendTransaction(
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
    run(resolve: resolve, reject: reject) { client in
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
      let result: SendTransactionResponse

      if waitForStatus && statusPolling == nil {
        result = try await client.wallet.sendTransaction(
          network: network,
          request: request,
          selectFeeOption: selectFeeOption
        )
      } else {
        result = try await self.sendTransactionWithStatusPolling(
          client: client,
          network: network,
          request: request,
          selectFeeOption: selectFeeOption,
          waitForStatus: waitForStatus,
          statusPolling: statusPolling ?? .defaultOptions
        )
      }

      return self.sendTransactionResponseDictionary(result)
    }
  }

  @objc(callContractWithChainId:contractAddress:method:argsJson:mode:feeOptionSelectorId:waitForStatus:statusPollingTimeoutMs:statusPollingIntervalMs:statusPollingFastIntervalMs:statusPollingFastPollCount:resolve:reject:)
  public func callContract(
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
    run(resolve: resolve, reject: reject) { client in
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
      let result: SendTransactionResponse

      if waitForStatus && statusPolling == nil {
        result = try await client.wallet.callContract(
          network: network,
          contract: contractAddress,
          method: method,
          args: args,
          selectFeeOption: selectFeeOption,
          mode: transactionMode
        )
      } else {
        result = try await self.callContractWithStatusPolling(
          client: client,
          network: network,
          contract: contractAddress,
          method: method,
          args: args,
          mode: transactionMode,
          selectFeeOption: selectFeeOption,
          waitForStatus: waitForStatus,
          statusPolling: statusPolling ?? .defaultOptions
        )
      }

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

  @objc(getTokenBalancesWithChainId:contractAddress:walletAddress:includeMetadata:page:pageSize:resolve:reject:)
  public func getTokenBalances(
    chainId: String,
    contractAddress: String?,
    walletAddress: String,
    includeMetadata: Bool,
    page: String?,
    pageSize: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let result = try await client.indexer.getTokenBalances(
        network: network,
        contractAddress: contractAddress,
        walletAddress: walletAddress,
        includeMetadata: includeMetadata,
        page: TokenBalancesPageRequest(
          page: try self.uint32(page, name: "page").map { Int($0) },
          pageSize: try self.uint32(pageSize, name: "pageSize").map { Int($0) }
        )
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

  private func sendTransactionWithStatusPolling(
    client: OMSClient,
    network: Network,
    request: SendTransactionRequest,
    selectFeeOption: FeeOptionSelector?,
    waitForStatus: Bool,
    statusPolling: OmsBridgeTransactionStatusPollingOptions
  ) async throws -> SendTransactionResponse {
    let walletId = try requireActiveWalletId(client)
    let signedClient = try signedWalletClient(client)
    let prepared = try await signedClient.prepareEthereumTransaction(
      PrepareEthereumTransactionRequest(
        network: network.chainId,
        walletId: walletId,
        to: request.to,
        value: request.value,
        data: request.data,
        mode: request.mode
      )
    )

    return try await executePreparedTransaction(
      client: client,
      signedClient: signedClient,
      network: network,
      prepared: prepared,
      selectFeeOption: selectFeeOption,
      waitForStatus: waitForStatus,
      statusPolling: statusPolling
    )
  }

  private func callContractWithStatusPolling(
    client: OMSClient,
    network: Network,
    contract: String,
    method: String,
    args: [AbiArg]?,
    mode: TransactionMode,
    selectFeeOption: FeeOptionSelector?,
    waitForStatus: Bool,
    statusPolling: OmsBridgeTransactionStatusPollingOptions
  ) async throws -> SendTransactionResponse {
    let walletId = try requireActiveWalletId(client)
    let signedClient = try signedWalletClient(client)
    let prepared = try await signedClient.prepareEthereumContractCall(
      PrepareEthereumContractCallRequest(
        network: network.chainId,
        walletId: walletId,
        contract: contract,
        method: method,
        args: args,
        mode: mode
      )
    )

    return try await executePreparedTransaction(
      client: client,
      signedClient: signedClient,
      network: network,
      prepared: prepared,
      selectFeeOption: selectFeeOption,
      waitForStatus: waitForStatus,
      statusPolling: statusPolling
    )
  }

  private func executePreparedTransaction(
    client: OMSClient,
    signedClient: WaasWalletClient,
    network: Network,
    prepared: PrepareResponse,
    selectFeeOption: FeeOptionSelector?,
    waitForStatus: Bool,
    statusPolling: OmsBridgeTransactionStatusPollingOptions
  ) async throws -> SendTransactionResponse {
    let feeOption = try await chooseFeeOption(
      client: client,
      network: network,
      prepared: prepared,
      selectFeeOption: selectFeeOption
    )
    let executed = try await signedClient.execute(
      ExecuteRequest(txnId: prepared.txnId, feeOption: feeOption)
    )

    if !waitForStatus {
      return SendTransactionResponse(
        txnId: prepared.txnId,
        status: executed.status
      )
    }

    let status = try await waitForTransactionStatus(
      signedClient: signedClient,
      txnId: prepared.txnId,
      fallbackStatus: executed.status,
      options: statusPolling
    )
    return SendTransactionResponse(
      txnId: prepared.txnId,
      status: status.status,
      txnHash: status.txnHash
    )
  }

  private func chooseFeeOption(
    client: OMSClient,
    network: Network,
    prepared: PrepareResponse,
    selectFeeOption: FeeOptionSelector?
  ) async throws -> FeeOptionSelection? {
    guard !prepared.sponsored else {
      return nil
    }

    guard !prepared.feeOptions.isEmpty else {
      throw TransactionError.noFeeOptionsAvailable
    }

    guard let selectFeeOption else {
      guard let first = prepared.feeOptions.first else {
        throw TransactionError.noFeeOptionsAvailable
      }
      return FeeOptionSelection(feeOption: first)
    }

    let walletAddress = try requireActiveWalletAddress(client)
    let selection = try await selectFeeOption(
      enrichFeeOptionsWithBalances(
        client: client,
        network: network,
        walletAddress: walletAddress,
        feeOptions: prepared.feeOptions
      )
    )

    guard let selection else {
      throw TransactionError.noFeeOptionSelected
    }

    return selection
  }

  private func enrichFeeOptionsWithBalances(
    client: OMSClient,
    network: Network,
    walletAddress: String,
    feeOptions: [FeeOption]
  ) async -> [FeeOptionWithBalance] {
    let nativeBalance: TokenBalance?
    if feeOptions.contains(where: { isNativeFeeToken($0.token) }) {
      nativeBalance = try? await client.indexer.getNativeTokenBalance(
        network: network,
        walletAddress: walletAddress
      )
    } else {
      nativeBalance = nil
    }

    var balancesByContract: [String: TokenBalance?] = [:]
    let contractAddresses = feeOptions
      .compactMap { normalizedAddress($0.token.contractAddress) }
      .reduce(into: [String]()) { addresses, address in
        if !addresses.contains(address) {
          addresses.append(address)
        }
      }

    for contractAddress in contractAddresses {
      balancesByContract[contractAddress] = await loadTokenBalanceOrZero(
        client: client,
        network: network,
        contractAddress: contractAddress,
        walletAddress: walletAddress
      )
    }

    return feeOptions.map { feeOption in
      let balance: TokenBalance?
      if isNativeFeeToken(feeOption.token) {
        balance = nativeBalance
      } else {
        balance = normalizedAddress(feeOption.token.contractAddress)
          .flatMap { balancesByContract[$0] ?? nil }
      }

      let decimals = feeOption.token.decimals.map(Int.init)
      return FeeOptionWithBalance(
        feeOption: feeOption,
        balance: balance,
        available: formatTokenAmount(balance?.balance, decimals: decimals),
        availableRaw: balance?.balance,
        decimals: decimals
      )
    }
  }

  private func loadTokenBalanceOrZero(
    client: OMSClient,
    network: Network,
    contractAddress: String,
    walletAddress: String
  ) async -> TokenBalance? {
    do {
      let result = try await client.indexer.getTokenBalances(
        network: network,
        contractAddress: contractAddress,
        walletAddress: walletAddress,
        includeMetadata: false
      )
      return result.balances.first {
        normalizedAddress($0.contractAddress) == contractAddress
      } ?? TokenBalance(
        contractType: "ERC20",
        contractAddress: contractAddress,
        accountAddress: walletAddress,
        tokenId: nil,
        balance: "0",
        blockHash: nil,
        blockNumber: nil,
        chainId: Int64(network.chainId)
      )
    } catch {
      return nil
    }
  }

  private func waitForTransactionStatus(
    signedClient: WaasWalletClient,
    txnId: String,
    fallbackStatus: TransactionStatus,
    options: OmsBridgeTransactionStatusPollingOptions
  ) async throws -> TransactionStatusResponse {
    let deadline = Date().addingTimeInterval(TimeInterval(options.timeoutMs) / 1000)
    var lastStatus = TransactionStatusResponse(status: fallbackStatus)
    var completedPolls = 0

    while true {
      lastStatus = try await signedClient.transactionStatus(
        TransactionStatusRequest(txnId: txnId)
      )
      completedPolls += 1

      if isSubmittedTransactionResult(lastStatus) {
        return lastStatus
      }

      let delayMs = transactionStatusPollDelayMs(
        completedPolls: completedPolls,
        options: options
      )
      if delayMs <= 0 || Date() >= deadline {
        return lastStatus
      }

      let remainingMs = max(0, Int(deadline.timeIntervalSinceNow * 1000))
      let sleepMs = min(delayMs, remainingMs)
      if sleepMs <= 0 {
        return lastStatus
      }

      try await Task.sleep(nanoseconds: UInt64(sleepMs) * 1_000_000)
    }
  }

  private func transactionStatusPollDelayMs(
    completedPolls: Int,
    options: OmsBridgeTransactionStatusPollingOptions
  ) -> Int {
    return completedPolls < options.fastPollCount
      ? options.fastIntervalMs
      : options.intervalMs
  }

  private func signedWalletClient(_ client: OMSClient) throws -> WaasWalletClient {
    // The Swift SDK does not expose waitForStatus/statusPolling knobs yet.
    // Keep RN's API stable by reusing the SDK's signed WaaS client for the
    // bridge-owned prepare/execute/polling path.
    let mirror = Mirror(reflecting: client.wallet)
    for child in mirror.children {
      if (child.label == "signedClient" || child.label == "_signedClient"),
         let signedClient = child.value as? WaasWalletClient {
        return signedClient
      }
    }
    throw makeError("Unable to access signed wallet client")
  }

  private func requireActiveWalletId(_ client: OMSClient) throws -> String {
    let walletId = client.wallet.walletId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !walletId.isEmpty else {
      throw makeError("No active wallet session")
    }
    return walletId
  }

  private func isSubmittedTransactionResult(_ response: TransactionStatusResponse) -> Bool {
    response.status == .executed || hasTransactionHash(response.txnHash)
  }

  private func hasTransactionHash(_ txnHash: String?) -> Bool {
    guard let txnHash = txnHash?.trimmingCharacters(in: .whitespacesAndNewlines) else {
      return false
    }
    return !txnHash.isEmpty
  }

  private func isNativeFeeToken(_ token: FeeToken) -> Bool {
    token.type.caseInsensitiveCompare("native") == .orderedSame
      || ((token.contractAddress?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        && (token.tokenId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true))
  }

  private func normalizedAddress(_ address: String?) -> String? {
    guard let address = address?.trimmingCharacters(in: .whitespacesAndNewlines), !address.isEmpty else {
      return nil
    }
    return address.lowercased()
  }

  private func formatTokenAmount(_ rawAmount: String?, decimals: Int?) -> String? {
    guard let rawAmount = rawAmount?.trimmingCharacters(in: .whitespacesAndNewlines),
          !rawAmount.isEmpty else {
      return nil
    }
    guard let decimals, decimals > 0 else {
      return rawAmount
    }

    let isNegative = rawAmount.hasPrefix("-")
    let unsignedAmount = isNegative ? String(rawAmount.dropFirst()) : rawAmount
    let paddedAmount = String(
      repeating: "0",
      count: max(0, decimals + 1 - unsignedAmount.count)
    ) + unsignedAmount
    let integerLength = paddedAmount.count - decimals
    let integerEnd = paddedAmount.index(paddedAmount.startIndex, offsetBy: integerLength)
    let integerPart = String(paddedAmount[..<integerEnd])
    let fractionPart = trimTrailingZeros(String(paddedAmount[integerEnd...]))
    let formatted = fractionPart.isEmpty ? integerPart : "\(integerPart).\(fractionPart)"
    return isNegative ? "-\(formatted)" : formatted
  }

  private func trimTrailingZeros(_ value: String) -> String {
    var result = value
    while result.last == "0" {
      result.removeLast()
    }
    return result
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
      "loginType": nullableString(session?.loginType.map(sessionLoginTypeString)),
      "sessionEmail": nullableString(session?.sessionEmail)
    ]
  }

  private func sessionExpiredEventDictionary(_ event: SessionExpiredEvent) -> [String: Any] {
    [
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
  ) throws -> OmsBridgeTransactionStatusPollingOptions? {
    guard timeoutMs != nil
      || intervalMs != nil
      || fastIntervalMs != nil
      || fastPollCount != nil else {
      return nil
    }

    return OmsBridgeTransactionStatusPollingOptions(
      timeoutMs: UInt64(try uint32(timeoutMs, name: "statusPolling.timeoutMs") ?? 60_000),
      intervalMs: Int(try uint32(intervalMs, name: "statusPolling.intervalMs") ?? 2_000),
      fastIntervalMs: Int(try uint32(fastIntervalMs, name: "statusPolling.fastIntervalMs") ?? 400),
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
        "code": code,
        "retryable": omsError.retryable
      ]
      if let operation = omsError.operation {
        userInfo["operation"] = operation.rawValue
      }
      if let status = omsError.status {
        userInfo["status"] = NSNumber(value: status)
      }
      if let txnId = omsError.txnId {
        userInfo["txnId"] = txnId
      }
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

private struct OmsBridgeTransactionStatusPollingOptions: Sendable {
  static let defaultOptions = OmsBridgeTransactionStatusPollingOptions(
    timeoutMs: 60_000,
    intervalMs: 2_000,
    fastIntervalMs: 400,
    fastPollCount: 5
  )

  let timeoutMs: UInt64
  let intervalMs: Int
  let fastIntervalMs: Int
  let fastPollCount: Int
}

private struct SerializableOidcProviderConfig: Decodable {
  let issuer: String
  let clientId: String
  let authorizationUrl: String
  let scopes: [String]?
  let relayRedirectUri: String?
  let authorizeParams: [String: String]?
}
