package com.omsclientreactnativesdk

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.omsclient.kotlin_sdk.Network
import com.omsclient.kotlin_sdk.OMSClient
import com.omsclient.kotlin_sdk.OMSClientSessionState
import com.omsclient.kotlin_sdk.OmsSdkErrorCode
import com.omsclient.kotlin_sdk.OmsSdkException
import com.omsclient.kotlin_sdk.models.AbiArg
import com.omsclient.kotlin_sdk.models.CredentialInfo
import com.omsclient.kotlin_sdk.models.FeeOption
import com.omsclient.kotlin_sdk.models.FeeOptionSelection
import com.omsclient.kotlin_sdk.models.FeeOptionSelector
import com.omsclient.kotlin_sdk.models.FeeOptionWithBalance
import com.omsclient.kotlin_sdk.models.FeeToken
import com.omsclient.kotlin_sdk.models.ListAccessResponse
import com.omsclient.kotlin_sdk.models.Page
import com.omsclient.kotlin_sdk.models.SendTransactionRequest
import com.omsclient.kotlin_sdk.models.TokenBalance
import com.omsclient.kotlin_sdk.models.TokenBalancesPage
import com.omsclient.kotlin_sdk.models.TokenBalancesPageRequest
import com.omsclient.kotlin_sdk.models.TokenBalancesResult
import com.omsclient.kotlin_sdk.models.TokenContractInfo
import com.omsclient.kotlin_sdk.models.TokenMetadata
import com.omsclient.kotlin_sdk.models.TokenMetadataAsset
import com.omsclient.kotlin_sdk.models.TransactionMode
import com.omsclient.kotlin_sdk.models.TransactionStatusPollingOptions
import com.omsclient.kotlin_sdk.models.TransactionStatusResponse
import com.omsclient.kotlin_sdk.models.Wallet
import com.omsclient.kotlin_sdk.models.WalletType
import com.omsclient.kotlin_sdk.network.OMSClientEnvironment
import com.omsclient.kotlin_sdk.wallet.CompleteAuthResult
import com.omsclient.kotlin_sdk.wallet.OidcProviderConfig
import com.omsclient.kotlin_sdk.wallet.OidcRedirectAuthResult
import com.omsclient.kotlin_sdk.wallet.PendingWalletSelection
import com.omsclient.kotlin_sdk.wallet.WalletSelectionBehavior
import com.omsclient.kotlin_sdk.wallet.WalletSelectionResult
import com.omsclient.kotlin_sdk.wallet.WalletClient
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

