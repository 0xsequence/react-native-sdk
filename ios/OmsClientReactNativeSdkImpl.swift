import Foundation
import OMS_SDK
import React

@objc(OmsClientReactNativeSdkImpl)
public final class OmsClientReactNativeSdkImpl: NSObject, @unchecked Sendable {
  private var client: OMSClient?

  @objc(configureWithProjectAccessKey:projectId:walletApiUrl:apiRpcUrl:indexerUrlTemplate:resolve:reject:)
  public func configure(
    projectAccessKey: String,
    projectId: String,
    walletApiUrl: String?,
    apiRpcUrl: String?,
    indexerUrlTemplate: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let environment = OMSClientEnvironment(
      walletApiUrl: walletApiUrl ?? OMSClientEnvironment.defaultWalletApiUrl,
      apiRpcUrl: apiRpcUrl ?? OMSClientEnvironment.defaultApiRpcUrl,
      indexerUrlTemplate: indexerUrlTemplate ?? OMSClientEnvironment.defaultIndexerUrlTemplate
    )

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

  @objc(completeEmailAuthWithCode:resolve:reject:)
  public func completeEmailAuth(
    code: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      try await client.wallet.completeEmailAuth(code: code)
      return self.walletDictionary(client.wallet)
    }
  }

  @objc(signOutWithResolve:reject:)
  public func signOut(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
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

  @objc(sendTransactionWithChainId:to:value:data:resolve:reject:)
  public func sendTransaction(
    chainId: String,
    to: String,
    value: String,
    data: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      let result = try await client.wallet.sendTransaction(
        network: network,
        request: SendTransactionRequest(to: to, value: value, data: data)
      )
      return self.sendTransactionResultDictionary(result)
    }
  }

  private func sendTransactionResultDictionary(_ result: SendTransactionResponse) -> [String: Any] {
    [
      "txnId": result.txnId,
      "status": result.status.wireValue,
      "txnHash": result.txnHash ?? NSNull()
    ]
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

  @objc(verifyMessageSignatureWithChainId:walletAddress:message:signature:resolve:reject:)
  public func verifyMessageSignature(
    chainId: String,
    walletAddress: String,
    message: String,
    signature: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(resolve: resolve, reject: reject) { client in
      let network = try self.requireNetwork(client, chainId: chainId)
      return try await client.wallet.isValidMessageSignature(
        network: network,
        walletAddress: walletAddress,
        message: message,
        signature: signature
      )
    }
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
    guard let chainIdValue = Int(chainId),
          let network = client.findNetworkById(chainId: chainIdValue) else {
      throw makeError("Unsupported chain id: \(chainId)")
    }
    return network
  }

  private func walletDictionary(_ wallet: WalletClient) -> [String: Any] {
    [
      "id": wallet.walletId,
      "address": wallet.walletAddress
    ]
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
