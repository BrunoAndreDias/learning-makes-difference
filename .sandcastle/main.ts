// Parallel Planner with Review — four-phase orchestration loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execFileSync } from "node:child_process";

// Sandcastle's merge-to-head sync runs plain `git merge` on the host.
// Keep it non-interactive so divergent syncs fail or complete instead of
// waiting for a merge-message editor until Sandcastle's 30s timeout.
process.env.GIT_MERGE_AUTOEDIT ??= "no";

type PlanIssue = { id: string; title: string; branch: string };
type Plan = { issues: PlanIssue[] };

const stripMarkdownFence = (value: string) =>
  value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const parsePlanJson = (rawPlan: string): Plan => {
  const strippedPlan = stripMarkdownFence(rawPlan);
  const candidates = [
    strippedPlan,
    strippedPlan.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim(),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const plan =
        typeof parsed === "string"
          ? (JSON.parse(stripMarkdownFence(parsed)) as unknown)
          : parsed;

      if (
        plan &&
        typeof plan === "object" &&
        "issues" in plan &&
        Array.isArray((plan as { issues: unknown }).issues)
      ) {
        return plan as Plan;
      }
    } catch {
      // Try the next known planner output shape.
    }
  }

  throw new Error(
    "Planning agent produced plan JSON without an issues array.\n\n" +
      rawPlan.trim(),
  );
};

const parsePositiveInteger = (value: string | undefined, fallback: number) => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getHostGitStatus = () =>
  execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    encoding: "utf8",
  }).replace(/\n$/, "");

const assertCleanHostWorktree = (phase: string) => {
  const status = getHostGitStatus();

  if (status.length === 0) {
    return;
  }

  const lines = status.split("\n");
  const preview = lines.slice(0, 20).join("\n");
  const suffix =
    lines.length > 20 ? `\n...and ${lines.length - 20} more change(s)` : "";

  throw new Error(
    `Sandcastle ${phase} requires a clean host worktree before merge-to-head can run safely.\n` +
      "Commit or stash these host changes, then rerun Sandcastle:\n\n" +
      `${preview}${suffix}`,
  );
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Limit concurrently-running issue sandboxes. This keeps local resource usage
// and process signal listeners bounded while still allowing useful parallelism.
const MAX_PARALLEL_ISSUES = parsePositiveInteger(
  process.env.SANDCASTLE_MAX_PARALLEL_ISSUES,
  4,
);

const AGENT_IDLE_TIMEOUT_SECONDS = parsePositiveInteger(
  process.env.SANDCASTLE_IDLE_TIMEOUT_SECONDS,
  1_800,
);

// Hooks run inside worktree-backed sandboxes before agents start.
// CI=true prevents pnpm from prompting if it needs to recreate node_modules.
const installHooks = {
  sandbox: { onSandboxReady: [{ command: "CI=true pnpm install" }] },
};

const sandboxProvider = docker({
  mounts: [
    {
      hostPath: "~/.codex/auth.json",
      sandboxPath: "/home/agent/.codex/auth.json",
      readonly: true,
    },
  ],
});

const runIssuePipeline = async (issue: PlanIssue) => {
  const sandbox = await sandcastle.createSandbox({
    branch: issue.branch,
    sandbox: sandboxProvider,
    hooks: installHooks,
  });

  try {
    // Run the implementer
    const implement = await sandbox.run({
      name: "implementer",
      maxIterations: 100,
      idleTimeoutSeconds: AGENT_IDLE_TIMEOUT_SECONDS,
      agent: sandcastle.codex("gpt-5.4", { effort: "xhigh" }),
      promptFile: "./.sandcastle/implement-prompt.md",
      promptArgs: {
        TASK_ID: issue.id,
        ISSUE_TITLE: issue.title,
        BRANCH: issue.branch,
      },
    });

    // Only review if the implementer produced commits
    if (implement.commits.length > 0) {
      const review = await sandbox.run({
        name: "reviewer",
        maxIterations: 1,
        idleTimeoutSeconds: AGENT_IDLE_TIMEOUT_SECONDS,
        agent: sandcastle.codex("gpt-5.5", { effort: "xhigh" }),
        promptFile: "./.sandcastle/review-prompt.md",
        promptArgs: {
          BRANCH: issue.branch,
        },
      });

      // Merge commits from both runs so the merge phase sees all of them.
      // Each sandbox.run() only returns commits from its own run.
      return {
        ...review,
        commits: [...implement.commits, ...review.commits],
      };
    }

    return implement;
  } finally {
    await sandbox.close();
  }
};

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);
  assertCleanHostWorktree("planning phase");

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — we parse that to drive Phase 2.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    sandbox: sandboxProvider,
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    idleTimeoutSeconds: AGENT_IDLE_TIMEOUT_SECONDS,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: sandcastle.codex("gpt-5.5", { effort: "xhigh" }),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  // Extract the <plan>…</plan> block from the agent's stdout.
  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  // The plan JSON contains an array of issues, each with id, title, branch.
  const { issues } = parsePlanJson(planMatch[1]!);

  if (issues.length === 0) {
    // No unblocked work — either everything is done or everything is blocked.
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if it produces commits, the reviewer runs in the same sandbox.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled: Array<{
    issue: PlanIssue;
    outcome: PromiseSettledResult<
      Awaited<ReturnType<typeof runIssuePipeline>>
    >;
  }> = [];

  for (let start = 0; start < issues.length; start += MAX_PARALLEL_ISSUES) {
    const batch = issues.slice(start, start + MAX_PARALLEL_ISSUES);
    const batchNumber = Math.floor(start / MAX_PARALLEL_ISSUES) + 1;
    const batchCount = Math.ceil(issues.length / MAX_PARALLEL_ISSUES);

    console.log(
      `\nStarting issue batch ${batchNumber}/${batchCount} (${batch.length} issue(s), max ${MAX_PARALLEL_ISSUES} parallel):`,
    );
    for (const issue of batch) {
      console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
    }

    const batchSettled = await Promise.all(
      batch.map(async (issue) => {
        try {
          return {
            issue,
            outcome: {
              status: "fulfilled" as const,
              value: await runIssuePipeline(issue),
            },
          };
        } catch (reason) {
          return {
            issue,
            outcome: { status: "rejected" as const, reason },
          };
        }
      }),
    );

    settled.push(...batchSettled);
  }

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const { issue, outcome } of settled) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issue.id} (${issue.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
  const completedIssues = settled
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    // All agents ran but none made commits — nothing to merge this cycle.
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent merges all completed branches into the current branch,
  // resolving any conflicts and running tests to confirm everything works.
  //
  // The {{BRANCHES}} and {{ISSUES}} prompt arguments are lists that the agent
  // uses to know which branches to merge and which issues to close.
  // -------------------------------------------------------------------------
  assertCleanHostWorktree("merge phase");

  await sandcastle.run({
    hooks: installHooks,
    sandbox: sandboxProvider,
    branchStrategy: { type: "merge-to-head" },
    name: "merger",
    maxIterations: 1,
    idleTimeoutSeconds: AGENT_IDLE_TIMEOUT_SECONDS,
    agent: sandcastle.codex("gpt-5.4", { effort: "xhigh" }),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      // A markdown list of issue IDs and titles, one per line.
      ISSUES: completedIssues
        .map((i) => `- ${i.id}: ${i.title}`)
        .join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
