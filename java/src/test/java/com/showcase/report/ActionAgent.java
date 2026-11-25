package com.showcase.report;

import static net.bytebuddy.matcher.ElementMatchers.hasSuperType;
import static net.bytebuddy.matcher.ElementMatchers.isInterface;
import static net.bytebuddy.matcher.ElementMatchers.isMethod;
import static net.bytebuddy.matcher.ElementMatchers.isPublic;
import static net.bytebuddy.matcher.ElementMatchers.isStatic;
import static net.bytebuddy.matcher.ElementMatchers.nameStartsWith;
import static net.bytebuddy.matcher.ElementMatchers.named;
import static net.bytebuddy.matcher.ElementMatchers.namedOneOf;
import static net.bytebuddy.matcher.ElementMatchers.not;

import java.util.Map;
import net.bytebuddy.agent.ByteBuddyAgent;
import net.bytebuddy.agent.builder.AgentBuilder;
import net.bytebuddy.asm.Advice;
import net.bytebuddy.implementation.bytecode.assign.Assigner;

/**
 * Lets {@link ActionLog} see the calls it records. Playwright for Java has no step events (in
 * TypeScript, Playwright Test provides them), so the classes behind Playwright's public interfaces
 * and JUnit's Assertions get a call to ActionLog before and after each public method (Byte Buddy).
 * What they do does not change. Installed once per JVM, by {@link ScenarioLog}.
 */
public final class ActionAgent {
  private static final String PLAYWRIGHT = "com.microsoft.playwright.";
  private static boolean installed;

  private ActionAgent() {}

  static synchronized void install() {
    if (installed) return;
    installed = true;
    new AgentBuilder.Default()
        // A class that cannot be recorded is said out loud, not silently left out of the report.
        .with(AgentBuilder.Listener.StreamWriting.toSystemError().withErrorsOnly())
        .disableClassFormatChanges()
        .with(AgentBuilder.RedefinitionStrategy.RETRANSFORMATION)
        .type(
            nameStartsWith(PLAYWRIGHT + "impl.")
                .and(not(isInterface()))
                .and(
                    hasSuperType(
                        namedOneOf(
                            PLAYWRIGHT + "Page",
                            PLAYWRIGHT + "Locator",
                            PLAYWRIGHT + "Browser",
                            PLAYWRIGHT + "BrowserType",
                            PLAYWRIGHT + "BrowserContext",
                            PLAYWRIGHT + "APIRequest",
                            PLAYWRIGHT + "APIRequestContext",
                            PLAYWRIGHT + "assertions.PageAssertions",
                            PLAYWRIGHT + "assertions.LocatorAssertions"))))
        .transform((builder, type, loader, module, domain) ->
            builder.visit(
                Advice.to(Call.class).on(isMethod().and(isPublic()).and(not(isStatic())))))
        .type(named("org.junit.jupiter.api.Assertions"))
        .transform((builder, type, loader, module, domain) ->
            builder.visit(
                Advice.to(Call.class).on(isPublic().and(isStatic()).and(nameStartsWith("assert")))))
        .installOn(ByteBuddyAgent.install());
  }

  /** Copied into the recorded methods, so it may only use what is public. */
  public static final class Call {
    private Call() {}

    @Advice.OnMethodEnter
    public static Map<String, Object> enter(
        @Advice.This(optional = true, typing = Assigner.Typing.DYNAMIC) Object target,
        @Advice.Origin("#m") String method,
        @Advice.AllArguments Object[] args) {
      return ActionLog.enter(target, method, args);
    }

    @Advice.OnMethodExit(onThrowable = Throwable.class)
    public static void exit(
        @Advice.Enter Map<String, Object> action, @Advice.Thrown Throwable error) {
      ActionLog.exit(action, error);
    }
  }
}
