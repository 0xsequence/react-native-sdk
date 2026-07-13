package com.omswalletreactnativesdk

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import technology.polygon.omswallet.Network
import technology.polygon.omswallet.OMSWallet
import technology.polygon.omswallet.OMSWalletEmailSessionAuth
import technology.polygon.omswallet.OMSWalletNetworks
import technology.polygon.omswallet.OMSWalletOidcSessionAuth
import technology.polygon.omswallet.OMSWalletOidcSessionAuthFlow
import technology.polygon.omswallet.OMSWalletSessionState
import technology.polygon.omswallet.OMSWalletException
import technology.polygon.omswallet.OMSWalletUpstreamError
import technology.polygon.omswallet.models.AbiArg
import technology.polygon.omswallet.models.ContractVerificationStatus
import technology.polygon.omswallet.models.CredentialInfo
import technology.polygon.omswallet.models.FeeOption
import technology.polygon.omswallet.models.FeeOptionSelection
import technology.polygon.omswallet.models.FeeOptionSelector
import technology.polygon.omswallet.models.FeeOptionWithBalance
import technology.polygon.omswallet.models.FeeToken
import technology.polygon.omswallet.models.IndexerNetworkType
import technology.polygon.omswallet.models.ListAccessResponse
import technology.polygon.omswallet.models.MetadataOptions
import technology.polygon.omswallet.models.Page
import technology.polygon.omswallet.models.SendTransactionRequest
import technology.polygon.omswallet.models.TokenBalance
import technology.polygon.omswallet.models.TokenBalancesPage
import technology.polygon.omswallet.models.TokenBalancesPageRequest
import technology.polygon.omswallet.models.TokenBalancesResult
import technology.polygon.omswallet.models.TokenContractInfo
import technology.polygon.omswallet.models.TokenMetadata
import technology.polygon.omswallet.models.TokenMetadataAsset
import technology.polygon.omswallet.models.Transaction
import technology.polygon.omswallet.models.TransactionHistoryResult
import technology.polygon.omswallet.models.TransactionMode
import technology.polygon.omswallet.models.TransactionStatusPollingOptions
import technology.polygon.omswallet.models.TransactionStatusResponse
import technology.polygon.omswallet.models.TransactionTransfer
import technology.polygon.omswallet.models.Wallet
import technology.polygon.omswallet.models.WalletType
import technology.polygon.omswallet.wallet.CompleteAuthResult
import technology.polygon.omswallet.wallet.CustomOidcProviderConfig
import technology.polygon.omswallet.wallet.OidcRedirectAuthMode
import technology.polygon.omswallet.wallet.OidcRedirectAuthResult
import technology.polygon.omswallet.wallet.OmsRelayOidcProvider
import technology.polygon.omswallet.wallet.OmsRelayOidcProviders
import technology.polygon.omswallet.wallet.PendingWalletSelection
import technology.polygon.omswallet.wallet.WalletSelectionBehavior
import technology.polygon.omswallet.wallet.WalletSelectionResult
import technology.polygon.omswallet.wallet.WalletClient
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.math.BigInteger
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private data class StoredPendingWalletSelection(
  val clientId: String,
  val selection: PendingWalletSelection
)

private sealed interface BridgeOidcProvider {
  data class OmsRelay(val value: OmsRelayOidcProvider) : BridgeOidcProvider
  data class Custom(val value: CustomOidcProviderConfig) : BridgeOidcProvider
}

