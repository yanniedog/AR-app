package com.eyex.australianrates.historycodec;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/** No Android dependency: the same bounded codec is exercised by host-JVM tests. */
public final class HistoryCodec {
  public static final int MAX_COMPRESSED = 16 * 1024 * 1024;
  public static final int MAX_DECODED = 128 * 1024 * 1024;
  private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  public static final class Encoded {
    public final String sha256, gzipBase64;
    public final int bytes;
    Encoded(String sha256, int bytes, String gzipBase64) {
      this.sha256 = sha256; this.bytes = bytes; this.gzipBase64 = gzipBase64;
    }
  }

  private static MessageDigest digest() {
    try { return MessageDigest.getInstance("SHA-256"); }
    catch (NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
  }

  private static String hex(byte[] bytes) {
    char[] output = new char[bytes.length * 2];
    String digits = "0123456789abcdef";
    for (int i = 0; i < bytes.length; i++) {
      output[i * 2] = digits.charAt((bytes[i] & 255) >>> 4);
      output[i * 2 + 1] = digits.charAt(bytes[i] & 15);
    }
    return new String(output);
  }

  private static final class BoundedOutput extends ByteArrayOutputStream {
    BoundedOutput() { super(65536); }
    private void bound(int length) {
      if (length < 0 || count > MAX_COMPRESSED - length) throw new IllegalArgumentException("Catalogue exceeds compressed budget");
    }
    @Override public synchronized void write(byte[] value, int offset, int length) {
      bound(length); super.write(value, offset, length);
    }
    @Override public synchronized void write(int value) { bound(1); super.write(value); }
  }

  public static Encoded compress(String json) throws IOException {
    if (json == null || json.isEmpty() || json.length() > MAX_DECODED) throw new IllegalArgumentException("Catalogue exceeds decoded budget");
    final MessageDigest hash = digest();
    final BoundedOutput compressed = new BoundedOutput();
    final GZIPOutputStream gzip = new GZIPOutputStream(compressed, 65536);
    final int[] length = { 0 };
    OutputStream decoded = new OutputStream() {
      @Override public void write(int value) throws IOException { write(new byte[] { (byte) value }, 0, 1); }
      @Override public void write(byte[] value, int offset, int count) throws IOException {
        if (count < 0 || length[0] > MAX_DECODED - count) throw new IllegalArgumentException("Catalogue exceeds decoded budget");
        hash.update(value, offset, count); gzip.write(value, offset, count); length[0] += count;
      }
      @Override public void close() throws IOException { gzip.close(); }
    };
    // Streaming UTF-8 conversion rejects malformed UTF-16 and enforces byte
    // limits before hashing/compression, without allocating an unbounded byte copy.
    try (OutputStreamWriter writer = new OutputStreamWriter(decoded, StandardCharsets.UTF_8.newEncoder()
        .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT))) {
      for (int offset = 0; offset < json.length(); offset += 8192) writer.write(json, offset, Math.min(8192, json.length() - offset));
    } finally { gzip.close(); }
    return new Encoded(hex(hash.digest()), length[0], encode(compressed.toByteArray()));
  }

  public static String decompress(String text, double declaredBytes, String sha256) throws IOException {
    if (!Double.isFinite(declaredBytes) || declaredBytes != Math.floor(declaredBytes) || declaredBytes < 1 || declaredBytes > MAX_DECODED ||
        sha256 == null || !sha256.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Invalid catalogue receipt");
    int length = (int) declaredBytes;
    byte[] compressed = decode(text);
    if (compressed.length < 18) throw new IllegalArgumentException("Invalid gzip length");
    int end = compressed.length;
    long footer = ((long) compressed[end - 4] & 255) | (((long) compressed[end - 3] & 255) << 8) |
      (((long) compressed[end - 2] & 255) << 16) | (((long) compressed[end - 1] & 255) << 24);
    if (footer != length) throw new IllegalArgumentException("Gzip length does not match receipt");
    byte[] output = new byte[length];
    MessageDigest hash = digest();
    int written = 0;
    try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(compressed), 65536)) {
      while (written < length) {
        int count = gzip.read(output, written, Math.min(65536, length - written));
        if (count < 0) break;
        hash.update(output, written, count); written += count;
      }
      if (written != length || gzip.read() != -1) throw new IllegalArgumentException("Catalogue inflation exceeds declared length");
    }
    if (!hex(hash.digest()).equals(sha256)) throw new IllegalArgumentException("Catalogue digest mismatch");
    // No JSON or text is exposed until gzip, exact byte length and SHA all pass.
    return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(output)).toString();
  }

  private static int digit(char value) { return ALPHABET.indexOf(value); }

  private static byte[] decode(String text) {
    if (text == null || text.isEmpty() || text.length() % 4 != 0 || text.length() > ((MAX_COMPRESSED + 2) / 3) * 4)
      throw new IllegalArgumentException("Invalid base64 length");
    int padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
    int length = text.length() / 4 * 3 - padding;
    if (length > MAX_COMPRESSED) throw new IllegalArgumentException("Catalogue exceeds compressed budget");
    byte[] output = new byte[length]; int written = 0;
    for (int i = 0; i < text.length(); i += 4) {
      boolean last = i + 4 == text.length();
      int a = digit(text.charAt(i)), b = digit(text.charAt(i + 1));
      int c = last && padding == 2 ? 0 : digit(text.charAt(i + 2));
      int d = last && padding > 0 ? 0 : digit(text.charAt(i + 3));
      if (a < 0 || b < 0 || c < 0 || d < 0 || (last && ((padding == 2 && (b & 15) != 0) || (padding == 1 && (c & 3) != 0))))
        throw new IllegalArgumentException("Non-canonical base64");
      output[written++] = (byte) (a << 2 | b >>> 4);
      if (written < length) output[written++] = (byte) ((b & 15) << 4 | c >>> 2);
      if (written < length) output[written++] = (byte) ((c & 3) << 6 | d);
    }
    return output;
  }

  private static String encode(byte[] bytes) {
    char[] output = new char[((bytes.length + 2) / 3) * 4]; int at = 0;
    for (int i = 0; i < bytes.length; i += 3) {
      int a = bytes[i] & 255, b = i + 1 < bytes.length ? bytes[i + 1] & 255 : 0, c = i + 2 < bytes.length ? bytes[i + 2] & 255 : 0;
      output[at++] = ALPHABET.charAt(a >>> 2); output[at++] = ALPHABET.charAt((a & 3) << 4 | b >>> 4);
      output[at++] = i + 1 < bytes.length ? ALPHABET.charAt((b & 15) << 2 | c >>> 6) : '=';
      output[at++] = i + 2 < bytes.length ? ALPHABET.charAt(c & 63) : '=';
    }
    return new String(output);
  }
}
