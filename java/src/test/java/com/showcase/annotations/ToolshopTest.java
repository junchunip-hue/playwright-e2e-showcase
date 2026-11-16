package com.showcase.annotations;

import com.microsoft.playwright.junit.UsePlaywright;
import com.showcase.config.ToolshopOptions;
import java.lang.annotation.ElementType;
import java.lang.annotation.Inherited;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** A Toolshop test class: Playwright fixtures configured by {@link ToolshopOptions}. */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Inherited
@UsePlaywright(ToolshopOptions.class)
public @interface ToolshopTest {}