class OmsWalletReactNativeSdkModule(reactContext: ReactApplicationContext) :
  NativeOmsWalletReactNativeSdkSpec(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val pendingFeeOptionSelections = ConcurrentHashMap<String, CompletableDeferred<FeeOptionSelection?>>()
  private val pendingWalletSelections = ConcurrentHashMap<String, StoredPendingWalletSelection>()
  private val sessionExpiredUnsubscribes = ConcurrentHashMap<String, () -> Unit>()
  private val clients = ConcurrentHashMap<String, OMSWallet>()

  override fun createClient(
    clientId: String,
    publishableKey: String,
    promise: Promise
  ) {
    try {
      clearPendingWalletSelections(clientId)
      sessionExpiredUnsubscribes.remove(clientId)?.invoke()
      val activeClient = OMSWallet(
        context = reactApplicationContext,
        publishableKey = publishableKey
      )
      clients[clientId] = activeClient
      sessionExpiredUnsubscribes[clientId] = activeClient.wallet.onSessionExpired { event ->
        emitOnSessionExpired(
          Arguments.createMap().apply {
            putString("clientId", clientId)
            putMap("session", sessionMap(event.session))
            putString("expiredAt", event.expiredAt)
          }
        )
      }
      promise.resolve(null)
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun getWalletAddress(clientId: String, promise: Promise) {
    try {
      promise.resolve(requireClient(clientId).wallet.walletAddress)
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun getSession(clientId: String, promise: Promise) {
    try {
      promise.resolve(sessionMap(requireClient(clientId).wallet.session))
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun startEmailAuth(clientId: String, email: String, promise: Promise) {
    launch(promise) {
      requireClient(clientId).wallet.startEmailAuth(email)
      null
    }
  }

  override fun completeEmailAuth(
    clientId: String,
    code: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    promise: Promise
  ) {
    launch(promise) {
      completeAuthResultMap(
        clientId,
        requireClient(clientId).wallet.completeEmailAuth(
          code = code,
          walletSelection = walletSelection.toWalletSelectionBehavior(),
          walletType = walletType.toWalletType(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toSessionLifetimeSeconds()
        )
      )
    }
  }

  override fun signInWithOidcIdToken(
    clientId: String,
    idToken: String,
    issuer: String,
    audience: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    provider: String?,
    providerLabel: String?,
    promise: Promise
  ) {
    launch(promise) {
      completeAuthResultMap(
        clientId,
        requireClient(clientId).wallet.signInWithOidcIdToken(
          idToken = idToken,
          issuer = issuer,
          audience = audience,
          walletSelection = walletSelection.toWalletSelectionBehavior(),
          walletType = walletType.toWalletType(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toSessionLifetimeSeconds(),
          provider = provider,
          providerLabel = providerLabel
        )
      )
    }
  }

  override fun startOidcRedirectAuth(
    clientId: String,
    providerJson: String,
    omsRelayReturnUri: String?,
    walletType: String?,
    walletSelection: String?,
    sessionLifetimeSeconds: String?,
    authorizeParamsJson: String?,
    loginHint: String?,
    promise: Promise
  ) {
    launch(promise) {
      val client = requireClient(clientId)
      val provider = providerJson.toBridgeOidcProvider()
      val result = when (provider) {
        is BridgeOidcProvider.OmsRelay -> client.wallet.startOidcRedirectAuth(
          provider = provider.value,
          omsRelayReturnUri = omsRelayReturnUri
            ?: error("OMS relay OIDC provider requires omsRelayReturnUri"),
          walletType = walletType.toWalletType(),
          walletSelection = walletSelection.toOptionalWalletSelectionBehavior(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toOptionalSessionLifetimeSeconds(),
          loginHint = loginHint
        )

        is BridgeOidcProvider.Custom -> client.wallet.startOidcRedirectAuth(
          provider = provider.value,
          walletType = walletType.toWalletType(),
          walletSelection = walletSelection.toOptionalWalletSelectionBehavior(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toOptionalSessionLifetimeSeconds(),
          authorizeParams = authorizeParamsJson.toStringMap("authorizeParams") ?: emptyMap(),
          loginHint = loginHint
        )
      }
      Arguments.createMap().apply {
        putString("authorizationUrl", result.authorizationUrl)
      }
    }
  }

  override fun handleOidcRedirectCallback(
    clientId: String,
    callbackUrl: String?,
    walletSelection: String?,
    sessionLifetimeSeconds: String?,
    promise: Promise
  ) {
    launch(promise) {
      when (
        val result = requireClient(clientId).wallet.handleOidcRedirectCallback(
          callbackUrl = callbackUrl,
          walletSelection = walletSelection.toOptionalWalletSelectionBehavior(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toOptionalSessionLifetimeSeconds()
        )
      ) {
        is OidcRedirectAuthResult.Completed ->
          Arguments.createMap().apply {
            clearPendingWalletSelections(clientId)
            putString("type", "completed")
            putMap("result", completeAuthResultMap(clientId, result.result))
          }

        is OidcRedirectAuthResult.NotOidcRedirectCallback ->
          Arguments.createMap().apply { putString("type", "notOidcRedirectCallback") }

        is OidcRedirectAuthResult.NoPendingAuth ->
          Arguments.createMap().apply { putString("type", "noPendingAuth") }

      }
    }
  }

  override fun listWallets(clientId: String, promise: Promise) {
    launch(promise) {
      Arguments.createArray().apply {
        requireClient(clientId).wallet.listWallets().forEach { pushMap(walletMap(it)) }
      }
    }
  }

  override fun useWallet(clientId: String, walletId: String, promise: Promise) {
    launch(promise) {
      walletActivationResultMap(requireClient(clientId).wallet.useWallet(walletId))
    }
  }

  override fun createWallet(clientId: String, walletType: String?, reference: String?, promise: Promise) {
    launch(promise) {
      walletActivationResultMap(
        requireClient(clientId).wallet.createWallet(
          walletType = walletType.toWalletType(),
          reference = reference
        )
      )
    }
  }

  override fun selectWalletForPendingSelection(
    clientId: String,
    pendingSelectionId: String,
    walletId: String,
    promise: Promise
  ) {
    launch(promise) {
      val pendingSelection =
        pendingWalletSelections[pendingSelectionId]
          ?: error("Pending wallet selection is no longer available")
      if (pendingSelection.clientId != clientId) {
        error("Pending wallet selection belongs to a different OMS client")
      }
      val result = pendingSelection.selection.selectWallet(walletId)
      pendingWalletSelections.remove(pendingSelectionId)
      walletActivationResultMap(result)
    }
  }

  override fun createAndSelectWalletForPendingSelection(
    clientId: String,
    pendingSelectionId: String,
    reference: String?,
    promise: Promise
  ) {
    launch(promise) {
      val pendingSelection =
        pendingWalletSelections[pendingSelectionId]
          ?: error("Pending wallet selection is no longer available")
      if (pendingSelection.clientId != clientId) {
        error("Pending wallet selection belongs to a different OMS client")
      }
      val result = pendingSelection.selection.createAndSelectWallet(reference)
      pendingWalletSelections.remove(pendingSelectionId)
      walletActivationResultMap(result)
    }
  }

  override fun signOut(clientId: String, promise: Promise) {
    try {
      clearPendingWalletSelections(clientId)
      requireClient(clientId).wallet.signOut()
      promise.resolve(null)
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun signMessage(clientId: String, chainId: String, message: String, promise: Promise) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      activeClient.wallet.signMessage(
        network = activeClient.requireNetwork(chainId),
        message = message
      )
    }
  }

  override fun signTypedData(clientId: String, chainId: String, typedDataJson: String, promise: Promise) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      activeClient.wallet.signTypedData(
        network = activeClient.requireNetwork(chainId),
        typedData = json.parseToJsonElement(typedDataJson)
      )
    }
  }

  override fun sendTransaction(
    clientId: String,
    chainId: String,
    to: String,
    value: String,
    data: String?,
    mode: String?,
    feeOptionSelectorId: String?,
    waitForStatus: Boolean,
    statusPollingTimeoutMs: String?,
    statusPollingIntervalMs: String?,
    statusPollingFastIntervalMs: String?,
    statusPollingFastPollCount: String?,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      val result = activeClient.wallet.sendTransaction(
        network = activeClient.requireNetwork(chainId),
        request = SendTransactionRequest(
          to = to,
          value = BigInteger(value),
          data = data,
          mode = mode.toTransactionMode()
        ),
        selectFeeOption = feeOptionSelector(feeOptionSelectorId),
        waitForStatus = waitForStatus,
        statusPolling = statusPollingOptions(
          timeoutMs = statusPollingTimeoutMs,
          intervalMs = statusPollingIntervalMs,
          fastIntervalMs = statusPollingFastIntervalMs,
          fastPollCount = statusPollingFastPollCount
        )
      )

      sendTransactionResponseMap(result)
    }
  }

  override fun callContract(
    clientId: String,
    chainId: String,
    contractAddress: String,
    method: String,
    argsJson: String?,
    mode: String?,
    feeOptionSelectorId: String?,
    waitForStatus: Boolean,
    statusPollingTimeoutMs: String?,
    statusPollingIntervalMs: String?,
    statusPollingFastIntervalMs: String?,
    statusPollingFastPollCount: String?,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      val result = activeClient.wallet.callContract(
        network = activeClient.requireNetwork(chainId),
        contract = contractAddress,
        method = method,
        args = argsJson.toAbiArgs(),
        mode = mode.toTransactionMode(),
        selectFeeOption = feeOptionSelector(feeOptionSelectorId),
        waitForStatus = waitForStatus,
        statusPolling = statusPollingOptions(
          timeoutMs = statusPollingTimeoutMs,
          intervalMs = statusPollingIntervalMs,
          fastIntervalMs = statusPollingFastIntervalMs,
          fastPollCount = statusPollingFastPollCount
        )
      )

      sendTransactionResponseMap(result)
    }
  }

  override fun respondToFeeOptionSelection(
    requestId: String,
    selectionToken: String?,
    errorMessage: String?,
    promise: Promise
  ) {
    try {
      val deferred =
        pendingFeeOptionSelections.remove(requestId)
          ?: error("Unknown fee option selection request: $requestId")

      if (errorMessage == null) {
        deferred.complete(selectionToken?.let(::FeeOptionSelection))
      } else {
        deferred.completeExceptionally(IllegalStateException(errorMessage))
      }
      promise.resolve(null)
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun getTransactionStatus(clientId: String, txnId: String, promise: Promise) {
    launch(promise) {
      transactionStatusMap(requireClient(clientId).wallet.getTransactionStatus(txnId))
    }
  }

  override fun getBalances(
    clientId: String,
    paramsJson: String,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      val params = paramsJson.toJsonObject("params")
      tokenBalancesResultMap(
        activeClient.indexer.getBalances(
          walletAddress = params.requiredStringParam("walletAddress"),
          networks = params.networksParam(activeClient),
          networkType = params.indexerNetworkTypeParam("networkType") ?: IndexerNetworkType.MAINNETS,
          contractAddresses = params.stringListParam("contractAddresses"),
          includeMetadata = params.booleanParam("includeMetadata") ?: true,
          omitPrices = params.booleanParam("omitPrices"),
          tokenIds = params.stringListParam("tokenIds"),
          contractStatus = params.contractVerificationStatusParam("contractStatus"),
          page = params.tokenBalancesPageRequestParam()
        )
      )
    }
  }

  override fun getTransactionHistory(
    clientId: String,
    paramsJson: String,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      val params = paramsJson.toJsonObject("params")
      transactionHistoryResultMap(
        activeClient.indexer.getTransactionHistory(
          walletAddress = params.requiredStringParam("walletAddress"),
          networks = params.networksParam(activeClient),
          networkType = params.indexerNetworkTypeParam("networkType") ?: IndexerNetworkType.MAINNETS,
          contractAddresses = params.stringListParam("contractAddresses"),
          transactionHashes = params.stringListParam("transactionHashes"),
          metaTransactionIds = params.stringListParam("metaTransactionIds"),
          fromBlock = params.longParam("fromBlock"),
          toBlock = params.longParam("toBlock"),
          tokenId = params.stringParam("tokenId"),
          includeMetadata = params.booleanParam("includeMetadata") ?: true,
          omitPrices = params.booleanParam("omitPrices"),
          metadataOptions = params.metadataOptionsParam("metadataOptions"),
          page = params.tokenBalancesPageRequestParam()
        )
      )
    }
  }

  override fun verifyMessageSignature(
    clientId: String,
    chainId: String,
    message: String,
    signature: String,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      activeClient.wallet.isValidMessageSignature(
        network = activeClient.requireNetwork(chainId),
        message = message,
        signature = signature
      )
    }
  }

  override fun verifyTypedDataSignature(
    clientId: String,
    chainId: String,
    typedDataJson: String,
    signature: String,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient(clientId)
      activeClient.wallet.isValidTypedDataSignature(
        network = activeClient.requireNetwork(chainId),
        typedData = json.parseToJsonElement(typedDataJson),
        signature = signature
      )
    }
  }

  override fun getIdToken(clientId: String, ttlSeconds: String?, customClaimsJson: String?, promise: Promise) {
    launch(promise) {
      requireClient(clientId).wallet.getIdToken(
        ttlSeconds = ttlSeconds.toUIntOrNullParam("ttlSeconds"),
        customClaims = customClaimsJson.toJsonObjectMap("customClaims")
      )
    }
  }

  override fun listAccess(clientId: String, pageSize: String?, promise: Promise) {
    launch(promise) {
      Arguments.createArray().apply {
        requireClient(clientId).wallet.listAccess(
          pageSize = pageSize.toUIntOrNullParam("pageSize")
        ).forEach { pushMap(credentialInfoMap(it)) }
      }
    }
  }

  override fun listAccessPage(clientId: String, pageSize: String?, cursor: String?, promise: Promise) {
    launch(promise) {
      listAccessResponseMap(
        requireClient(clientId).wallet.listAccessPage(
          pageSize = pageSize.toUIntOrNullParam("pageSize"),
          cursor = cursor
        )
      )
    }
  }

  override fun revokeAccess(clientId: String, targetCredentialId: String, promise: Promise) {
    launch(promise) {
      requireClient(clientId).wallet.revokeAccess(targetCredentialId)
      null
    }
  }

  override fun invalidate() {
    sessionExpiredUnsubscribes.values.forEach { it.invoke() }
    sessionExpiredUnsubscribes.clear()
    clients.clear()
    pendingWalletSelections.clear()
    scope.cancel()
    super.invalidate()
  }

  private fun launch(promise: Promise, block: suspend () -> Any?) {
    scope.launch {
      try {
        promise.resolve(block())
      } catch (throwable: CancellationException) {
        throw throwable
      } catch (throwable: Throwable) {
        reject(promise, throwable)
      }
    }
  }

  private fun requireClient(clientId: String): OMSWallet =
    clients[clientId] ?: error("OMS client is not initialized: $clientId")

  private fun OMSWallet.requireNetwork(chainId: String): Network =
    OMSWalletNetworks.supportedNetworks.firstOrNull { it.id.toString() == chainId }
      ?: error("Unsupported chain id: $chainId")

  private fun completeAuthResultMap(clientId: String, result: CompleteAuthResult): WritableMap =
    when (result) {
      is CompleteAuthResult.WalletSelected -> {
        clearPendingWalletSelections(clientId)
        Arguments.createMap().apply {
          putString("type", "walletSelected")
          putString("walletAddress", result.walletAddress)
          putMap("wallet", walletMap(result.wallet))
          putArray(
            "wallets",
            Arguments.createArray().apply {
              result.wallets.forEach { pushMap(walletMap(it)) }
            }
          )
          putMap("credential", credentialInfoMap(result.credential))
        }
      }

      is CompleteAuthResult.WalletSelection ->
        Arguments.createMap().apply {
          clearPendingWalletSelections(clientId)
          putString("type", "walletSelection")
          putNull("walletAddress")
          putNull("wallet")
          putArray(
            "wallets",
            Arguments.createArray().apply {
              result.pendingSelection.wallets.forEach { pushMap(walletMap(it)) }
            }
          )
          putMap("credential", credentialInfoMap(result.pendingSelection.credential))
          putMap("pendingSelection", pendingWalletSelectionMap(clientId, result.pendingSelection))
        }
    }

  private fun feeOptionSelector(selectorId: String?): FeeOptionSelector? =
    selectorId?.let { id ->
      FeeOptionSelector { feeOptions -> requestFeeOptionSelection(id, feeOptions) }
    }

  private suspend fun requestFeeOptionSelection(
    selectorId: String,
    feeOptions: List<FeeOptionWithBalance>
  ): FeeOptionSelection? {
    val requestId = UUID.randomUUID().toString()
    val deferred = CompletableDeferred<FeeOptionSelection?>()
    pendingFeeOptionSelections[requestId] = deferred

    try {
      if (mEventEmitterCallback == null) {
        error("Fee option selector listener is not registered")
      }

      emitOnFeeOptionSelectionRequest(
        Arguments.createMap().apply {
          putString("selectorId", selectorId)
          putString("requestId", requestId)
          putArray(
            "options",
            Arguments.createArray().apply {
              feeOptions.forEach { pushMap(feeOptionWithBalanceMap(it)) }
            }
          )
        }
      )

      return deferred.await()
    } finally {
      pendingFeeOptionSelections.remove(requestId)
    }
  }

  private fun walletMap(wallet: Wallet): WritableMap =
    Arguments.createMap().apply {
      putString("id", wallet.id)
      putString("type", wallet.type.wireValue)
      putString("address", wallet.address)
      putNullableString("reference", wallet.reference)
    }

  private fun pendingWalletSelectionMap(
    clientId: String,
    pendingSelection: PendingWalletSelection
  ): WritableMap {
    val id = UUID.randomUUID().toString()
    pendingWalletSelections[id] = StoredPendingWalletSelection(clientId, pendingSelection)
    return Arguments.createMap().apply {
      putString("id", id)
      putString("walletType", pendingSelection.walletType.wireValue)
      putArray(
        "wallets",
        Arguments.createArray().apply {
          pendingSelection.wallets.forEach { pushMap(walletMap(it)) }
        }
      )
      putMap("credential", credentialInfoMap(pendingSelection.credential))
    }
  }

  private fun clearPendingWalletSelections(clientId: String) {
    pendingWalletSelections.entries.removeIf { it.value.clientId == clientId }
  }

  private fun walletActivationResultMap(result: WalletSelectionResult): WritableMap =
    Arguments.createMap().apply {
      putString("walletAddress", result.walletAddress)
      putMap("wallet", walletMap(result.wallet))
    }

  private fun sessionMap(session: OMSWalletSessionState): WritableMap =
    Arguments.createMap().apply {
      putNullableString("walletAddress", session.walletAddress)
      putNullableString("expiresAt", session.expiresAt)
      when (val auth = session.auth) {
        null -> putNull("auth")
        is OMSWalletEmailSessionAuth -> putMap(
          "auth",
          Arguments.createMap().apply {
            putString("type", "email")
            putNullableString("email", auth.email)
          }
        )
        is OMSWalletOidcSessionAuth -> putMap(
          "auth",
          Arguments.createMap().apply {
            putString("type", "oidc")
            putString(
              "flow",
              when (auth.flow) {
                OMSWalletOidcSessionAuthFlow.Redirect -> "redirect"
                OMSWalletOidcSessionAuthFlow.IdToken -> "id-token"
              }
            )
            putString("issuer", auth.issuer)
            putNullableString("provider", auth.provider)
            putNullableString("providerLabel", auth.providerLabel)
            putNullableString("email", auth.email)
          }
        )
      }
    }

  private fun tokenBalancesResultMap(result: TokenBalancesResult): WritableMap =
    Arguments.createMap().apply {
      putInt("status", result.status)
      result.page?.let { putMap("page", tokenBalancesPageMap(it)) } ?: putNull("page")
      putArray(
        "nativeBalances",
        Arguments.createArray().apply {
          result.nativeBalances.forEach { pushMap(tokenBalanceMap(it)) }
        }
      )
      putArray(
        "balances",
        Arguments.createArray().apply {
          result.balances.forEach { pushMap(tokenBalanceMap(it)) }
        }
      )
    }

  private fun transactionHistoryResultMap(result: TransactionHistoryResult): WritableMap =
    Arguments.createMap().apply {
      putInt("status", result.status)
      result.page?.let { putMap("page", tokenBalancesPageMap(it)) } ?: putNull("page")
      putArray(
        "transactions",
        Arguments.createArray().apply {
          result.transactions.forEach { pushMap(transactionMap(it)) }
        }
      )
    }

  private fun tokenBalancesPageMap(page: TokenBalancesPage): WritableMap =
    Arguments.createMap().apply {
      putInt("page", page.page)
      putInt("pageSize", page.pageSize)
      putBoolean("more", page.more)
    }

  private fun tokenBalanceMap(balance: TokenBalance): WritableMap =
    Arguments.createMap().apply {
      putNullableString("contractType", balance.contractType)
      putNullableString("contractAddress", balance.contractAddress)
      putNullableString("accountAddress", balance.accountAddress)
      putNullableString("tokenId", balance.tokenId)
      putNullableString("balance", balance.balance)
      putNullableString("name", balance.name)
      putNullableString("symbol", balance.symbol)
      putNullableString("balanceUSD", balance.balanceUSD)
      putNullableString("priceUSD", balance.priceUSD)
      putNullableString("priceUpdatedAt", balance.priceUpdatedAt)
      putNullableString("blockHash", balance.blockHash)
      balance.blockNumber?.let { putDouble("blockNumber", it.toDouble()) }
      balance.chainId?.let { putDouble("chainId", it.toDouble()) }
      putNullableString("uniqueCollectibles", balance.uniqueCollectibles)
      balance.isSummary?.let { putBoolean("isSummary", it) } ?: putNull("isSummary")
      balance.contractInfo?.let { putMap("contractInfo", tokenContractInfoMap(it)) } ?: putNull("contractInfo")
      balance.tokenMetadata?.let { putMap("tokenMetadata", tokenMetadataMap(it)) } ?: putNull("tokenMetadata")
    }

  private fun tokenContractInfoMap(info: TokenContractInfo): WritableMap =
    Arguments.createMap().apply {
      info.chainId?.let { putDouble("chainId", it.toDouble()) } ?: putNull("chainId")
      putNullableString("address", info.address)
      putNullableString("source", info.source)
      putNullableString("name", info.name)
      putNullableString("type", info.type)
      putNullableString("symbol", info.symbol)
      info.decimals?.let { putDouble("decimals", it.toDouble()) } ?: putNull("decimals")
      putNullableString("logoURI", info.logoURI)
      info.deployed?.let { putBoolean("deployed", it) } ?: putNull("deployed")
      putNullableString("bytecodeHash", info.bytecodeHash)
      info.extensions?.let { putMap("extensions", jsonObjectMap(it)) } ?: putNull("extensions")
      putNullableString("updatedAt", info.updatedAt)
      putNullableString("queuedAt", info.queuedAt)
      putNullableString("status", info.status)
    }

  private fun tokenMetadataMap(metadata: TokenMetadata): WritableMap =
    Arguments.createMap().apply {
      metadata.chainId?.let { putDouble("chainId", it.toDouble()) } ?: putNull("chainId")
      putNullableString("contractAddress", metadata.contractAddress)
      putNullableString("tokenId", metadata.tokenId)
      putNullableString("source", metadata.source)
      putNullableString("name", metadata.name)
      putNullableString("description", metadata.description)
      putNullableString("image", metadata.image)
      putNullableString("video", metadata.video)
      putNullableString("audio", metadata.audio)
      metadata.properties?.let { putMap("properties", jsonObjectMap(it)) } ?: putNull("properties")
      metadata.attributes?.let {
        putArray(
          "attributes",
          Arguments.createArray().apply {
            it.forEach { attribute -> pushMap(jsonObjectMap(attribute)) }
          }
        )
      } ?: putNull("attributes")
      putNullableString("imageData", metadata.imageData)
      putNullableString("externalUrl", metadata.externalUrl)
      putNullableString("backgroundColor", metadata.backgroundColor)
      putNullableString("animationUrl", metadata.animationUrl)
      metadata.decimals?.let { putDouble("decimals", it.toDouble()) } ?: putNull("decimals")
      putNullableString("updatedAt", metadata.updatedAt)
      metadata.assets?.let {
        putArray(
          "assets",
          Arguments.createArray().apply {
            it.forEach { asset -> pushMap(tokenMetadataAssetMap(asset)) }
          }
        )
      } ?: putNull("assets")
      putNullableString("status", metadata.status)
      putNullableString("queuedAt", metadata.queuedAt)
      putNullableString("lastFetched", metadata.lastFetched)
    }

  private fun tokenMetadataAssetMap(asset: TokenMetadataAsset): WritableMap =
    Arguments.createMap().apply {
      asset.id?.let { putDouble("id", it.toDouble()) } ?: putNull("id")
      asset.collectionId?.let { putDouble("collectionId", it.toDouble()) } ?: putNull("collectionId")
      putNullableString("tokenId", asset.tokenId)
      putNullableString("url", asset.url)
      putNullableString("metadataField", asset.metadataField)
      putNullableString("name", asset.name)
      asset.filesize?.let { putDouble("filesize", it.toDouble()) } ?: putNull("filesize")
      putNullableString("mimeType", asset.mimeType)
      asset.width?.let { putDouble("width", it.toDouble()) } ?: putNull("width")
      asset.height?.let { putDouble("height", it.toDouble()) } ?: putNull("height")
      putNullableString("updatedAt", asset.updatedAt)
    }

  private fun transactionMap(transaction: Transaction): WritableMap =
    Arguments.createMap().apply {
      putNullableString("txnHash", transaction.txnHash)
      transaction.blockNumber?.let { putDouble("blockNumber", it.toDouble()) } ?: putNull("blockNumber")
      putNullableString("blockHash", transaction.blockHash)
      transaction.chainId?.let { putDouble("chainId", it.toDouble()) } ?: putNull("chainId")
      putNullableString("metaTxnId", transaction.metaTxnId)
      transaction.transfers?.let {
        putArray(
          "transfers",
          Arguments.createArray().apply {
            it.forEach { transfer -> pushMap(transactionTransferMap(transfer)) }
          }
        )
      } ?: putNull("transfers")
      putNullableString("timestamp", transaction.timestamp)
    }

  private fun transactionTransferMap(transfer: TransactionTransfer): WritableMap =
    Arguments.createMap().apply {
      putNullableString("transferType", transfer.transferType)
      putNullableString("contractAddress", transfer.contractAddress)
      putNullableString("contractType", transfer.contractType)
      putNullableString("from", transfer.from)
      putNullableString("to", transfer.to)
      transfer.tokenIds?.let { putArray("tokenIds", stringArray(it)) } ?: putNull("tokenIds")
      transfer.amounts?.let { putArray("amounts", stringArray(it)) } ?: putNull("amounts")
      transfer.logIndex?.let { putDouble("logIndex", it.toDouble()) } ?: putNull("logIndex")
      transfer.amountsUSD?.let { putArray("amountsUSD", stringArray(it)) } ?: putNull("amountsUSD")
      transfer.pricesUSD?.let { putArray("pricesUSD", stringArray(it)) } ?: putNull("pricesUSD")
      transfer.contractInfo?.let { putMap("contractInfo", tokenContractInfoMap(it)) } ?: putNull("contractInfo")
      transfer.tokenMetadata?.let { putMap("tokenMetadata", tokenMetadataRecordMap(it)) } ?: putNull("tokenMetadata")
    }

  private fun tokenMetadataRecordMap(value: Map<String, TokenMetadata>): WritableMap =
    Arguments.createMap().apply {
      value.forEach { (key, metadata) -> putMap(key, tokenMetadataMap(metadata)) }
    }

  private fun stringArray(value: Iterable<String>): WritableArray =
    Arguments.createArray().apply {
      value.forEach { pushString(it) }
    }

  private fun transactionStatusMap(result: TransactionStatusResponse): WritableMap =
    Arguments.createMap().apply {
      putString("status", result.status.wireValue)
      putNullableString("txnHash", result.txnHash)
    }

  private fun sendTransactionResponseMap(
    result: technology.polygon.omswallet.models.SendTransactionResponse
  ): WritableMap =
    Arguments.createMap().apply {
      putString("txnId", result.txnId)
      putString("status", result.status.wireValue)
      putNullableString("txnHash", result.txnHash)
      putString(
        "statusResolution",
        when (result.statusResolution.name) {
          "NotRequested" -> "not-requested"
          "Resolved" -> "resolved"
          "TimedOut" -> "timed-out"
          else -> error("Unsupported transaction status resolution")
        }
      )
    }

  private fun feeOptionWithBalanceMap(option: FeeOptionWithBalance): WritableMap =
    Arguments.createMap().apply {
      putMap("feeOption", feeOptionMap(option.feeOption))
      putMap("selection", feeOptionSelectionMap(option.selection))
      option.balance?.let { putMap("balance", tokenBalanceMap(it)) } ?: putNull("balance")
      putNullableString("available", option.available)
      putNullableString("availableRaw", option.availableRaw)
      option.decimals?.let { putDouble("decimals", it.toDouble()) } ?: putNull("decimals")
    }

  private fun feeOptionSelectionMap(selection: FeeOptionSelection): WritableMap =
    Arguments.createMap().apply {
      putString("token", selection.token)
    }

  private fun feeOptionMap(option: FeeOption): WritableMap =
    Arguments.createMap().apply {
      putMap("token", feeTokenMap(option.token))
      putString("value", option.value)
      putString("displayValue", option.displayValue)
    }

  private fun feeTokenMap(token: FeeToken): WritableMap =
    Arguments.createMap().apply {
      putString("network", token.network)
      putString("name", token.name)
      putString("symbol", token.symbol)
      putString("type", token.type)
      token.decimals?.let { putDouble("decimals", it.toDouble()) } ?: putNull("decimals")
      putNullableString("logoUrl", token.logoUrl)
      putNullableString("contractAddress", token.contractAddress)
      putNullableString("tokenId", token.tokenId)
    }

  private fun credentialInfoMap(credential: CredentialInfo): WritableMap =
    Arguments.createMap().apply {
      putString("credentialId", credential.credentialId)
      putString("expiresAt", credential.expiresAt)
      putBoolean("isCaller", credential.isCaller)
    }

  private fun listAccessResponseMap(response: ListAccessResponse): WritableMap =
    Arguments.createMap().apply {
      putArray(
        "credentials",
        Arguments.createArray().apply {
          response.credentials.forEach { pushMap(credentialInfoMap(it)) }
        }
      )
      val page = response.page
      if (page == null) {
        putNull("page")
      } else {
        putMap("page", pageMap(page))
      }
    }

  private fun pageMap(page: Page): WritableMap =
    Arguments.createMap().apply {
      page.limit?.let { putDouble("limit", it.toDouble()) } ?: putNull("limit")
      putNullableString("cursor", page.cursor)
    }

  private fun String?.toTransactionMode(): TransactionMode =
    when (this?.lowercase()) {
      null, "relayer" -> TransactionMode.Relayer
      "native" -> TransactionMode.Native
      else -> error("Unsupported transaction mode: $this")
    }

  private fun String?.toWalletType(): WalletType =
    when (this?.lowercase()) {
      null, "ethereum" -> WalletType.Ethereum
      else -> error("Unsupported wallet type: $this")
    }

  private fun String?.toWalletSelectionBehavior(): WalletSelectionBehavior =
    when (this?.lowercase()) {
      null, "automatic" -> WalletSelectionBehavior.Automatic
      "manual" -> WalletSelectionBehavior.Manual
      else -> error("Unsupported wallet selection behavior: $this")
    }

  private fun String?.toOptionalWalletSelectionBehavior(): WalletSelectionBehavior? =
    this?.toWalletSelectionBehavior()

  private fun String?.toUIntOrNullParam(name: String): UInt? =
    this?.toUIntOrNull() ?: this?.let { error("$name must be an unsigned integer") }

  private fun String?.toIntOrNullParam(name: String): Int? =
    this?.toIntOrNull()?.takeIf { it >= 0 } ?: this?.let { error("$name must be a non-negative integer") }

  private fun String?.toLongOrNullParam(name: String): Long? =
    this?.toLongOrNull()?.takeIf { it >= 0 } ?: this?.let { error("$name must be a non-negative integer") }

  private fun String?.toSessionLifetimeSeconds(): Long =
    this?.toLongOrNullParam("sessionLifetimeSeconds") ?: WalletClient.DEFAULT_SESSION_LIFETIME_SECONDS

  private fun String?.toOptionalSessionLifetimeSeconds(): Long? =
    this?.toLongOrNullParam("sessionLifetimeSeconds")

  private fun statusPollingOptions(
    timeoutMs: String?,
    intervalMs: String?,
    fastIntervalMs: String?,
    fastPollCount: String?
  ): TransactionStatusPollingOptions? {
    if (timeoutMs == null && intervalMs == null && fastIntervalMs == null && fastPollCount == null) {
      return null
    }

    return TransactionStatusPollingOptions(
      fastPollIntervalMillis = fastIntervalMs.toLongOrNullParam("statusPolling.fastIntervalMs") ?: 400L,
      fastPollCount = fastPollCount.toIntOrNullParam("statusPolling.fastPollCount") ?: 5,
      pollIntervalMillis = intervalMs.toLongOrNullParam("statusPolling.intervalMs") ?: 2_000L,
      timeoutMillis = timeoutMs.toLongOrNullParam("statusPolling.timeoutMs") ?: 60_000L
    )
  }

  private fun String?.toJsonObjectMap(name: String): Map<String, JsonElement>? {
    val value = this ?: return null
    val element = json.parseToJsonElement(value)
    return (element as? JsonObject)?.toMap() ?: error("$name must be a JSON object")
  }

  private fun String?.toStringMap(name: String): Map<String, String>? {
    val value = this ?: return null
    val element = json.parseToJsonElement(value)
    val jsonObject = element as? JsonObject ?: error("$name must be a JSON object")
    return jsonObject.mapValues { (_, item) -> item.jsonPrimitive.content }
  }

  private fun String.toJsonObject(name: String): JsonObject {
    val element = json.parseToJsonElement(this)
    return element as? JsonObject ?: error("$name must be a JSON object")
  }

  private fun JsonObject.requiredStringParam(name: String): String =
    stringParam(name) ?: error("$name is required")

  private fun JsonObject.stringParam(name: String): String? =
    this[name]?.takeUnless { it is JsonNull }?.jsonPrimitive?.contentOrNull

  private fun JsonObject.booleanParam(name: String): Boolean? =
    this[name]?.takeUnless { it is JsonNull }?.jsonPrimitive?.contentOrNull?.toBooleanStrictOrNull()

  private fun JsonObject.intParam(name: String): Int? =
    this[name]?.takeUnless { it is JsonNull }?.jsonPrimitive?.contentOrNull?.toIntOrNull()?.takeIf { it >= 0 }
      ?: this[name]?.takeUnless { it is JsonNull }?.let { error("$name must be a non-negative integer") }

  private fun JsonObject.longParam(name: String): Long? =
    this[name]?.takeUnless { it is JsonNull }?.jsonPrimitive?.contentOrNull?.toLongOrNull()?.takeIf { it >= 0 }
      ?: this[name]?.takeUnless { it is JsonNull }?.let { error("$name must be a non-negative integer") }

  private fun JsonObject.stringListParam(name: String): List<String> =
    this[name]
      ?.takeUnless { it is JsonNull }
      ?.jsonArray
      ?.map { it.jsonPrimitive.content }
      ?: emptyList()

  private fun JsonObject.objectParam(name: String): JsonObject? =
    this[name]?.takeUnless { it is JsonNull } as? JsonObject

  private fun JsonObject.networksParam(client: OMSWallet): List<Network> =
    stringListParam("networks").map { client.requireNetwork(it) }

  private fun JsonObject.indexerNetworkTypeParam(name: String): IndexerNetworkType? =
    stringParam(name)?.let { value ->
      IndexerNetworkType.entries.firstOrNull { it.wireValue == value }
        ?: error("Unsupported indexer network type: $value")
    }

  private fun JsonObject.contractVerificationStatusParam(name: String): ContractVerificationStatus? =
    stringParam(name)?.let { value ->
      ContractVerificationStatus.entries.firstOrNull { it.wireValue == value }
        ?: error("Unsupported contract verification status: $value")
    }

  private fun JsonObject.metadataOptionsParam(name: String): MetadataOptions? {
    val value = objectParam(name) ?: return null
    return MetadataOptions(
      verifiedOnly = value.booleanParam("verifiedOnly"),
      unverifiedOnly = value.booleanParam("unverifiedOnly"),
      includeContracts = value.stringListParam("includeContracts")
    )
  }

  private fun JsonObject.tokenBalancesPageRequestParam(): TokenBalancesPageRequest {
    val value = objectParam("page") ?: return TokenBalancesPageRequest()
    return TokenBalancesPageRequest(
      page = value.intParam("page") ?: 0,
      pageSize = value.intParam("pageSize") ?: 40
    )
  }

  private fun String.toBridgeOidcProvider(): BridgeOidcProvider {
    val value = json.parseToJsonElement(this).jsonObject
    return when (value["type"]?.jsonPrimitive?.content) {
      "oms-relay" -> when (value["provider"]?.jsonPrimitive?.content) {
        "google" -> BridgeOidcProvider.OmsRelay(OmsRelayOidcProviders.google)
        "apple" -> BridgeOidcProvider.OmsRelay(OmsRelayOidcProviders.apple)
        else -> error("Unsupported OMS relay OIDC provider")
      }
      "custom" -> BridgeOidcProvider.Custom(CustomOidcProviderConfig(
      issuer = value["issuer"]?.jsonPrimitive?.content ?: error("provider is missing issuer"),
      clientId = value["clientId"]?.jsonPrimitive?.content ?: error("provider is missing clientId"),
      authorizationUrl = value["authorizationUrl"]?.jsonPrimitive?.content
        ?: error("provider is missing authorizationUrl"),
      providerRedirectUri = value["providerRedirectUri"]?.jsonPrimitive?.content
        ?: error("provider is missing providerRedirectUri"),
      provider = value["provider"]?.jsonPrimitive?.contentOrNull,
      providerLabel = value["providerLabel"]?.jsonPrimitive?.contentOrNull,
      scopes = value["scopes"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
      authorizeParams = value["authorizeParams"]?.jsonObject?.mapValues { (_, item) ->
        item.jsonPrimitive.content
      } ?: emptyMap(),
      authMode = when (value["authMode"]?.jsonPrimitive?.content) {
        null, "auth-code-pkce" -> OidcRedirectAuthMode.AuthCodePKCE
        "auth-code" -> OidcRedirectAuthMode.AuthCode
        else -> error("Unsupported OIDC auth mode")
      }
    ))
      else -> error("Unsupported OIDC provider type")
    }
  }

  private fun String?.toAbiArgs(): List<AbiArg>? {
    val value = this ?: return null
    return json.parseToJsonElement(value).jsonArray.map { element ->
      val item = element.jsonObject
      AbiArg(
        type = item["type"]?.jsonPrimitive?.content ?: error("ABI arg is missing type"),
        value = item["value"] ?: error("ABI arg is missing value")
      )
    }
  }

  private fun WritableMap.putNullableString(key: String, value: String?) {
    if (value == null) {
      putNull(key)
    } else {
      putString(key, value)
    }
  }

  private fun jsonObjectMap(value: Map<String, JsonElement>): WritableMap =
    Arguments.createMap().apply {
      value.forEach { (key, element) -> putJsonElement(key, element) }
    }

  private fun jsonArray(value: Iterable<JsonElement>): WritableArray =
    Arguments.createArray().apply {
      value.forEach { element -> pushJsonElement(element) }
    }

  private fun WritableMap.putJsonElement(key: String, element: JsonElement) {
    when (element) {
      JsonNull -> putNull(key)
      is JsonObject -> putMap(key, jsonObjectMap(element))
      is JsonArray -> putArray(key, jsonArray(element))
      is JsonPrimitive -> putJsonPrimitive(key, element)
    }
  }

  private fun WritableArray.pushJsonElement(element: JsonElement) {
    when (element) {
      JsonNull -> pushNull()
      is JsonObject -> pushMap(jsonObjectMap(element))
      is JsonArray -> pushArray(jsonArray(element))
      is JsonPrimitive -> pushJsonPrimitive(element)
    }
  }

  private fun WritableMap.putJsonPrimitive(key: String, value: JsonPrimitive) {
    if (value.isString) {
      putString(key, value.content)
      return
    }
    value.content.toBooleanStrictOrNull()?.let {
      putBoolean(key, it)
      return
    }
    value.content.toDoubleOrNull()?.let {
      putDouble(key, it)
      return
    }
    putString(key, value.content)
  }

  private fun WritableArray.pushJsonPrimitive(value: JsonPrimitive) {
    if (value.isString) {
      pushString(value.content)
      return
    }
    value.content.toBooleanStrictOrNull()?.let {
      pushBoolean(it)
      return
    }
    value.content.toDoubleOrNull()?.let {
      pushDouble(it)
      return
    }
    pushString(value.content)
  }

  private fun reject(promise: Promise, throwable: Throwable) {
    val omsError = throwable as? OMSWalletException
    if (omsError == null) {
      promise.reject("oms_wallet_error", throwable.message, throwable)
      return
    }

    val code = omsError.code.id
    promise.reject(code, omsError.message, throwable, omsError.userInfoMap(code))
  }

  private fun OMSWalletException.userInfoMap(code: String): WritableMap =
    Arguments.createMap().apply {
      putString("code", code)
      putNullableString("operation", operation?.id)
      status?.let { putDouble("status", it.toDouble()) } ?: putNull("status")
      putNullableString("txnId", txnId)
      retryable?.let { putBoolean("retryable", it) } ?: putNull("retryable")
      upstreamError?.let { putMap("upstreamError", upstreamErrorMap(it)) } ?: putNull("upstreamError")
    }

  private fun upstreamErrorMap(error: OMSWalletUpstreamError): WritableMap =
    Arguments.createMap().apply {
      putString("service", error.service.name.lowercase())
      putNullableString("name", error.name)
      putNullableString("code", error.code)
      putNullableString("message", error.message)
      error.status?.let { putDouble("status", it.toDouble()) } ?: putNull("status")
    }

  companion object {
    const val NAME = NativeOmsWalletReactNativeSdkSpec.NAME
    private val json = Json { ignoreUnknownKeys = true }
  }
}
