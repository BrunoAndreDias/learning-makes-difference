// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createRouteTestSessionContext,
  renderRoute,
  TEST_PILOT_REGISTRATION_CODE,
} from "./app-shell-test-support";

describe("authenticated app shell", () => {
  it("manages labels and rejects cycle-causing parent relationships", async () => {
    const sessionContext = createRouteTestSessionContext();

    await sessionContext.register({
      displayName: "Casey Learner",
      email: "casey@example.com",
      password: "correct horse battery staple",
      pilotRegistrationCode: TEST_PILOT_REGISTRATION_CODE,
    });

    renderRoute("/labels", { sessionContext });

    expect(
      await screen.findByRole("heading", { name: "Manage your label graph" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New label name"), {
      target: { value: "Science" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create label form" }));

    expect(await screen.findByDisplayValue("Science")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("New label name"), {
      target: { value: "Biology" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create label form" }));

    const biologySection = (
      await screen.findByRole("heading", {
        name: "Biology",
      })
    ).closest("article");

    if (biologySection === null) {
      throw new Error("Biology card not found.");
    }

    const scienceOption = within(biologySection).getByRole("option", {
      name: "Science",
    }) as HTMLOptionElement;

    fireEvent.change(
      within(biologySection).getByLabelText("Add parent label"),
      {
        target: { value: scienceOption.value },
      },
    );
    fireEvent.submit(
      within(biologySection).getByRole("form", {
        name: "Add parent for Biology",
      }),
    );

    expect(within(biologySection).getByText("Science")).toBeInTheDocument();

    const scienceSection = (
      await screen.findByRole("heading", {
        name: "Science",
      })
    ).closest("article");

    if (scienceSection === null) {
      throw new Error("Science card not found.");
    }

    const biologyOption = within(scienceSection).getByRole("option", {
      name: "Biology",
    }) as HTMLOptionElement;

    fireEvent.change(
      within(scienceSection).getByLabelText("Add parent label"),
      {
        target: { value: biologyOption.value },
      },
    );
    fireEvent.submit(
      within(scienceSection).getByRole("form", {
        name: "Add parent for Science",
      }),
    );

    expect(
      await screen.findByRole("alert", {
        name: "Label management feedback",
      }),
    ).toHaveTextContent("create a cycle");

    fireEvent.change(within(scienceSection).getByLabelText("Label name"), {
      target: { value: "Natural Science" },
    });
    fireEvent.submit(
      within(scienceSection).getByRole("form", {
        name: "Rename Science",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Natural Science" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(biologySection).getByRole("button", { name: "Delete Biology" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Biology" }),
    ).not.toBeInTheDocument();
  });
});
