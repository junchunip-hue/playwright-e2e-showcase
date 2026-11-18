package com.showcase.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.DisabledIf;

/**
 * Kind "admin" (TS: Tag.admin): signs in as the seeded admin, or can change catalogue or orders (A10/A11 while their
 * known defects exist). Disabled against the
 * shared public demo (TS: the adminToken fixture skips), so it runs against our own Toolshop only (CI, local Docker).
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Tag(Tags.ADMIN)
@DisabledIf(value = "com.showcase.config.Env#isPublicDemo", disabledReason = "changes catalogue and orders: our own Toolshop only")
public @interface Admin {}
