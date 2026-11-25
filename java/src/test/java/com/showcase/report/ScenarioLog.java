package com.showcase.report;

import com.google.gson.Gson;
import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EmbedEvent;
import io.cucumber.plugin.event.EventPublisher;
import io.cucumber.plugin.event.HookTestStep;
import io.cucumber.plugin.event.HookType;
import io.cucumber.plugin.event.PickleStepTestStep;
import io.cucumber.plugin.event.Status;
import io.cucumber.plugin.event.TestCase;
import io.cucumber.plugin.event.TestCaseFinished;
import io.cucumber.plugin.event.TestCaseStarted;
import io.cucumber.plugin.event.TestRunStarted;
import io.cucumber.plugin.event.TestStepFinished;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cucumber plugin: one JSON line per scenario attempt, appended to a file next to the Surefire XML.
 * It holds what the Java report needs to look like the TypeScript one (scripts/java-report.mjs
 * turns it into a Playwright HTML report): the scenario's feature, line, tags, start and duration,
 * and every step in order, the hooks included, each with its status, duration, line and, if it
 * failed, its error. A step is "passed", "failed" or "skipped": Cucumber does not run the steps
 * after a failed one, and they are listed as skipped. Each step carries the actions it ran ({@link
 * ActionLog}): what the report shows when a step is opened. A screenshot taken at a failure (Hooks,
 * {@code @AfterStep}) is written next to the log, under attachments/, and listed with the step that
 * failed.
 *
 * <p>Why not the XML alone: in CI a failed scenario is rerun (pom.xml, profile ci-retries), and
 * with reruns on, Surefire leaves the output of passed tests out of the XML, steps included. Reruns
 * start a new Cucumber run in the same JVM, so the file is truncated once per JVM and appended to
 * after that: a rerun adds its attempt, so every attempt is in the file, in order. Not written in a
 * dry run.
 */
public class ScenarioLog implements ConcurrentEventListener {
  private static final AtomicBoolean TRUNCATED = new AtomicBoolean();
  private static final Gson GSON = new Gson();

  private final Path file;
  private final ThreadLocal<List<Map<String, Object>>> steps =
      ThreadLocal.withInitial(ArrayList::new);
  private final ThreadLocal<Long> started = ThreadLocal.withInitial(() -> 0L);

  /**
   * The file from the plugin argument, unless -Dscenario.log points elsewhere: the nightly's run of
   * the failure control writes its own log next to its own reports.
   */
  public ScenarioLog(String path) {
    String override = System.getProperty("scenario.log");
    this.file = Path.of(override == null || override.isBlank() ? path : override);
  }

  @Override
  public void setEventPublisher(EventPublisher publisher) {
    if (Boolean.parseBoolean(System.getProperty("cucumber.execution.dry-run"))) return;
    ActionAgent.install();
    publisher.registerHandlerFor(TestRunStarted.class, e -> truncateOnce());
    publisher.registerHandlerFor(
        TestCaseStarted.class,
        e -> {
          steps.get().clear();
          ActionLog.drain();
          started.set(e.getInstant().toEpochMilli());
        });
    publisher.registerHandlerFor(TestStepFinished.class, this::step);
    publisher.registerHandlerFor(EmbedEvent.class, this::attach);
    publisher.registerHandlerFor(TestCaseFinished.class, this::finished);
  }

