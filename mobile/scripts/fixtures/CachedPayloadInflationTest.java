import com.eyex.australianrates.historycodec.HistoryCodec;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Random;

public final class CachedPayloadInflationTest {
  private static int assertions;
  interface Checked { void run() throws Exception; }
  static void rejects(Checked test) throws Exception {
    try { test.run(); } catch (Exception expected) { assertions++; return; }
    throw new AssertionError("Expected cached payload rejection");
  }
  static void equal(Object expected, Object actual) {
    if (!expected.equals(actual)) throw new AssertionError("Cached payload mismatch");
    assertions++;
  }
  static String encoded(byte[] raw) { return Base64.getEncoder().encodeToString(raw); }
  static List<String> inflate(byte[] raw, int limit) throws Exception {
    return HistoryCodec.inflateCachedPayload(encoded(raw), raw.length, HistoryCodecTest.sha(raw), limit);
  }
  public static void main(String[] args) throws Exception {
    // Similar compressed/base64 size to the real retained archive; UTF-16 heap
    // and a split-boundary surrogate exercise Android's conservative heap mode.
    Random random = new Random(23);
    String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    StringBuilder builder = new StringBuilder(4_200_100);
    for (int i = 0; i < 4_200_000; i++) builder.append(alphabet.charAt(random.nextInt(64)));
    builder.insert(65535, "\ud83d\udcc8 Cr\u00e9dit \u0000");
    String text = builder.toString(); builder = null;
    byte[] utf8 = text.getBytes(StandardCharsets.UTF_8), raw = HistoryCodecTest.gzip(utf8);
    String cache = encoded(raw), hash = HistoryCodecTest.sha(raw);
    List<String> chunks = HistoryCodec.inflateCachedPayload(cache, raw.length, hash, utf8.length);
    equal(text, String.join("", chunks));
    for (String chunk : chunks) {
      if (chunk.length() > 65537 || Character.isHighSurrogate(chunk.charAt(chunk.length() - 1))) throw new AssertionError("Unsafe bridge chunk");
    }
    assertions++;
    rejects(() -> HistoryCodec.inflateCachedPayload(cache, raw.length, HistoryCodecTest.repeat("0", 64), utf8.length));
    rejects(() -> HistoryCodec.inflateCachedPayload(cache, raw.length + 1, hash, utf8.length));
    rejects(() -> HistoryCodec.inflateCachedPayload(cache, raw.length, hash.toUpperCase(), utf8.length));
    rejects(() -> HistoryCodec.inflateCachedPayload(cache.substring(0, cache.length() - 4), raw.length, hash, utf8.length));
    rejects(() -> HistoryCodec.inflateCachedPayload("!" + cache.substring(1), raw.length, hash, utf8.length));
    for (double size : new double[] { 0, 17, 1.5, Double.NaN, Double.POSITIVE_INFINITY, HistoryCodec.MAX_COMPRESSED + 1.0 })
      rejects(() -> HistoryCodec.inflateCachedPayload(cache, size, hash, utf8.length));
    for (double limit : new double[] { 0, -1, 1.5, Double.NaN, Double.POSITIVE_INFINITY, 192 * 1024 * 1024 + 1.0, utf8.length - 1 })
      rejects(() -> HistoryCodec.inflateCachedPayload(cache, raw.length, hash, limit));
    byte[] badCrc = raw.clone(); badCrc[badCrc.length - 8] ^= 1;
    rejects(() -> inflate(badCrc, utf8.length));
    byte[] forged = raw.clone(); Arrays.fill(forged, forged.length - 4, forged.length, (byte) 0); forged[forged.length - 4] = 8;
    rejects(() -> inflate(forged, utf8.length));
    rejects(() -> inflate(Arrays.copyOf(raw, raw.length - 4), utf8.length));
    rejects(() -> inflate(HistoryCodecTest.gzip(new byte[] {(byte) 0xc0, (byte) 0xaf}), 100));
    byte[] wrongMagic = raw.clone(); wrongMagic[0] = 0;
    rejects(() -> inflate(wrongMagic, utf8.length));
    System.out.println("cached payload assertions passed: " + assertions + "; characters=" + text.length() + "; compressed=" + raw.length);
  }
}
