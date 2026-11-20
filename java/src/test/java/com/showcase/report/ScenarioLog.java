package com.showcase.report;

import com.google.gson.Gson;
import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EventPublisher;
import io.cucumber.plugin.event.PickleStepTestStep;
import io.cucumber.plugin.event.TestCaseFinished;
import io.cucumber.plugin.event.TestCaseStarted;
import io.cucumber.plugin.event.TestRunStarted;
import io.cucumber.plugin.event.TestStepFinished;
import io.cucumber.plugin.event.TestStepStarted;
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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cucumber plugin: one JSON line per scenario attempt (name, status, steps with their status,
 * known-defect notes), appended to a file next to the Surefire XML.
 *
 * <p>Why not the XML alone: in CI a failed scenario is rerun (pom.xml, profile ci-retries), and
 * with reruns on, Surefire leaves the output of passed tests out of the XML. That output carried
 * the steps and the known-defect lines (ADR 0010) that the pipeline summary and the nightly's Java
 * page show. Reruns start a new Cucumber run in the same JVM, so the file is truncated once per JVM
 * and appended to after that: a rerun adds its attempt, and readers take the last line per
 * scenario. Not written in a dry run.
 *
 * <p>It also tells KnownDefect which step is running and which steps follow it, and records the
 * step where a known defect fails on purpose as "failed" with "knownDefect" (Cucumber itself sees
 * an aborted step), so the reports show Pass, Fail and Skipped (not run) per step.
 */
public class ScenarioLog implements ConcurrentEventListener {
  private static final AtomicBoolean TRUNCATED = new AtomicBoolean();
  private static final ThreadLocal<List<String>> NOTES = ThreadLocal.withInitial(ArrayList::new);
  private static final Gson GSON = new Gson();
  // The current scenario's steps ("Keyword text"), the running step's index, and whether that step
  // failed on purpose because of a known defect.
  private static final ThreadLocal<List<String>> STEPS = ThreadLocal.withInitial(ArrayList::new);
  private static final ThreadLocal<Integer> CURRENT = ThreadLocal.withInitial(() -> -1);
  private static final ThreadLocal<Boolean> KNOWN_FAILURE = ThreadLocal.withInitial(() -> false);

  private final Path file;
  private final ThreadLocal<List<Map<String, String>>> steps =
      ThreadLocal.withInitial(ArrayList::new);

  public ScenarioLog(String path) {
    this.file = Path.of(path);
  }

  /**
   * A line for the current scenario's entry, e.g. a known defect that is still present
   * (KnownDefect).
   */
  public static void note(String line) {
    NOTES.get().add(line);
  }

  /** The running step, e.g. "Then the API should answer 403 for …"; "?" without this plugin. */
  public static String currentStep() {
    int i = CURRENT.get();
    return i >= 0 && i < STEPS.get().size() ? STEPS.get().get(i) : "?";
  }

  /** The steps after the running one: they do not run when it fails. */
  public static List<String> stepsAfterCurrent() {
    List<String> all = STEPS.get();
    return List.copyOf(all.subList(Math.min(CURRENT.get() + 1, all.size()), all.size()));
  }

  /** The running step fails on purpose because of a known defect (KnownDefect). */
  public static void markKnownDefectFailure() {
    KNOWN_FAILURE.set(true);
  }

  private static String text(PickleStepTestStep step) {
    return step.getStep().getKeyword() + step.getStep().getText();
  }

  @Override
  public void setEventPublisher(EventPublisher publisher) {
    if (Boolean.parseBoolean(System.getProperty("cucumber.execution.dry-run"))) return;
    publisher.registerHandlerFor(TestRunStarted.class, e -> truncateOnce());
    publisher.registerHandlerFor(
        TestCaseStarted.class,
        e -> {
          steps.get().clear();
          NOTES.get().clear();
          STEPS.set(
              e.getTestCase().getTestSteps().stream()
                  .filter(PickleStepTestStep.class::isInstance)
                  .map(s -> text((PickleStepTestStep) s))
                  .toList());
          CURRENT.set(-1);
          KNOWN_FAILURE.set(false);
        });
    publisher.registerHandlerFor(
        TestStepStarted.class,
        e -> {
          if (e.getTestStep() instanceof PickleStepTestStep) CURRENT.set(CURRENT.get() + 1);
        });
    publisher.registerHandlerFor(TestStepFinished.class, this::step);
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
    if (!(event.getTestStep() instanceof PickleStepTestStep step)) return; // hooks are not steps
    if (KNOWN_FAILURE.get()) {
      // Cucumber sees an aborted (skipped) step; it is the step that fails on purpose.
      steps.get().add(Map.of("text", text(step), "status", "failed", "knownDefect", "true"));
      KNOWN_FAILURE.set(false);
      return;
    }
    steps
        .get()
        .add(
            Map.of(
                "text", text(step), "status", event.getResult().getStatus().name().toLowerCase()));
  }

  private void finished(TestCaseFinished event) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("name", event.getTestCase().getName());
    entry.put(
        "uri", event.getTestCase().getUri().toString().replaceFirst("^.*?/features/", "features/"));
    entry.put("status", event.getResult().getStatus().name().toLowerCase());
    // Surefire records an aborted scenario (a known defect) with 0 s, so the log keeps the real
    // duration.
    entry.put("seconds", event.getResult().getDuration().toMillis() / 1000.0);
    Throwable error = event.getResult().getError();
    if (error != null)
      entry.put("error", String.valueOf(error.getMessage()).lines().findFirst().orElse(""));
    entry.put("steps", List.copyOf(steps.get()));
    if (steps.get().stream().anyMatch(s -> s.containsKey("knownDefect")))
      entry.put("knownDefect", true);
    entry.put("notes", List.copyOf(NOTES.get()));
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
}
