package com.showcase.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Java twin of src/config/env.ts: same variable names, same defaults.
 * Reads real environment variables first, then the repo-root .env shared with the TypeScript suite.
 */
public final class Env {
  private static final Map<String, String> DOTENV = loadDotEnv();

  public static final String BASE_URL = get("BASE_URL", "https://practicesoftwaretesting.com");
  public static final String API_URL = get("API_URL", "https://api.practicesoftwaretesting.com");
  // Publicly documented Toolshop demo account.
  public static final String CUSTOMER_EMAIL = get("CUSTOMER_EMAIL", "customer@practicesoftwaretesting.com");
  public static final String CUSTOMER_PASSWORD = get("CUSTOMER_PASSWORD", "welcome01");

  private Env() {}

  private static String get(String key, String fallback) {
    String fromEnv = System.getenv(key);
    if (fromEnv != null && !fromEnv.isBlank()) return fromEnv;
    String fromFile = DOTENV.get(key);
    if (fromFile != null && !fromFile.isBlank()) return fromFile;
    return fallback;
  }

  /** Minimal KEY=VALUE parser; Maven runs from java/, so the shared file is one level up. */
  private static Map<String, String> loadDotEnv() {
    Map<String, String> values = new HashMap<>();
    for (Path candidate : List.of(Path.of("..", ".env"), Path.of(".env"))) {
      if (!Files.isRegularFile(candidate)) continue;
      try {
        for (String line : Files.readAllLines(candidate)) {
          String trimmed = line.trim();
          int eq = trimmed.indexOf('=');
          if (trimmed.isEmpty() || trimmed.startsWith("#") || eq < 1) continue;
          values.putIfAbsent(trimmed.substring(0, eq).trim(), trimmed.substring(eq + 1).trim());
        }
      } catch (IOException e) {
        throw new IllegalStateException("Cannot read " + candidate.toAbsolutePath(), e);
      }
    }
    return values;
  }
}
