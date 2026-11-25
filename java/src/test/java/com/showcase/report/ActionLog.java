package com.showcase.report;

import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PageAssertions;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * What a step really did: every browser action, API request and assertion the suite's own code
 * calls, with its target, duration, outcome and the line of code it was called from. ScenarioLog
 * writes them under the step they ran in, so a step opens in the Java report as it does in the
 * TypeScript one, where Playwright Test records the same ("Navigate", "Click", "GET", "Expect
 * ..."). ActionAgent calls {@link #enter} and {@link #exit} around those methods.
 *
 * <p>Only calls made directly by this suite (com.showcase) count: what Playwright or JUnit call
 * internally is their business. A call made while another one runs (a click inside waitForResponse,
 * an assertion inside assertAll) is nested under it.
 */
public final class ActionLog {
  private static final String SUITE = "com.showcase.";
  private static final String SOURCES = "java/src/test/java/";
  private static final int MAX_VALUE = 100;

  /** Errors are kept whole (Playwright's messages span several lines), up to this length. */
  private static final int MAX_ERROR = 4000;

  /** Reported actions, named as in Playwright Test's report; anything else is not an action. */
  private static final Map<String, String> PAGE_ACTIONS =
      Map.of(
          "navigate", "Navigate",
          "reload", "Reload",
          "goBack", "Go back",
          "screenshot", "Screenshot",
          "waitForResponse", "Wait for event \"response\"",
          "waitForRequest", "Wait for event \"request\"",
          "waitForDownload", "Wait for event \"download\"",
          "waitForURL", "Wait for URL");

  private static final Map<String, String> LOCATOR_ACTIONS =
      Map.ofEntries(
          Map.entry("click", "Click"),
          Map.entry("dblclick", "Double click"),
          Map.entry("fill", "Fill"),
          Map.entry("clear", "Clear"),
          Map.entry("press", "Press"),
          Map.entry("check", "Check"),
          Map.entry("uncheck", "Uncheck"),
          Map.entry("hover", "Hover"),
          Map.entry("selectOption", "Select option"),
          Map.entry("setInputFiles", "Set input files"),
          Map.entry("textContent", "Get text content"),
          Map.entry("allTextContents", "Get all text contents"),
          Map.entry("inputValue", "Get input value"),
          Map.entry("getAttribute", "Get attribute"),
          Map.entry("waitFor", "Wait for selector"));

  private static final Map<String, String> API_REQUESTS =
      Map.of(
          "get", "GET",
          "post", "POST",
          "put", "PUT",
          "patch", "PATCH",
          "delete", "DELETE",
          "head", "HEAD");

  /** The open calls of this thread; the last list holds the actions of the running step. */
  private static final ThreadLocal<Deque<List<Map<String, Object>>>> OPEN =
      ThreadLocal.withInitial(() -> {
        Deque<List<Map<String, Object>>> stack = new ArrayDeque<>();
        stack.push(new ArrayList<>());
        return stack;
      });

  private ActionLog() {}

  /** The actions since the last call, and a clean start for the next step. */
  static List<Map<String, Object>> drain() {
    Deque<List<Map<String, Object>>> stack = OPEN.get();
    List<Map<String, Object>> actions = stack.peekLast();
    stack.clear();
    stack.push(new ArrayList<>());
    return actions;
  }

  /** Before a recorded method runs; null if this call is not an action of the suite. */
  public static Map<String, Object> enter(Object target, String method, Object[] args) {
    String title = title(target, method, args);
    if (title == null) return null;
    Optional<StackWalker.StackFrame> caller = caller(method);
    if (caller.isEmpty()) return null;
    Map<String, Object> action = new LinkedHashMap<>();
    action.put("title", title);
    String subtitle = subtitle(target, method, args);
    if (subtitle != null) action.put("subtitle", subtitle);
    if (target instanceof Locator locator) action.put("selector", selector(locator));
    if (target instanceof LocatorAssertions && field(target, "actualLocator") instanceof Locator l)
      action.put("selector", selector(l));
    action.put("category", title.startsWith("Expect ") ? "expect" : "pw:api");
    action.put("file", sourceFile(caller.get().getClassName(), caller.get().getFileName()));
    action.put("line", caller.get().getLineNumber());
    action.put("start", System.currentTimeMillis());
    action.put("nanos", System.nanoTime());
    List<Map<String, Object>> children = new ArrayList<>();
    action.put("actions", children);
    Deque<List<Map<String, Object>>> stack = OPEN.get();
    stack.peek().add(action);
    stack.push(children);
    return action;
  }

  /** After a recorded method returned or threw. */
  public static void exit(Map<String, Object> action, Throwable error) {
    if (action == null) return;
    Deque<List<Map<String, Object>>> stack = OPEN.get();
    if (stack.size() > 1 && stack.peek() == action.get("actions")) stack.pop();
    action.put("duration", (System.nanoTime() - (Long) action.remove("nanos")) / 1_000_000);
    if (((List<?>) action.get("actions")).isEmpty()) action.remove("actions");
    if (error != null) action.put("error", message(error));
  }

  static String message(Throwable error) {
    String text = String.valueOf(error.getMessage()).strip();
    return text.length() > MAX_ERROR ? text.substring(0, MAX_ERROR) + "…" : text;
  }

  /** The suite's frames of an error, innermost first: where the report points to. */
  static List<Map<String, Object>> frames(Throwable error) {
    List<Map<String, Object>> frames = new ArrayList<>();
    for (StackTraceElement e : error.getStackTrace()) {
      if (!e.getClassName().startsWith(SUITE) || e.getLineNumber() < 1) continue;
      frames.add(
          Map.of(
              "function", e.getClassName().replaceFirst("^.*\\.", "") + "." + e.getMethodName(),
              "file", sourceFile(e.getClassName(), e.getFileName()),
              "line", e.getLineNumber()));
    }
    return frames;
  }

  /**
   * The line of the suite that made the call. Playwright's short forms (click()) call the full one
   * (click(options)), so frames of the same name are skipped; the next one decides. A method
   * reference handed to a wait (waitForResponse(..., button::click)) has no frame of its own:
   * Playwright runs it (runUntil), so there the line with the wait counts.
   */
  private static Optional<StackWalker.StackFrame> caller(String method) {
    List<StackWalker.StackFrame> frames =
        StackWalker.getInstance()
            .walk(all ->
                all.dropWhile(f -> f.getClassName().startsWith(SUITE + "report.ActionLog"))
                    .dropWhile(f -> !inSuite(f) && f.getMethodName().equals(method))
                    .limit(30)
                    .toList());
    if (frames.isEmpty()) return Optional.empty();
    StackWalker.StackFrame first = frames.get(0);
    if (inSuite(first)) return Optional.of(first);
    if (!first.getMethodName().equals("runUntil")) return Optional.empty();
    return frames.stream().filter(ActionLog::inSuite).findFirst();
  }

  private static boolean inSuite(StackWalker.StackFrame frame) {
    return frame.getClassName().startsWith(SUITE);
  }

  private static String title(Object target, String method, Object[] args) {
    if (target == null) return "Expect \"" + method + "\"";
    if (target instanceof LocatorAssertions || target instanceof PageAssertions) {
      if (method.equals("not")) return null;
      boolean not = Boolean.TRUE.equals(field(target, "isNot"));
      return "Expect \"" + (not ? "not " : "") + method + "\"";
    }
    if (target instanceof Locator) {
      String title = LOCATOR_ACTIONS.get(method);
      boolean value = method.equals("fill") || method.equals("press");
      return value && args[0] != null ? title + " \"" + shorten(args[0]) + "\"" : title;
    }
    if (target instanceof APIRequestContext) return API_REQUESTS.get(method);
    if (target instanceof Page) return PAGE_ACTIONS.get(method);
    if (target instanceof APIRequest && method.equals("newContext"))
      return "Create request context";
    if (target instanceof BrowserType && method.equals("launch")) return "Launch browser";
    if (target instanceof Browser && method.equals("newContext")) return "Create context";
    if (target instanceof BrowserContext && method.equals("newPage")) return "Create page";
    if (target instanceof BrowserContext && method.equals("close")) return "Close context";
    return null;
  }

  private static String subtitle(Object target, String method, Object[] args) {
    if (target == null) return assertion(method, args);
    if (target instanceof Page && method.equals("navigate")) return String.valueOf(args[0]);
    if (target instanceof APIRequestContext && args[0] instanceof String path) {
      Object query = args.length > 1 && args[1] != null ? field(args[1], "params") : null;
      return query instanceof Map<?, ?> map && !map.isEmpty() ? path + "?" + query(map) : path;
    }
    return null;
  }

  private static String query(Map<?, ?> params) {
    List<String> pairs = new ArrayList<>();
    params.forEach((k, v) -> pairs.add(k + "=" + v));
    return String.join("&", pairs);
  }

  /** The values a JUnit assertion compares, which its name alone does not say. */
  private static String assertion(String method, Object[] args) {
    return switch (method) {
      case "assertEquals" ->
          "expected " + shorten(args[0]) + ", received " + shorten(args[1]) + message(args, 2);
      case "assertTrue", "assertFalse", "assertNull", "assertNotNull" ->
          "received " + shorten(args[0]) + message(args, 1);
      default -> null;
    };
  }

  private static String message(Object[] args, int from) {
    return args.length > from && args[args.length - 1] instanceof String text
        ? " (" + shorten(text) + ")"
        : "";
  }

  private static String shorten(Object value) {
    String text =
        value != null && value.getClass().isArray()
            ? "[" + Array.getLength(value) + " items]"
            : String.valueOf(value);
    text = text.replaceAll("\\s+", " ").strip();
    return text.length() > MAX_VALUE ? text.substring(0, MAX_VALUE) + "…" : text;
  }

  /** Playwright's own selector; scripts/java-report.mjs writes it as getByTestId("..."). */
  private static String selector(Locator locator) {
    Object selector = field(locator, "selector");
    return selector == null ? String.valueOf(locator) : selector.toString();
  }

  /** A private field of a Playwright object, or null: detail for the report, never a failure. */
  private static Object field(Object target, String name) {
    for (Class<?> c = target.getClass(); c != null; c = c.getSuperclass()) {
      try {
        Field field = c.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
      } catch (NoSuchFieldException e) {
        // look in the superclass
      } catch (IllegalAccessException | RuntimeException e) {
        return null;
      }
    }
    return null;
  }

  private static String sourceFile(String className, String fileName) {
    String folder = className.substring(0, className.lastIndexOf('.')).replace('.', '/');
    return SOURCES + folder + "/" + fileName;
  }
}
