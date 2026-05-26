package com.omsclientreactnativesdk

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.omsclient.kotlin_sdk.Network
import com.omsclient.kotlin_sdk.OMSClient
import com.omsclient.kotlin_sdk.OMSClientSessionState
import com.omsclient.kotlin_sdk.models.SendTransactionRequest
import com.omsclient.kotlin_sdk.models.SendTransactionResponse
import com.omsclient.kotlin_sdk.models.TokenBalance
import com.omsclient.kotlin_sdk.models.TokenBalancesPage
import com.omsclient.kotlin_sdk.models.TokenBalancesResult
import com.omsclient.kotlin_sdk.network.OMSClientEnvironment
import com.omsclient.kotlin_sdk.wallet.CompleteAuthResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.math.BigInteger

class OmsClientReactNativeSdkModule(reactContext: ReactApplicationContext) :
  NativeOmsClientReactNativeSdkSpec(reactContext) {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private var client: OMSClient? = null

  override fun configure(
    projectAccessKey: String,
    projectId: String,
    walletApiUrl: String?,
    apiRpcUrl: String?,
    indexerUrlTemplate: String?,
    promise: Promise
  ) {
    try {
      client = OMSClient(
        context = reactApplicationContext,
        publicApiKey = projectAccessKey,
        projectId = projectId,
        environment = OMSClientEnvironment(
          walletApiUrl ?: OMSClientEnvironment.walletApiUrlDefault,
          apiRpcUrl ?: OMSClientEnvironment.apiRpcUrlDefault,
          indexerUrlTemplate ?: OMSClientEnvironment.indexerUrlTemplateDefault
        )
      )
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
    val supportedNetworks = client?.supportedNetworks ?: Network.entries
    supportedNetworks.forEach { network ->
      networks.pushMap(
        Arguments.createMap().apply {
          putString("chainId", network.id.toString())
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

  override fun completeEmailAuth(code: String, promise: Promise) {
    launch(promise) {
      val authResult = requireClient().wallet.completeEmailAuth(code)
      val wallet = when (authResult) {
        is CompleteAuthResult.WalletSelected -> authResult.wallet
        is CompleteAuthResult.WalletSelection -> error(
          "Manual wallet selection is not exposed by the React Native SDK"
        )
      }
      walletMap(wallet.id, wallet.address)
    }
  }

  override fun signOut(promise: Promise) {
    try {
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

  override fun sendTransaction(
    chainId: String,
    to: String,
    value: String,
    data: String?,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient()
      transactionResultMap(
        activeClient.wallet.sendTransaction(
          network = activeClient.requireNetwork(chainId),
          request = SendTransactionRequest(
            to = to,
            value = BigInteger(value),
            data = data
          )
        )
      )
    }
  }

  override fun getTokenBalances(
    chainId: String,
    contractAddress: String,
    walletAddress: String,
    includeMetadata: Boolean,
    promise: Promise
  ) {
    launch(promise) {
      val activeClient = requireClient()
      tokenBalancesResultMap(
        activeClient.indexer.getTokenBalances(
          network = activeClient.requireNetwork(chainId),
          contractAddress = contractAddress,
          walletAddress = walletAddress,
          includeMetadata = includeMetadata
        )
      )
    }
  }

  override fun verifyMessageSignature(
    chainId: String,
    walletAddress: String,
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

  override fun invalidate() {
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
    supportedNetworks.firstOrNull { it.id.toString() == chainId }
      ?: error("Unsupported chain id: $chainId")

  private fun walletMap(id: String, address: String): WritableMap =
    Arguments.createMap().apply {
      putString("id", id)
      putString("address", address)
    }

  private fun sessionMap(session: OMSClientSessionState?): WritableMap =
    Arguments.createMap().apply {
      putNullableString("walletAddress", session?.walletAddress)
      putNullableString("expiresAt", session?.expiresAt?.toString())
      putNullableString("loginType", session?.loginType?.name)
      putNullableString("sessionEmail", session?.sessionEmail)
    }

  private fun transactionResultMap(result: SendTransactionResponse): WritableMap =
    Arguments.createMap().apply {
      putString("txnId", result.txnId)
      putString("status", result.status.wireValue)
      putNullableString("txnHash", result.txnHash)
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
      putNullableString("blockHash", balance.blockHash)
      balance.blockNumber?.let { putDouble("blockNumber", it.toDouble()) }
      balance.chainId?.let { putDouble("chainId", it.toDouble()) }
    }

  private fun WritableMap.putNullableString(key: String, value: String?) {
    if (value == null) {
      putNull(key)
    } else {
      putString(key, value)
    }
  }

  private fun reject(promise: Promise, throwable: Throwable) {
    promise.reject("oms_client_error", throwable.message, throwable)
  }

  companion object {
    const val NAME = NativeOmsClientReactNativeSdkSpec.NAME
  }
}
