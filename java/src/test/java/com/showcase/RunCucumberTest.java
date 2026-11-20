package com.showcase;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.JUNIT_PLATFORM_NAMING_STRATEGY_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectDirectories;
import org.junit.platform.suite.api.Suite;

/**
 * Runs the Gherkin features shared with the TypeScript suite (../features) with the steps in
 * com.showcase.steps. Cucumber tags become JUnit tags, so `-Dgroups=smoke` selects the @smoke
 * scenarios (the PR gate). The "long" naming puts the scenario name ("U1: ...") into the Surefire
 * XML, where the CI summary reads IDs.
 */
@Suite
@IncludeEngines("cucumber")
@SelectDirectories("../features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.showcase.steps")
@ConfigurationParameter(key = JUNIT_PLATFORM_NAMING_STRATEGY_PROPERTY_NAME, value = "long")
// ScenarioLog: every step of every scenario with its status (passed, failed, skipped = not run),
// which Surefire drops for passed tests when CI reruns are on.
@ConfigurationParameter(
    key = PLUGIN_PROPERTY_NAME,
    value = "pretty, com.showcase.report.ScenarioLog:target/surefire-reports/scenarios.jsonl")
public class RunCucumberTest {}
