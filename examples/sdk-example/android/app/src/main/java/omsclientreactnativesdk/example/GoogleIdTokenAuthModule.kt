package omsclientreactnativesdk.example

import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class GoogleIdTokenAuthModule(
  reactContext: ReactApplicationContext,
) : NativeGoogleIdTokenAuthSpec(reactContext) {
  private val credentialManager = CredentialManager.create(reactContext)
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

  override fun requestGoogleIdToken(
    serverClientId: String,
    iosClientId: String?,
    promise: Promise,
  ) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject(ERROR_CODE, "Google sign-in requires an active Android activity")
      return
    }

    scope.launch {
      try {
        val request =
          GetCredentialRequest.Builder()
            .addCredentialOption(
              GetSignInWithGoogleOption.Builder(serverClientId)
                .build()
            )
            .build()
        val credential =
          credentialManager.getCredential(
            context = activity,
            request = request,
          ).credential

        require(credential is CustomCredential) {
          "Unexpected credential type: ${credential::class.java.simpleName}"
        }
        require(credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
          "Unexpected Google credential type: ${credential.type}"
        }

        val idToken = try {
          GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (error: GoogleIdTokenParsingException) {
          throw IllegalStateException("Failed to parse Google ID token", error)
        }
        promise.resolve(idToken)
      } catch (error: CancellationException) {
        throw error
      } catch (error: GetCredentialCancellationException) {
        promise.reject(CANCELLATION_ERROR_CODE, "Google sign-in was cancelled", error)
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, error.message, error)
      }
    }
  }

  override fun clearCredentialState(promise: Promise) {
    scope.launch {
      try {
        credentialManager.clearCredentialState(ClearCredentialStateRequest())
        promise.resolve(null)
      } catch (error: CancellationException) {
        throw error
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, error.message, error)
      }
    }
  }

  override fun invalidate() {
    scope.cancel()
    super.invalidate()
  }

  companion object {
    const val NAME = NativeGoogleIdTokenAuthSpec.NAME
    private const val CANCELLATION_ERROR_CODE = "GOOGLE_ID_TOKEN_AUTH_CANCELLED"
    private const val ERROR_CODE = "GOOGLE_ID_TOKEN_AUTH_ERROR"
  }
}
