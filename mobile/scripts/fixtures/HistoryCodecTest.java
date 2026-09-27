import com.eyex.australianrates.historycodec.HistoryCodec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.Random;
import java.util.zip.GZIPOutputStream;

public final class HistoryCodecTest {
  private static int assertions = 0;
  interface Checked { void run() throws Exception; }
  static void equal(Object expected, Object actual) {
    if (!expected.equals(actual)) throw new AssertionError("Mismatch: " + expected + " != " + actual);
    assertions++;
  }
  static void rejects(Checked task) throws Exception {
    try { task.run(); } catch (Exception expected) { assertions++; return; }
    throw new AssertionError("Expected validation failure");
  }
  static String sha(byte[] bytes) throws Exception {
    StringBuilder value = new StringBuilder();
    for (byte item : MessageDigest.getInstance("SHA-256").digest(bytes)) value.append(String.format("%02x", item & 255));
    return value.toString();
  }
  static byte[] gzip(byte[] bytes) throws Exception {
    ByteArrayOutputStream result = new ByteArrayOutputStream();
    try (GZIPOutputStream stream = new GZIPOutputStream(result)) { stream.write(bytes); }
    return result.toByteArray();
  }
  static String repeat(String value, int count) {
    StringBuilder result = new StringBuilder(value.length() * count);
    for (int i = 0; i < count; i++) result.append(value);
    return result.toString();
  }
  public static void main(String[] args) throws Exception {
    String json = "{\"description\":\"" + repeat("x", 8175) + "😀日本語 Crédit\\n\\ud800" + repeat(" long metadata ", 10000) + "\",\"rates\":[0,5.25,-1]}";
    HistoryCodec.Encoded encoded = HistoryCodec.compress(json);
    byte[] expected = json.getBytes(StandardCharsets.UTF_8);
    equal(expected.length, encoded.bytes); equal(sha(expected), encoded.sha256);
    equal(json, HistoryCodec.decompress(encoded.gzipBase64, encoded.bytes, encoded.sha256));
    equal(json, HistoryCodec.decompress(Base64.getEncoder().encodeToString(gzip(expected)), expected.length, sha(expected)));
    for (double length : new double[] { 0, -1, 1.5, Double.NaN, Double.POSITIVE_INFINITY, HistoryCodec.MAX_DECODED + 1.0, encoded.bytes + 1 })
      rejects(() -> HistoryCodec.decompress(encoded.gzipBase64, length, encoded.sha256));
    rejects(() -> HistoryCodec.decompress(encoded.gzipBase64, encoded.bytes, repeat("0", 64)));
    rejects(() -> HistoryCodec.decompress(encoded.gzipBase64, encoded.bytes, encoded.sha256.toUpperCase()));
    for (String invalid : new String[] { "", "====", "AA==AAAA", "A!==", "AB==", "AAF=", encoded.gzipBase64 + "\n", encoded.gzipBase64.substring(4) })
      rejects(() -> HistoryCodec.decompress(invalid, encoded.bytes, encoded.sha256));
    rejects(() -> HistoryCodec.decompress(repeat("A", ((HistoryCodec.MAX_COMPRESSED + 2) / 3) * 4 + 4), 1, encoded.sha256));
    byte[] compressed = Base64.getDecoder().decode(encoded.gzipBase64);
    byte[] badCrc = compressed.clone(); badCrc[badCrc.length - 8] ^= 1;
    rejects(() -> HistoryCodec.decompress(Base64.getEncoder().encodeToString(badCrc), encoded.bytes, encoded.sha256));
    rejects(() -> HistoryCodec.decompress(Base64.getEncoder().encodeToString(Arrays.copyOf(compressed, compressed.length - 4)), encoded.bytes, encoded.sha256));
    byte[] forgedSmall = compressed.clone();
    Arrays.fill(forgedSmall, forgedSmall.length - 4, forgedSmall.length, (byte) 0); forgedSmall[forgedSmall.length - 4] = 8;
    rejects(() -> HistoryCodec.decompress(Base64.getEncoder().encodeToString(forgedSmall), 8, encoded.sha256));
    byte[] invalidUtf8 = new byte[] { 34, (byte) 0xc0, (byte) 0xaf, 34 };
    rejects(() -> HistoryCodec.decompress(Base64.getEncoder().encodeToString(gzip(invalidUtf8)), invalidUtf8.length, sha(invalidUtf8)));
    rejects(() -> HistoryCodec.compress("\"\ud800\""));
    // Character count fits, but streaming UTF-8 exceeds the decoded byte cap.
    rejects(() -> HistoryCodec.compress(repeat("\u0800", HistoryCodec.MAX_DECODED / 3 + 1)));
    // Real incompressible output must fail while writing, not after allocation.
    char[] random = new char[24 * 1024 * 1024]; Random generator = new Random(731);
    for (int i = 0; i < random.length; i++) random[i] = (char) (32 + generator.nextInt(95));
    rejects(() -> HistoryCodec.compress(new String(random)));
    System.out.println("history-codec assertions passed: " + assertions);
  }
}
