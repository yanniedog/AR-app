package com.eyex.australianrates.historycodec;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/** Bounded file/UTF-8 work for the module's background queue. No whole-file buffer. */
public final class DetailsCacheReader {
  public static final int MAX_CHUNK = 256 * 1024;
  public static final int MAX_FILE = 192 * 1024 * 1024;
  public static final class Chunk {
    public final String text;
    public final int bytes;
    Chunk(String text, int bytes) { this.text = text; this.bytes = bytes; }
  }

  public static Chunk read(String uri, double position, double length, File filesRoot, File cacheRoot) throws Exception {
    if (!Double.isFinite(position) || position != Math.floor(position) || position < 0 || position > MAX_FILE ||
        !Double.isFinite(length) || length != Math.floor(length) || length < 4 || length > MAX_CHUNK)
      throw new IllegalArgumentException("Invalid details chunk bounds");
    File file = new File(new URI(uri)).getCanonicalFile();
    if (!inside(file, filesRoot) && !inside(file, cacheRoot)) throw new IllegalArgumentException("Invalid details cache path");
    if (!file.isFile()) throw new IOException("Missing details cache file");
    try (RandomAccessFile input = new RandomAccessFile(file, "r")) {
      long size = input.length();
      if (size > MAX_FILE || position >= size) throw new IllegalArgumentException("Invalid details cache size or offset");
      int count = (int) Math.min(length, size - (long) position);
      byte[] bytes = new byte[count];
      input.seek((long) position);
      input.readFully(bytes);
      // Leave an incomplete final code point for the next bounded read. Strict
      // decoding below rejects malformed continuations and incomplete EOF.
      int end = count;
      if ((long) position + count < size) {
        int lead = count - 1;
        while (lead >= 0 && (bytes[lead] & 0xc0) == 0x80) lead--;
        if (lead >= 0) {
          int first = bytes[lead] & 255;
          int width = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 1;
          if (count - lead < width) end = lead;
        }
      }
      if (end == 0) throw new IOException("Invalid details UTF-8 boundary");
      String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes, 0, end)).toString();
      return new Chunk(text, end);
    }
  }

  private static boolean inside(File file, File root) throws IOException {
    return file.getPath().startsWith(root.getCanonicalPath() + File.separator);
  }
}
