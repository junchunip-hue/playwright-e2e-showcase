package com.showcase.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;

/** Kind "e2e" (TS: Tag.e2e): a journey across pages, API and UI. Combine with a tier. */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Tag(Tags.E2E)
public @interface Journey {}
