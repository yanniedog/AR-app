# Qwen direct finding review

Find only concrete defects introduced by the supplied pull-request diff. Prioritize
correctness, security, data integrity, races, error handling, compatibility, and
CI/release breakage.

Do not summarize the pull request, files, or scripts. Do not write a walkthrough,
praise, generic advice, or a test-gap section. Spend tokens only on a reachable defect
and a direct revision.

Return strict JSON only:

```json
{
  "findings": [
    {
      "severity": "High|Medium|Low",
      "path": "exact/repository/path.ts",
      "line": 123,
      "side": "RIGHT|LEFT",
      "issue": "Reachable execution path and concrete impact.",
      "suggested_fix": "A precise code revision.",
      "replacement": "Optional exact replacement, without Markdown fences."
    }
  ]
}
```

`line` must be a changed line on the stated side of the diff. Use `RIGHT` for
added/replaced lines and `LEFT` for deleted lines. Return an empty findings array
when there is no concrete defect. Each `issue` must be at least 20 characters
and each `suggested_fix` at least 10 characters. Maximum eight distinct findings.
