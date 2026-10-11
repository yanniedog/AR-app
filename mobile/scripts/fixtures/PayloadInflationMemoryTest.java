import com.eyex.australianrates.historycodec.HistoryCodec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.GZIPOutputStream;

/** Real-size Unicode details must fit Android's ordinary 192 MiB Java heap. */
public final class PayloadInflationMemoryTest {
  public static void main(String[] args) throws Exception {
    StringBuilder block = new StringBuilder();
    for (int i = 0; i < 4096; i++) block.append("x");
    block.append("😀日本語 Crédit");
    String text = block.toString();
    byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
    int copies = 11000;
    ByteArrayOutputStream compressed = new ByteArrayOutputStream();
    try (GZIPOutputStream gzip = new GZIPOutputStream(compressed)) {
      for (int i = 0; i < copies; i++) gzip.write(bytes);
    }
    List<String> chunks = HistoryCodec.inflatePayload(compressed.toByteArray(), bytes.length * copies, bytes.length * copies);
    long characters = 0;
    for (String chunk : chunks) {
      if (Character.isHighSurrogate(chunk.charAt(chunk.length() - 1)) || Character.isLowSurrogate(chunk.charAt(0)))
        throw new AssertionError("Surrogate split at native bridge boundary");
      for (int i = 0; i < chunk.length(); i++) {
        if (chunk.charAt(i) != text.charAt((int) ((characters + i) % text.length()))) throw new AssertionError("Decoded character mismatch");
      }
      characters += chunk.length();
    }
    if (characters != (long) text.length() * copies) throw new AssertionError("Decoded character count mismatch");
    System.out.println("payload memory assertions passed: " + characters + " characters; " + chunks.size() + " chunks");
  }
}
