package com.showcase.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;

/** Kind "negative": invalid input or a rejected request. Combine with a tier, e.g. {@code @SmokeTest @Negative}. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Tag(Tags.NEGATIVE)
public @interface Negative {}
