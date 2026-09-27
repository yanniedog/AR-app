package com.eyex.australianrates.historycodec

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HistoryCodecModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArHistoryCodec")

    // Expo AsyncFunction's default modules queue is a background HandlerThread,
    // separate from both Hermes and Android's UI thread. No main-queue override.
    AsyncFunction("compressAsync") { json: String ->
      val value = HistoryCodec.compress(json)
      mapOf("sha256" to value.sha256, "bytes" to value.bytes, "gzip_base64" to value.gzipBase64)
    }
    AsyncFunction("decompressAsync") { gzipBase64: String, bytes: Double, sha256: String ->
      HistoryCodec.decompress(gzipBase64, bytes, sha256)
    }
  }
}
