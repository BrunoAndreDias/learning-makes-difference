// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAppStudyNotesContext } from "../../modules/study-notes";
import { renderRoute } from "./app-shell-test-support";

describe("authenticated Study Notes workspace", () => {
  it("renders Study Notes as the primary workspace with source context below the Study Note fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    studyNotesContext.createStudyNote(userId, {
      sourceBody: "Testing retrieval strengthens durable recall.",
      sourceTitle: "Retrieval practice",
    });

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Study Notes" }),
    ).toBeInTheDocument();

    const catalog = screen.getByRole("complementary", {
      name: "Study Notes catalog",
    });
    expect(
      within(catalog).getByRole("navigation", { name: "Study Notes list" }),
    ).toBeInTheDocument();
    expect(
      within(catalog).getByRole("button", { name: "Retrieval practice" }),
    ).toHaveAttribute("aria-current", "page");

    expect(screen.getByLabelText("Prompt")).toHaveValue("Retrieval practice");
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
    expect(screen.getByLabelText("Source title")).toHaveValue(
      "Retrieval practice",
    );
    expect(screen.getByLabelText("Source body")).toHaveValue(
      "Testing retrieval strengthens durable recall.",
    );
  });

  it("creates, edits, and saves a Study Note without rewriting source fields into Study Note fields", async () => {
    const studyNotesContext = createAppStudyNotesContext({
      keyPrefix: `test-study-notes-${Math.random().toString(36).slice(2)}`,
      storage: window.localStorage,
    });
    const userId = "user-jordan";

    renderRoute("/study-notes", {
      session: {
        user: {
          displayName: "Jordan Review",
          email: "jordan@example.com",
          id: userId,
          userLanguage: "en",
        },
      },
      studyNotesContext,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "New Study Note" }),
    );
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "What should I recall first?" },
    });
    fireEvent.change(screen.getByLabelText("Expected answer"), {
      target: { value: "Recall before reading." },
    });
    fireEvent.change(screen.getByLabelText("Source title"), {
      target: { value: "Edited source title" },
    });
    fireEvent.change(screen.getByLabelText("Source body"), {
      target: { value: "Edited source body." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "What should I recall first?",
    );
    expect(screen.getByLabelText("Expected answer")).toHaveValue(
      "Recall before reading.",
    );
    expect(screen.getByLabelText("Source title")).toHaveValue(
      "Edited source title",
    );
    expect(screen.getByLabelText("Source body")).toHaveValue(
      "Edited source body.",
    );
  });
});
