import com.eyex.australianrates.historycodec.DetailsCacheReader;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;

public final class DetailsCacheReaderTest {
  private static int assertions;
  interface Checked { void run() throws Exception; }
  static void rejects(Checked test) throws Exception {
    try { test.run(); } catch (Exception expected) { assertions++; return; }
    throw new AssertionError("Expected bounded reader rejection");
  }
  static void equal(Object expected, Object actual) {
    if (!expected.equals(actual)) throw new AssertionError("Details chunk mismatch");
    assertions++;
  }
  public static void main(String[] args) throws Exception {
    File root = new File(args[0]), file = new File(root, "details.json");
    String uri = file.toURI().toString();
    for (String unicode : new String[] { "\u00e9", "\u4e2d", "\ud83d\udcc8" }) {
      byte[] codepoint = unicode.getBytes(StandardCharsets.UTF_8);
      for (int split = 1; split < codepoint.length; split++) {
        String text = "abcd".substring(0, 4 - split) + unicode + "z";
        Files.write(file.toPath(), text.getBytes(StandardCharsets.UTF_8));
        int offset = 0; StringBuilder reconstructed = new StringBuilder();
        while (offset < file.length()) {
          DetailsCacheReader.Chunk chunk = DetailsCacheReader.read(uri, offset, 4, root, root);
          reconstructed.append(chunk.text); offset += chunk.bytes;
        }
        equal(text, reconstructed.toString());
        equal(text.getBytes(StandardCharsets.UTF_8).length, offset);
      }
    }
    for (byte[] invalid : new byte[][] { {(byte) 0x80}, {(byte) 0xc0, (byte) 0xaf}, {(byte) 0xed, (byte) 0xa0, (byte) 0x80},
        {(byte) 0xf4, (byte) 0x90, (byte) 0x80, (byte) 0x80}, {(byte) 0xe0, (byte) 0x80, (byte) 0x80}, {(byte) 0xf0, (byte) 0x90}, {(byte) 0xc2, 65} }) {
      Files.write(file.toPath(), invalid);
      rejects(() -> DetailsCacheReader.read(uri, 0, 4, root, root));
    }
    Files.write(file.toPath(), "valid".getBytes(StandardCharsets.UTF_8));
    for (double position : new double[] {-1, 0.5, Double.NaN, Double.POSITIVE_INFINITY, 5, DetailsCacheReader.MAX_FILE + 1.0})
      rejects(() -> DetailsCacheReader.read(uri, position, 4, root, root));
    for (double length : new double[] {0, 3, 4.5, Double.NaN, Double.POSITIVE_INFINITY, DetailsCacheReader.MAX_CHUNK + 1.0})
      rejects(() -> DetailsCacheReader.read(uri, 0, length, root, root));
    rejects(() -> DetailsCacheReader.read(root.toURI().toString(), 0, 4, root, root));
    rejects(() -> DetailsCacheReader.read(new File(root, "../outside.json").toURI().toString(), 0, 4, root, root));
    rejects(() -> DetailsCacheReader.read("https://example.com/details", 0, 4, root, root));
    try (java.io.RandomAccessFile sparse = new java.io.RandomAccessFile(file, "rw")) { sparse.setLength(DetailsCacheReader.MAX_FILE + 1L); }
    rejects(() -> DetailsCacheReader.read(uri, 0, 4, root, root));

    // Production-size input, no complete byte/string allocation in either reader
    // or fixture. Run with a small Java heap and disabled compact strings.
    byte[] block = (new String(new char[8191]).replace('\0', 'a') + "\ud83d\udcc8\u00e9").getBytes(StandardCharsets.UTF_8);
    MessageDigest expected = MessageDigest.getInstance("SHA-256");
    try (FileOutputStream stream = new FileOutputStream(file)) {
      for (int i = 0; i < 4300; i++) { stream.write(block); expected.update(block); }
    }
    MessageDigest actual = MessageDigest.getInstance("SHA-256");
    long position = 0, started = System.nanoTime(); int chunks = 0;
    while (position < file.length()) {
      DetailsCacheReader.Chunk chunk = DetailsCacheReader.read(uri, position, DetailsCacheReader.MAX_CHUNK, root, root);
      if (chunk.bytes <= 0 || chunk.bytes > DetailsCacheReader.MAX_CHUNK || Character.isHighSurrogate(chunk.text.charAt(chunk.text.length() - 1))) throw new AssertionError("Unsafe native chunk");
      actual.update(chunk.text.getBytes(StandardCharsets.UTF_8)); position += chunk.bytes; chunks++;
    }
    if (!java.util.Arrays.equals(expected.digest(), actual.digest())) throw new AssertionError("Real-size byte mismatch");
    equal(file.length(), position);
    System.out.println("details-cache assertions passed: " + assertions + "; bytes=" + position + "; chunks=" + chunks + "; elapsed_ms=" + (System.nanoTime() - started) / 1_000_000.0);
  }
}
