package com.eyex.australianrates.apkidentity

import android.net.Uri
import android.os.Build
import com.android.apksig.ApkVerifier
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest

class ApkIdentityVerifierModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ArApkIdentityVerifier")

    AsyncFunction("verifyAsync") { uri: String ->
      val path = if (uri.startsWith("file:")) Uri.parse(uri).path else uri
      if (path.isNullOrBlank()) throw IllegalArgumentException("APK path is invalid")
      val apk = File(path)
      if (!apk.isFile) throw IllegalArgumentException("APK file is unavailable")

      // apksig validates the signed byte ranges, not merely self-asserted
      // manifest metadata. Android 7 is the app's minimum supported runtime.
      val result = ApkVerifier.Builder(apk)
        .setMinCheckedPlatformVersion(24)
        .build()
        .verify()
      val modernScheme = result.isVerifiedUsingV2Scheme ||
        result.isVerifiedUsingV3Scheme ||
        result.isVerifiedUsingV31Scheme ||
        result.isVerifiedUsingV4Scheme
      if (!result.isVerified || result.containsErrors() || !modernScheme) {
        throw SecurityException("APK cryptographic signature verification failed")
      }

      val certificates = result.signerCertificates
      if (certificates.size != 1) {
        throw SecurityException("APK must have exactly one current signer")
      }
      val signerSha256 = MessageDigest.getInstance("SHA-256")
        .digest(certificates.single().encoded)
        .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

      val packageInfo = context.packageManager.getPackageArchiveInfo(apk.absolutePath, 0)
        ?: throw SecurityException("APK package identity could not be parsed")
      @Suppress("DEPRECATION")
      val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo.longVersionCode
      } else {
        packageInfo.versionCode.toLong()
      }

      mapOf(
        "packageName" to packageInfo.packageName,
        "versionName" to (packageInfo.versionName ?: ""),
        "versionCode" to versionCode.toString(),
        "signerSha256" to signerSha256,
        "signerCount" to certificates.size,
        "signatureVerified" to true,
        "verifiedSchemes" to listOfNotNull(
          "v1".takeIf { result.isVerifiedUsingV1Scheme },
          "v2".takeIf { result.isVerifiedUsingV2Scheme },
          "v3".takeIf { result.isVerifiedUsingV3Scheme },
          "v3.1".takeIf { result.isVerifiedUsingV31Scheme },
          "v4".takeIf { result.isVerifiedUsingV4Scheme },
        ),
      )
    }
  }
}
