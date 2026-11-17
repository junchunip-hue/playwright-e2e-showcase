package com.showcase.annotations;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.File;
import java.lang.reflect.Method;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestTemplate;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.platform.commons.support.AnnotationSupport;

/**
 * Java twin of `npm run check:tags`. Tags decide which tests gate a PR, so they are only set through the
 * composed annotations in this package; this guard fails on raw {@code @Test}/{@code @Tag}, unknown tags,
 * or a test without exactly one tier. No browser is started, so it is cheap enough for the PR smoke run.
 */
@DisplayName("Tag guard")
class TagGuardTest {
  private static final String TESTS_PACKAGE = "com.showcase.tests";
  private static final Set<String> TIERS = Set.of(Tags.SMOKE, Tags.REGRESSION);
  private static final Set<String> KNOWN = Set.of(Tags.SMOKE, Tags.REGRESSION, Tags.NEGATIVE, Tags.E2E);
  private static final Pattern TEST_ID = Pattern.compile("([ASUN]\\d+): ");
  private static final Pattern PLAN_ROW = Pattern.compile("(?m)^\\|\\s*\\**([ASUN]\\d+)\\**\\s*\\|");

  /** IDs in the first column of the test-plan tables; Maven runs from java/, so the docs are one level up. */
  private static Set<String> testPlanIds() throws Exception {
    String plan = Files.readString(Path.of("..", "docs", "test-plan.md"));
    Set<String> ids = new HashSet<>();
    Matcher m = PLAN_ROW.matcher(plan);
    while (m.find()) ids.add(m.group(1));
    return ids;
  }

  @SmokeTest
  @DisplayName("every test uses the composed annotations and has exactly one tier")
  void everyTestHasExactlyOneTier() throws Exception {
    List<String> problems = new ArrayList<>();
    Set<String> planIds = testPlanIds();
    List<Class<?>> classes = testClasses();
    assertTrue(!classes.isEmpty(), "no test classes found in " + TESTS_PACKAGE);

    for (Class<?> testClass : classes) {
      for (Method method : testClass.getDeclaredMethods()) {
        // @ParameterizedTest is a @TestTemplate, so data-driven tests are checked too.
        if (!AnnotationSupport.isAnnotated(method, Test.class) && !AnnotationSupport.isAnnotated(method, TestTemplate.class)) continue;
        String where = testClass.getSimpleName() + "." + method.getName();

        if (method.isAnnotationPresent(Test.class) || method.isAnnotationPresent(ParameterizedTest.class)) {
          problems.add(where + ": raw @Test/@ParameterizedTest, use @SmokeTest, @RegressionTest or @RegressionCases");
        }
        // org.junit.jupiter.api.Tags is JUnit's container for repeated @Tag (not this package's Tags).
        if (method.isAnnotationPresent(Tag.class) || method.isAnnotationPresent(org.junit.jupiter.api.Tags.class)) {
          problems.add(where + ": raw @Tag, use the annotations in com.showcase.annotations");
        }

        List<String> tags = AnnotationSupport.findRepeatableAnnotations(method, Tag.class).stream().map(Tag::value).toList();
        tags.stream().filter(t -> !KNOWN.contains(t)).forEach(t -> problems.add(where + ": unknown tag " + t));
        long tiers = tags.stream().filter(TIERS::contains).count();
        if (tiers != 1) problems.add(where + ": needs exactly one tier of " + TIERS + " (found " + tiers + ")");

        // Same rule as the TypeScript tag check: the display name starts with an ID from docs/test-plan.md.
        DisplayName name = method.getAnnotation(DisplayName.class);
        Matcher id = name == null ? null : TEST_ID.matcher(name.value());
        if (id == null || !id.lookingAt()) {
          problems.add(where + ": @DisplayName must start with a test-plan ID, e.g. \"U2: ...\"");
        } else if (!planIds.contains(id.group(1))) {
          problems.add(where + ": ID " + id.group(1) + " is not in docs/test-plan.md");
        }
      }
    }

    assertTrue(problems.isEmpty(), () -> "Tag check failed:\n  - " + String.join("\n  - ", problems));
  }

  private static List<Class<?>> testClasses() throws Exception {
    URL root = TagGuardTest.class.getClassLoader().getResource(TESTS_PACKAGE.replace('.', '/'));
    if (root == null) return List.of();
    Path dir = Path.of(root.toURI());
    List<Class<?>> classes = new ArrayList<>();
    try (Stream<Path> files = Files.walk(dir)) {
      for (Path file : files.filter(p -> p.toString().endsWith(".class") && !p.toString().contains("$")).toList()) {
        String relative = dir.relativize(file).toString().replace(File.separatorChar, '.');
        classes.add(Class.forName(TESTS_PACKAGE + "." + relative.substring(0, relative.length() - ".class".length())));
      }
    }
    return classes;
  }
}
