package omsclientreactnativesdk.example

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class GoogleIdTokenAuthPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? =
    if (name == GoogleIdTokenAuthModule.NAME) {
      GoogleIdTokenAuthModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider() =
    ReactModuleInfoProvider {
      mapOf(
        GoogleIdTokenAuthModule.NAME to
          ReactModuleInfo(
            name = GoogleIdTokenAuthModule.NAME,
            className = GoogleIdTokenAuthModule.NAME,
            canOverrideExistingModule = false,
            needsEagerInit = false,
            isCxxModule = false,
            isTurboModule = true,
          )
      )
    }
}
