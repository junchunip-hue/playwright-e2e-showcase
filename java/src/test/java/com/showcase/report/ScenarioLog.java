package com.showcase.report;

import com.google.gson.Gson;
import io.cucumber.plugin.ConcurrentEventListener;
import io.cucumber.plugin.event.EventPublisher;
import io.cucumber.plugin.event.PickleStepTestStep;
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
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Cucumber plugin: one JSON line per scenario attempt (name, status, steps with their status, known-defect notes),
 * appended to a file next to the Surefire XML.
 *
 * <p>Why not the XML alone: in CI a failed scenario is rerun (pom.xml, profile ci-retries), and with reruns on,
 * Surefire leaves the output of passed tests out of the XML. That output carried the steps and the known-defect
 * lines (ADR 0010) that the pipeline summary and the nightly's Java page show. Reruns start a new Cucumber run in the
 * same JVM, so the file is truncated once per JVM and appended to after that: a rerun adds its attempt, and readers
 * take the last line per scenario. Not written in a dry run.
 */
public class ScenarioLog implements ConcurrentEventListener {
  private static final AtomicBoolean TRUNCATED = new AtomicBoolean();
  private static final ThreadLocal<List<String>> NOTES = ThreadLocal.withInitial(ArrayList::new);
  private static final Gson GSON = new Gson();

  private final Path file;
  private final ThreadLocal<List<Map<String, String>>> steps = ThreadLocal.withInitial(ArrayList::new);

  public ScenarioLog(String path) {
    this.file = Path.of(path);
  }

  /** A line for the current scenario's entry, e.g. a known defect that is still present (KnownDefect). */
  public static void note(String line) {
    NOTES.get().add(line);
  }

  @Override
  public void setEventPublisher(EventPublisher publisher) {
    if (Boolean.parseBoolean(System.getProperty("cucumber.execution.dry-run"))) return;
    publisher.registerHandlerFor(TestRunStarted.class, e -> truncateOnce());
    publisher.registerHandlerFor(TestCaseStarted.class, e -> {
      steps.get().clear();
      NOTES.get().clear();
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
    steps.get().add(Map.of(
        "text", step.getStep().getKeyword() + step.getStep().getText(),
        "status", event.getResult().getStatus().name().toLowerCase()));
  }

  private void finished(TestCaseFinished event) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("name", event.getTestCase().getName());
    entry.put("uri", event.getTestCase().getUri().toString().replaceFirst("^.*?/features/", "features/"));
    entry.put("status", event.getResult().getStatus().name().toLowerCase());
    Throwable error = event.getResult().getError();
    if (error != null) entry.put("error", String.valueOf(error.getMessage()).lines().findFirst().orElse(""));
    entry.put("steps", List.copyOf(steps.get()));
    entry.put("notes", List.copyOf(NOTES.get()));
    String line = GSON.toJson(entry) + System.lineSeparator();
    synchronized (ScenarioLog.class) {
      try {
        Files.writeString(file, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
      } catch (IOException e) {
        throw new UncheckedIOException(e);
      }
    }
  }
}
