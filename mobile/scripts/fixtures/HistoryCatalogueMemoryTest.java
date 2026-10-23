import com.eyex.australianrates.historycodec.HistoryCodec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.zip.GZIPOutputStream;

/** Run with a 192MiB heap and UTF-16 strings, without a full decoded test copy. */
public final class HistoryCatalogueMemoryTest {
  static String hex(byte[] bytes) {
    StringBuilder result = new StringBuilder();
    for (byte value : bytes) result.append(String.format("%02x", value & 255));
    return result.toString();
  }
  interface Checked { void run() throws Exception; }
  static void rejects(Checked task) throws Exception {
    try { task.run(); } catch (Exception expected) { return; }
    throw new AssertionError("Expected rejection before exposing chunks");
  }
  public static void main(String[] args) throws Exception {
    int length = 50_000_000;
    byte[] block = new byte[8192]; Arrays.fill(block, (byte) 'x');
    MessageDigest expected = MessageDigest.getInstance("SHA-256");
    ByteArrayOutputStream compressed = new ByteArrayOutputStream();
    try (GZIPOutputStream gzip = new GZIPOutputStream(compressed)) {
      for (int written = 0; written < length;) {
        int amount = Math.min(block.length, length - written);
        gzip.write(block, 0, amount); expected.update(block, 0, amount); written += amount;
      }
    }
    String digest = hex(expected.digest());
    List<String> chunks = HistoryCodec.decompressChunks(Base64.getEncoder().encodeToString(compressed.toByteArray()), length, digest);
    MessageDigest actual = MessageDigest.getInstance("SHA-256");
    int count = 0;
    for (String chunk : chunks) {
      if (chunk.isEmpty() || chunk.length() > 65537 || Character.isHighSurrogate(chunk.charAt(chunk.length() - 1)))
        throw new AssertionError("Invalid bridge chunk");
      actual.update(chunk.getBytes(StandardCharsets.UTF_8)); count += chunk.length();
    }
    if (count != length || !hex(actual.digest()).equals(digest)) throw new AssertionError("Archive receipt mismatch");
    chunks = null;

    String boundary = String.join("", java.util.Collections.nCopies(65535, "x")) + "\ud83e\uddea" + "tail";
    HistoryCodec.Encoded encoded = HistoryCodec.compress(boundary);
    List<String> unicode = HistoryCodec.decompressChunks(encoded.gzipBase64, encoded.bytes, encoded.sha256);
    if (!boundary.equals(String.join("", unicode)) || Character.isHighSurrogate(unicode.get(0).charAt(unicode.get(0).length() - 1)))
      throw new AssertionError("Unicode bridge boundary changed");
    rejects(() -> HistoryCodec.decompressChunks(encoded.gzipBase64, encoded.bytes, new String(new char[64]).replace('\0', '0')));
    rejects(() -> HistoryCodec.decompressChunks(encoded.gzipBase64, encoded.bytes - 1, encoded.sha256));
    rejects(() -> HistoryCodec.decompressChunks(encoded.gzipBase64, HistoryCodec.MAX_DECODED + 1.0, encoded.sha256));
    rejects(() -> HistoryCodec.decompressChunks("AB==", encoded.bytes, encoded.sha256));
    byte[] wire = Base64.getDecoder().decode(encoded.gzipBase64);
    wire[wire.length - 8] ^= 1;
    rejects(() -> HistoryCodec.decompressChunks(Base64.getEncoder().encodeToString(wire), encoded.bytes, encoded.sha256));
    rejects(() -> HistoryCodec.decompressChunks(encoded.gzipBase64.substring(4), encoded.bytes, encoded.sha256));
    byte[] invalid = { (byte) 0xc0, (byte) 0xaf };
    ByteArrayOutputStream badUtf8 = new ByteArrayOutputStream();
    try (GZIPOutputStream gzip = new GZIPOutputStream(badUtf8)) { gzip.write(invalid); }
    rejects(() -> HistoryCodec.decompressChunks(Base64.getEncoder().encodeToString(badUtf8.toByteArray()), invalid.length,
      hex(MessageDigest.getInstance("SHA-256").digest(invalid))));
    System.out.println("history catalogue memory assertions passed: " + count + " characters; Unicode and 7 rejection cases");
  }
}