  private void truncateOnce() {
    if (!TRUNCATED.compareAndSet(false, true)) return;
    try {
      Files.createDirectories(file.toAbsolutePath().getParent());
      Files.writeString(file, "", StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private void step(TestStepFinished event) {
    Map<String, Object> entry = new LinkedHashMap<>();
    List<Map<String, Object>> actions = ActionLog.drain();
    if (event.getTestStep() instanceof PickleStepTestStep step) {
      entry.put("text", step.getStep().getKeyword() + step.getStep().getText());
      entry.put("line", step.getStep().getLine());
    } else if (event.getTestStep() instanceof HookTestStep hook) {
      // Step hooks (@AfterStep: the failure screenshot) run around every step: left out unless one
      // fails, whose attachment goes to the step it follows anyway (attach()).
      boolean stepHook =
          hook.getHookType() == HookType.BEFORE_STEP || hook.getHookType() == HookType.AFTER_STEP;
      if (stepHook && event.getResult().getStatus() != Status.FAILED) {
        // What it did (the screenshot) shows under the step it ran after, as in TypeScript.
        Map<String, Object> owner = lastGherkinStep();
        if (owner != null) addActions(owner, actions);
        return;
      }
      // Hooks show as "Before Hooks" / "After Hooks" in the report, like Playwright's own.
      entry.put("hook", hook.getHookType() == HookType.BEFORE ? "before" : "after");
      String method = hook.getCodeLocation().replaceFirst("\\(.*$", "");
      entry.put("text", "Hook \"" + method.replaceFirst("^.*\\.", "") + "\"");
    } else {
      return;
    }
    long duration = event.getResult().getDuration().toMillis();
    entry.put("status", event.getResult().getStatus().name().toLowerCase());
    entry.put("start", event.getInstant().toEpochMilli() - duration);
    entry.put("duration", duration);
    Throwable error = event.getResult().getError();
    if (event.getResult().getStatus() == Status.FAILED && error != null) putError(entry, error);
    addActions(entry, actions);
    steps.get().add(entry);
  }

  /**
   * An attachment (the failure screenshot) belongs to the last Gherkin step that finished: the
   * {@code @AfterStep} hook that takes it runs right after the step that failed.
   */
  @SuppressWarnings("unchecked")
  private void attach(EmbedEvent event) {
    Map<String, Object> owner = lastGherkinStep();
    if (owner == null) return;
    String extension = event.getMediaType().endsWith("png") ? ".png" : ".bin";
    String name = "attachments/" + UUID.randomUUID() + extension;
    try {
      Path target = file.toAbsolutePath().getParent().resolve(name);
      Files.createDirectories(target.getParent());
      Files.write(target, event.getData());
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    List<Map<String, String>> list =
        (List<Map<String, String>>) owner.computeIfAbsent("attachments", k -> new ArrayList<>());
    list.add(Map.of("name", event.getName(), "path", name, "contentType", event.getMediaType()));
  }

  private void finished(TestCaseFinished event) {
    TestCase testCase = event.getTestCase();
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("name", testCase.getName());
    entry.put("uri", testCase.getUri().toString().replaceFirst("^.*?/features/", "features/"));
    entry.put("line", testCase.getLocation().getLine());
    entry.put("tags", testCase.getTags());
    entry.put("status", event.getResult().getStatus().name().toLowerCase());
    entry.put("start", started.get());
    entry.put("duration", event.getInstant().toEpochMilli() - started.get());
    Throwable error = event.getResult().getError();
    if (error != null) putError(entry, error);
    entry.put("steps", List.copyOf(steps.get()));
    String line = GSON.toJson(entry) + System.lineSeparator();
    synchronized (ScenarioLog.class) {
      try {
        Files.writeString(
            file,
            line,
            StandardCharsets.UTF_8,
            StandardOpenOption.CREATE,
            StandardOpenOption.APPEND);
      } catch (IOException e) {
        throw new UncheckedIOException(e);
      }
    }
  }

  private Map<String, Object> lastGherkinStep() {
    Map<String, Object> last = null;
    for (Map<String, Object> s : steps.get()) if (!s.containsKey("hook")) last = s;
    return last;
  }

  @SuppressWarnings("unchecked")
  private static void addActions(Map<String, Object> entry, List<Map<String, Object>> actions) {
    if (actions.isEmpty()) return;
    ((List<Map<String, Object>>) entry.computeIfAbsent("actions", k -> new ArrayList<>()))
        .addAll(actions);
  }

  /** The message, and the lines of the suite it came from, innermost first. */
  private static void putError(Map<String, Object> entry, Throwable error) {
    entry.put("error", ActionLog.message(error));
    entry.put("frames", ActionLog.frames(error));
  }
}
