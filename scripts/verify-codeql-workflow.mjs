#!/usr/bin/env node
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function verifyNativeAnalysis(workflow, sources) {
  assert.match(workflow, /language: java-kotlin\s+build-mode: manual/);
  const steps = workflow.split(/^      - /m);
  const prepareIndex = steps.findIndex((step) => step.startsWith("name: Prepare Android settings dependencies"));
  const initIndex = steps.findIndex((step) => /uses: github\/codeql-action\/init@/.test(step));
  const compileIndex = steps.findIndex((step) => step.startsWith("name: Compile native modules for CodeQL"));
  const analyzeIndex = steps.findIndex((step) => /uses: github\/codeql-action\/analyze@/.test(step));
  assert(prepareIndex > 0 && initIndex > prepareIndex && compileIndex > initIndex && analyzeIndex > compileIndex,
    "settings preparation must precede init, with native compilation and analysis after init");
  const prepare = steps[prepareIndex];
  const compile = steps[compileIndex];
  for (const step of [prepare, compile]) {
    assert.match(step, /if: matrix.language == 'java-kotlin'/);
    assert.match(step, /working-directory: mobile\/android/);
    assert.match(step, /set -o pipefail/);
    assert.doesNotMatch(step, /continue-on-error|\|\|\s*true/);
    assert.match(step, /--no-daemon/);
    assert.match(step, /--no-build-cache/);
    assert.match(step, /--info/);
    assert.match(step, /--stacktrace/);
  }
  assert.match(prepare, /timeout-minutes: 10/);
  assert.match(prepare, /timeout 8m \.\/gradlew help\s/);
  assert.doesNotMatch(prepare, /:compile|:assemble|:build/);
  assert.match(compile, /--rerun-tasks/);
  assert(sources.length > 0, "native module inventory must not be empty");
  const tasks = new Set(compile.match(/:[\w-]+:compileRelease(?:Kotlin|JavaWithJavac)\b/g));
  for (const source of sources) {
    const [, moduleName, extension] = source.match(/^mobile\/modules\/([^/]+)\/android\/src\/main\/.*\.(kt|java)$/) ?? [];
    assert(moduleName, `unrecognized native source layout: ${source}`);
    const packageJson = JSON.parse(readFileSync(new URL(`../mobile/modules/${moduleName}/package.json`, import.meta.url), "utf8"));
    const projectName = packageJson.name.replace(/^@/, "").replaceAll("/", "-");
    const compiler = extension === "kt" ? "Kotlin" : "JavaWithJavac";
    assert(tasks.has(`:${projectName}:compileRelease${compiler}`), `CodeQL must compile ${source} under the tracer`);
  }
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /if: always\(\) && matrix.language == 'java-kotlin'/);
  assert.match(workflow, /retention-days: 7/);
}

export function verifyCodeqlWorkflow() {
  const workflow = readFileSync(new URL("../.github/workflows/codeql.yml", import.meta.url), "utf8");
  const sources = execFileSync("git", ["ls-files", "mobile/modules/**/*.kt", "mobile/modules/**/*.java"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  verifyNativeAnalysis(workflow, sources);
  assert.throws(() => verifyNativeAnalysis(workflow.replace("build-mode: manual", "build-mode: none"), sources));
  assert.throws(() => verifyNativeAnalysis(workflow.replace("--rerun-tasks", ""), sources));
  assert.throws(() => verifyNativeAnalysis(workflow.replace(":ar-history-codec:compileReleaseJavaWithJavac", ""), sources));
  assert.throws(() => verifyNativeAnalysis(workflow.replace("set -o pipefail", "true"), sources));
  assert.throws(() => verifyNativeAnalysis(workflow.replace("timeout-minutes: 10", "continue-on-error: true\n        timeout-minutes: 10"), sources));
  const withoutPreparation = workflow.replace(/      - name: Prepare Android settings dependencies[\s\S]*?(?=      - name: Initialize CodeQL)/, "");
  assert.throws(() => verifyNativeAnalysis(withoutPreparation, sources));
  console.log(`CodeQL workflow verification passed (${sources.length} native module sources).`);
}
