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
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

function extractAgentText(stdout: string): string {
  const texts: string[] = [];

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const event = JSON.parse(trimmed) as {
        type?: string;
        item?: { type?: string; text?: string };
      };

      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        texts.push(event.item.text);
      }
    } catch {
      // Ignore non-JSON lines and keep scanning.
    }
  }

  return texts.join("\n");
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Sandcastle's idle timeout is based on lack of streamed output, not wall time.
// Give coding phases more headroom because they can stay quiet for a while.
const PLANNER_IDLE_TIMEOUT_SECONDS = 10 * 60;
const IMPLEMENTER_IDLE_TIMEOUT_SECONDS = 30 * 60;
const REVIEWER_IDLE_TIMEOUT_SECONDS = 10 * 60;
const MERGER_IDLE_TIMEOUT_SECONDS = 15 * 60;

// No startup install hook for now.
// This repo does not yet have a runnable app stack inside the sandbox, and
// forcing a package-manager install during sandbox boot adds avoidable failure
// points. Reintroduce a pnpm hook later when the project actually needs it.
const hooks = {
  sandbox: { onSandboxReady: [] },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full reinstall from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ["node_modules"];

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

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
    hooks,
    sandbox: docker({
      mounts: [
        {
          hostPath: "~/.codex/auth.json",
          sandboxPath: "/home/agent/.codex/auth.json",
          readonly: true,
        },
      ],
    }),
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    idleTimeoutSeconds: PLANNER_IDLE_TIMEOUT_SECONDS,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: sandcastle.codex("gpt-5.4", { effort: "high" }),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  const plannerText = extractAgentText(plan.stdout);

  // Extract the <plan>…</plan> block from the planner agent message.
  const planMatch = plannerText.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plannerText,
    );
  }

  const rawPlan = planMatch[1]!.trim();
  const normalizedPlan = rawPlan
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .replace(/\\n/g, "\n")
    .trim();

  // The plan JSON contains an array of issues, each with id, title, branch.
  let parsedPlan: unknown;
  try {
    parsedPlan = JSON.parse(normalizedPlan);
  } catch {
    throw new Error(
      "Planning agent produced an invalid <plan> payload.\n\n" +
        normalizedPlan +
        "\n\nPlanner text:\n" +
        plannerText +
        "\n\nFull stdout:\n" +
        plan.stdout,
    );
  }

  const { issues } = parsedPlan as {
    issues: { id: string; title: string; branch: string }[];
  };

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

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: docker({
      mounts: [
        {
          hostPath: "~/.codex/auth.json",
          sandboxPath: "/home/agent/.codex/auth.json",
          readonly: true,
        },
      ],
    }),
        hooks,
        copyToWorktree,
      });

      try {
        // Run the implementer
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          idleTimeoutSeconds: IMPLEMENTER_IDLE_TIMEOUT_SECONDS,
          agent: sandcastle.codex("gpt-5.4"),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Only review if the implementer produced commits
        if (implement.commits.length > 0) {
          await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            idleTimeoutSeconds: REVIEWER_IDLE_TIMEOUT_SECONDS,
            agent: sandcastle.codex("gpt-5.4-mini"),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
            },
          });
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
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
  // The {{BRANCHES}} argument tells the agent what to merge, and the
  // {{ISSUE_BRANCH_MAP}} argument provides an explicit branch → issue mapping
  // for the issue-closing step.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    sandbox: docker({
      mounts: [
        {
          hostPath: "~/.codex/auth.json",
          sandboxPath: "/home/agent/.codex/auth.json",
          readonly: true,
        },
      ],
    }),
    name: "merger",
    maxIterations: 1,
    idleTimeoutSeconds: MERGER_IDLE_TIMEOUT_SECONDS,
    agent: sandcastle.codex("gpt-5.4-mini"),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      // A structured branch → issue mapping for post-merge issue closure.
      ISSUE_BRANCH_MAP: JSON.stringify(
        completedIssues.map((issue) => ({
          issueId: issue.id,
          title: issue.title,
          branch: issue.branch,
        })),
        null,
        2,
      ),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
