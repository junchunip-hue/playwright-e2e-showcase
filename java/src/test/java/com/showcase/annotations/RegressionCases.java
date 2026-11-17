package com.showcase.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;

/**
 * Tier "regression" for data-driven tests: one case per argument, named by the argument
 * (TS equivalent: a test per item in a `for` loop). Use with {@code @MethodSource} and {@code Named} arguments.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@ParameterizedTest(name = "› {0}")
@Tag(Tags.REGRESSION)
public @interface RegressionCases {}