class OmsClientReactNativeSdkModule(reactContext: ReactApplicationContext) :
  NativeOmsClientReactNativeSdkSpec(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private val pendingFeeOptionSelections = ConcurrentHashMap<String, CompletableDeferred<FeeOptionSelection?>>()
  private val pendingWalletSelections = ConcurrentHashMap<String, PendingWalletSelection>()
  private var sessionExpiredUnsubscribe: (() -> Unit)? = null
  private var client: OMSClient? = null

  override fun configure(
    publishableKey: String,
    walletApiUrl: String?,
    apiRpcUrl: String?,
    indexerUrlTemplate: String?,
    projectId: String,
    promise: Promise
  ) {
    try {
      pendingWalletSelections.clear()
      sessionExpiredUnsubscribe?.invoke()
      client = OMSClient(
        context = reactApplicationContext,
        publishableKey = publishableKey,
        projectId = projectId,
        environment = OMSClientEnvironment(
          walletApiUrl ?: OMSClientEnvironment.walletApiUrlDefault,
          apiRpcUrl ?: OMSClientEnvironment.apiRpcUrlDefault,
          indexerUrlTemplate ?: OMSClientEnvironment.indexerUrlTemplateDefault
        )
      )
      sessionExpiredUnsubscribe = client?.wallet?.onSessionExpired { event ->
        emitOnSessionExpired(
          Arguments.createMap().apply {
            putMap("session", sessionMap(event.session))
            putString("expiredAt", event.expiredAt.toString())
          }
        )
      }
      promise.resolve(null)
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun getWalletAddress(promise: Promise) {
    promise.resolve(client?.session?.walletAddress)
  }

  override fun getSession(promise: Promise) {
    promise.resolve(sessionMap(client?.session))
  }

  override fun getSupportedNetworks(promise: Promise) {
    val networks = Arguments.createArray()
    Network.entries.forEach { network ->
      networks.pushMap(
        Arguments.createMap().apply {
          putString("chainId", network.id.toString())
          putString("name", network.name)
          putString("nativeTokenSymbol", network.nativeTokenSymbol)
          putString("explorerUrl", network.explorerUrl)
          putString("displayName", network.displayName)
        }
      )
    }
    promise.resolve(networks)
  }

  override fun startEmailAuth(email: String, promise: Promise) {
    launch(promise) {
      requireClient().wallet.startEmailAuth(email)
      null
    }
  }

  override fun completeEmailAuth(
    code: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    promise: Promise
  ) {
    launch(promise) {
      completeAuthResultMap(
        requireClient().wallet.completeEmailAuth(
          code = code,
          walletSelection = walletSelection.toWalletSelectionBehavior(),
          walletType = walletType.toWalletType(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toSessionLifetimeSeconds()
        )
      )
    }
  }

  override fun signInWithOidcIdToken(
    idToken: String,
    issuer: String,
    audience: String,
    walletSelection: String?,
    walletType: String?,
    sessionLifetimeSeconds: String?,
    promise: Promise
  ) {
    launch(promise) {
      completeAuthResultMap(
        requireClient().wallet.signInWithOidcIdToken(
          idToken = idToken,
          issuer = issuer,
          audience = audience,
          walletSelection = walletSelection.toWalletSelectionBehavior(),
          walletType = walletType.toWalletType(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toSessionLifetimeSeconds()
        )
      )
    }
  }

  override fun startOidcRedirectAuth(
    providerJson: String,
    redirectUri: String,
    walletType: String?,
    relayRedirectUri: String?,
    authorizeParamsJson: String?,
    loginHint: String?,
    promise: Promise
  ) {
    launch(promise) {
      val result = requireClient().wallet.startOidcRedirectAuth(
        provider = providerJson.toOidcProviderConfig(),
        redirectUri = redirectUri,
        walletType = walletType.toWalletType(),
        relayRedirectUri = relayRedirectUri,
        authorizeParams = authorizeParamsJson.toStringMap("authorizeParams") ?: emptyMap(),
        loginHint = loginHint
      )
      Arguments.createMap().apply {
        putString("authorizationUrl", result.authorizationUrl)
        putString("state", result.state)
        putString("challenge", result.challenge)
      }
    }
  }

  override fun handleOidcRedirectCallback(
    callbackUrl: String?,
    walletSelection: String?,
    sessionLifetimeSeconds: String?,
    promise: Promise
  ) {
    launch(promise) {
      when (
        val result = requireClient().wallet.handleOidcRedirectCallback(
          callbackUrl = callbackUrl,
          walletSelection = walletSelection.toWalletSelectionBehavior(),
          sessionLifetimeSeconds = sessionLifetimeSeconds.toSessionLifetimeSeconds()
        )
      ) {
        is OidcRedirectAuthResult.Completed ->
          Arguments.createMap().apply {
            pendingWalletSelections.clear()
            putString("type", "completed")
            putMap("wallet", walletMap(result.wallet))
          }

        is OidcRedirectAuthResult.NotOidcRedirectCallback ->
          Arguments.createMap().apply { putString("type", "notOidcRedirectCallback") }

        is OidcRedirectAuthResult.NoPendingAuth ->
          Arguments.createMap().apply { putString("type", "noPendingAuth") }

        is OidcRedirectAuthResult.Failed ->
          Arguments.createMap().apply {
            putString("type", "failed")
            putString("message", result.error.message)
          }

        is OidcRedirectAuthResult.WalletSelection ->
          Arguments.createMap().apply {
            pendingWalletSelections.clear()
            putString("type", "walletSelection")
            putMap("pendingSelection", pendingWalletSelectionMap(result.pendingSelection))
          }
      }
    }
  }

  override fun listWallets(promise: Promise) {
    launch(promise) {
      Arguments.createArray().apply {
        requireClient().wallet.listWallets().forEach { pushMap(walletMap(it)) }
      }
    }
  }

  override fun useWallet(walletId: String, promise: Promise) {
    launch(promise) {
      walletActivationResultMap(requireClient().wallet.useWallet(walletId))
    }
  }

  override fun createWallet(walletType: String?, reference: String?, promise: Promise) {
    launch(promise) {
      walletActivationResultMap(
        requireClient().wallet.createWallet(
          walletType = walletType.toWalletType(),
          reference = reference
        )
      )
    }
  }

  override fun selectWalletForPendingSelection(
    pendingSelectionId: String,
    walletId: String,
    promise: Promise
  ) {
    launch(promise) {
      val pendingSelection =
        pendingWalletSelections[pendingSelectionId]
          ?: error("Pending wallet selection is no longer available")
      val result = pendingSelection.selectWallet(walletId)
      pendingWalletSelections.remove(pendingSelectionId)
      walletActivationResultMap(result)
    }
  }

  override fun createAndSelectWalletForPendingSelection(
    pendingSelectionId: String,
    reference: String?,
    promise: Promise
  ) {
    launch(promise) {
      val pendingSelection =
        pendingWalletSelections[pendingSelectionId]
          ?: error("Pending wallet selection is no longer available")
      val result = pendingSelection.createAndSelectWallet(reference)
      pendingWalletSelections.remove(pendingSelectionId)
      walletActivationResultMap(result)
    }
  }

  override fun signOut(promise: Promise) {
    try {
      pendingWalletSelections.clear()
      requireClient().wallet.signOut()
      promise.resolve(null)
    } catch (throwable: Throwable) {
      reject(promise, throwable)
    }
  }

  override fun signMessage(chainId: String, message: String, promise: Promise) {
    launch(promise) {
      val activeClient = requireClient()
      activeClient.wallet.signMessage(
        network = activeClient.requireNetwork(chainId),
        message = message
      )
    }
  }

  override fun signTypedData(chainId: String, typedDataJson: String, promise: Promise) {
    launch(promise) {
      val activeClient = requireClient()
      activeClient.wallet.signTypedData(
        network = activeClient.requireNetwork(chainId),
        typedData = json.parseToJsonElement(typedDataJson)
      )
    }
  }

  override fun sendTransaction(
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
      val activeClient = requireClient()
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
      val activeClient = requireClient()
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

  override fun getTransactionStatus(txnId: String, promise: Promise) {
    launch(promise) {
      transactionStatusMap(requireClient().wallet.getTransactionStatus(txnId))
    }
  }

  override fun getTokenBalances(
    chainId: String,
    contractAddress: String?,
    walletAddress: String,
    includeMetadata: Boolean,
    page: String?,
    pageSize: String?,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient()
      tokenBalancesResultMap(
        activeClient.indexer.getTokenBalances(
          network = activeClient.requireNetwork(chainId),
          contractAddress = contractAddress,
          walletAddress = walletAddress,
          includeMetadata = includeMetadata,
          page = TokenBalancesPageRequest(
            page = page.toIntOrNullParam("page") ?: 0,
            pageSize = pageSize.toIntOrNullParam("pageSize") ?: 40
          )
        )
      )
    }
  }

  override fun getNativeTokenBalance(chainId: String, walletAddress: String, promise: Promise) {
    launch(promise) {
      val activeClient = requireClient()
      activeClient.indexer.getNativeTokenBalance(
        network = activeClient.requireNetwork(chainId),
        walletAddress = walletAddress
      )?.let(::tokenBalanceMap)
    }
  }

  override fun verifyMessageSignature(
    chainId: String,
    message: String,
    signature: String,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient()
      activeClient.wallet.isValidMessageSignature(
        network = activeClient.requireNetwork(chainId),
        message = message,
        signature = signature
      )
    }
  }

  override fun verifyTypedDataSignature(
    chainId: String,
    typedDataJson: String,
    signature: String,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient()
      activeClient.wallet.isValidTypedDataSignature(
        network = activeClient.requireNetwork(chainId),
        typedData = json.parseToJsonElement(typedDataJson),
        signature = signature
      )
    }
  }

  override fun getIdToken(ttlSeconds: String?, customClaimsJson: String?, promise: Promise) {
    launch(promise) {
      requireClient().wallet.getIdToken(
        ttlSeconds = ttlSeconds.toUIntOrNullParam("ttlSeconds"),
        customClaims = customClaimsJson.toJsonObjectMap("customClaims")
      )
    }
  }

  override fun listAccess(pageSize: String?, promise: Promise) {
    launch(promise) {
      Arguments.createArray().apply {
        requireClient().wallet.listAccess(
          pageSize = pageSize.toUIntOrNullParam("pageSize")
        ).forEach { pushMap(credentialInfoMap(it)) }
      }
    }
  }

  override fun listAccessPage(pageSize: String?, cursor: String?, promise: Promise) {
    launch(promise) {
      listAccessResponseMap(
        requireClient().wallet.listAccessPage(
          pageSize = pageSize.toUIntOrNullParam("pageSize"),
          cursor = cursor
        )
      )
    }
  }

  override fun revokeAccess(targetCredentialId: String, promise: Promise) {
    launch(promise) {
      requireClient().wallet.revokeAccess(targetCredentialId)
      null
    }
  }

  override fun invalidate() {
    sessionExpiredUnsubscribe?.invoke()
    sessionExpiredUnsubscribe = null
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

  private fun requireClient(): OMSClient =
    client ?: error("Call configure before using the OMS client")

  private fun OMSClient.requireNetwork(chainId: String): Network =
    supportedNetworks.firstOrNull { it.id.toString() == chainId } ?: error("Unsupported chain id: $chainId")

  private fun completeAuthResultMap(result: CompleteAuthResult): WritableMap =
    when (result) {
      is CompleteAuthResult.WalletSelected -> {
        pendingWalletSelections.clear()
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
          pendingWalletSelections.clear()
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
          putMap("pendingSelection", pendingWalletSelectionMap(result.pendingSelection))
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

  private fun pendingWalletSelectionMap(pendingSelection: PendingWalletSelection): WritableMap {
    val id = UUID.randomUUID().toString()
    pendingWalletSelections[id] = pendingSelection
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

  private fun walletActivationResultMap(result: WalletSelectionResult): WritableMap =
    Arguments.createMap().apply {
      putString("walletAddress", result.walletAddress)
      putMap("wallet", walletMap(result.wallet))
    }

  private fun sessionMap(session: OMSClientSessionState?): WritableMap =
    Arguments.createMap().apply {
      putNullableString("walletAddress", session?.walletAddress)
      putNullableString("expiresAt", session?.expiresAt?.toString())
      putNullableString("loginType", session?.loginType?.name)
      putNullableString("sessionEmail", session?.sessionEmail)
    }

  private fun tokenBalancesResultMap(result: TokenBalancesResult): WritableMap =
    Arguments.createMap().apply {
      putInt("status", result.status)
      result.page?.let { putMap("page", tokenBalancesPageMap(it)) }
      putArray(
        "balances",
        Arguments.createArray().apply {
          result.balances.forEach { pushMap(tokenBalanceMap(it)) }
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

  private fun transactionStatusMap(result: TransactionStatusResponse): WritableMap =
    Arguments.createMap().apply {
      putString("status", result.status.wireValue)
      putNullableString("txnHash", result.txnHash)
    }

  private fun sendTransactionResponseMap(
    result: com.omsclient.kotlin_sdk.models.SendTransactionResponse
  ): WritableMap =
    Arguments.createMap().apply {
      putString("txnId", result.txnId)
      putString("status", result.status.wireValue)
      putNullableString("txnHash", result.txnHash)
    }

  private fun feeOptionWithBalanceMap(option: FeeOptionWithBalance): WritableMap =
    Arguments.createMap().apply {
      putMap("feeOption", feeOptionMap(option.feeOption))
      putMap("selection", feeOptionSelectionMap(option.feeOption))
      option.balance?.let { putMap("balance", tokenBalanceMap(it)) } ?: putNull("balance")
      putNullableString("available", option.available)
      putNullableString("availableRaw", option.availableRaw)
      option.decimals?.let { putDouble("decimals", it.toDouble()) } ?: putNull("decimals")
    }

  private fun feeOptionSelectionMap(option: FeeOption): WritableMap =
    Arguments.createMap().apply {
      val tokenId = option.token.tokenId?.trim()?.takeIf { it.isNotEmpty() }
      putString("token", tokenId ?: option.token.symbol)
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
      putString("logoUrl", token.logoUrl)
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

  private fun String?.toUIntOrNullParam(name: String): UInt? =
    this?.toUIntOrNull() ?: this?.let { error("$name must be an unsigned integer") }

  private fun String?.toIntOrNullParam(name: String): Int? =
    this?.toIntOrNull()?.takeIf { it >= 0 } ?: this?.let { error("$name must be a non-negative integer") }

  private fun String?.toLongOrNullParam(name: String): Long? =
    this?.toLongOrNull()?.takeIf { it >= 0 } ?: this?.let { error("$name must be a non-negative integer") }

  private fun String?.toSessionLifetimeSeconds(): Long =
    this?.toLongOrNullParam("sessionLifetimeSeconds") ?: WalletClient.DEFAULT_SESSION_LIFETIME_SECONDS

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

  private fun String.toOidcProviderConfig(): OidcProviderConfig {
    val value = json.parseToJsonElement(this).jsonObject
    return OidcProviderConfig(
      issuer = value["issuer"]?.jsonPrimitive?.content ?: error("provider is missing issuer"),
      clientId = value["clientId"]?.jsonPrimitive?.content ?: error("provider is missing clientId"),
      authorizationUrl = value["authorizationUrl"]?.jsonPrimitive?.content
        ?: error("provider is missing authorizationUrl"),
      scopes = value["scopes"]?.jsonArray?.map { it.jsonPrimitive.content }
        ?: listOf("openid", "email", "profile"),
      relayRedirectUri = value["relayRedirectUri"]?.jsonPrimitive?.contentOrNull,
      authorizeParams = value["authorizeParams"]?.jsonObject?.mapValues { (_, item) ->
        item.jsonPrimitive.content
      } ?: emptyMap()
    )
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
    val omsError = throwable as? OmsSdkException
    if (omsError == null) {
      promise.reject("oms_client_error", throwable.message, throwable)
      return
    }

    val code = omsError.code.bridgeCode()
    promise.reject(code, omsError.message, throwable, omsError.userInfoMap(code))
  }

  private fun OmsSdkException.userInfoMap(code: String): WritableMap =
    Arguments.createMap().apply {
      putString("code", code)
      putNullableString("operation", operation?.id)
      status?.let { putDouble("status", it.toDouble()) } ?: putNull("status")
      putNullableString("txnId", txnId)
      putBoolean("retryable", retryable)
    }

  private fun OmsSdkErrorCode.bridgeCode(): String {
    val words = name.replace(Regex("([a-z])([A-Z])"), "$1_$2")
    return "OMS_${words.uppercase()}"
  }

  companion object {
    const val NAME = NativeOmsClientReactNativeSdkSpec.NAME
    private val json = Json { ignoreUnknownKeys = true }
  }
}
