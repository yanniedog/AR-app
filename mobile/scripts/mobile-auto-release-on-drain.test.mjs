#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import {
  checkedGhOutput,
  waitForQueueDrain,
  ensureApkForMainHead,
} from "./mobile-auto-release-on-drain.mjs";
import { requiredPrCheckDispatches } from "../../scripts/lib/required-pr-check-dispatch.mjs";

test("checkedGhOutput returns trimmed stdout for a successful command", () => {
  assert.equal(
    checkedGhOutput({ status: 0, stdout: "[]\n", stderr: "" }, ["pr", "list"]),
    "[]",
  );
});

test("checkedGhOutput surfaces command and spawn failures", () => {
  assert.throws(
    () =>
      checkedGhOutput({ status: 1, stdout: "", stderr: "denied" }, [
        "pr",
        "list",
      ]),
    /gh pr list failed: denied/,
  );
  assert.throws(
    () =>
      checkedGhOutput(
        { status: null, stdout: "", stderr: "", error: new Error("timed out") },
        ["pr", "list"],
      ),
    /gh pr list failed to execute: timed out/,
  );
});

test("generated PRs explicitly dispatch every required check on their head branch", () => {
  assert.deepEqual(
    requiredPrCheckDispatches(72, "chore/mobile-auto-release-v1.2.3"),
    [
      {
        workflow: "app-ci.yml",
        ref: "chore/mobile-auto-release-v1.2.3",
        inputs: [],
      },
      {
        workflow: "pr-bot-feedback-check.yml",
        ref: "chore/mobile-auto-release-v1.2.3",
        inputs: ["-f", "pr_number=72"],
      },
    ],
  );
});

test("waitForQueueDrain refreshes main after a queued PR closes", async () => {
  const openCounts = [1, 0];
  let syncCount = 0;

  const remaining = await waitForQueueDrain({
    countOpen: () => openCounts.shift() ?? 0,
    sleep: async () => {},
    syncAfterDrain: () => {
      syncCount += 1;
    },
  });

  assert.equal(remaining, 0);
  assert.equal(syncCount, 1);
});

test("waitForQueueDrain skips without refreshing when multiple PRs remain", async () => {
  let syncCount = 0;

  const remaining = await waitForQueueDrain({
    countOpen: () => 2,
    sleep: async () => {},
    syncAfterDrain: () => {
      syncCount += 1;
    },
  });

  assert.equal(remaining, 2);
  assert.equal(syncCount, 0);
});

test("ensureApkForMainHead dispatches when the version has no published APK", () => {
  const dispatched = [];
  const did = ensureApkForMainHead({
    readVersion: () => "1.0.40",
    releaseExists: () => false,
    buildInFlight: () => false,
    dispatch: (v) => dispatched.push(v),
  });
  assert.equal(did, true);
  assert.deepEqual(dispatched, ["1.0.40"]);
});

test("ensureApkForMainHead is a no-op when the APK is already published", () => {
  let dispatchedCount = 0;
  const did = ensureApkForMainHead({
    readVersion: () => "1.0.29",
    releaseExists: (v) => v === "1.0.29",
    buildInFlight: () => false,
    dispatch: () => {
      dispatchedCount += 1;
    },
  });
  assert.equal(did, false);
  assert.equal(dispatchedCount, 0);
});

test("ensureApkForMainHead skips dispatch when a build is already in flight", () => {
  let dispatchedCount = 0;
  const did = ensureApkForMainHead({
    readVersion: () => "1.0.41",
    releaseExists: () => false,
    buildInFlight: () => true,
    dispatch: () => {
      dispatchedCount += 1;
    },
  });
  assert.equal(did, false);
  assert.equal(dispatchedCount, 0);
});
