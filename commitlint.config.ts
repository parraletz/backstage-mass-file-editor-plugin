import type { UserConfig } from "@commitlint/types"

const config: UserConfig = {
  extends: ["@commitlint/config-angular"],
  rules: {
    "subject-case": [2, "always", "sentence-case"],
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
        "wip",
      ],
    ],
  },
}

export default config
