require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "OmsClientReactNativeSdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/0xsequence/react-native-sdk.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "6.0"
  s.dependency "OMS-SDK", "~> 0.0.1"
  s.pod_target_xcconfig = {
    "DEFINES_MODULE" => "YES"
  }

  install_modules_dependencies(s)
end
