import { describe, expect, it } from "vitest";
import type { AppLabel } from "./labels";
import {
  deriveLabelRows,
  deriveLabelsSummary,
  deriveSelectableParentOptions,
  deriveVisibleLabelRows,
  parseLabelsFilterValue,
  parseLabelsSortValue,
} from "./labels-management-view";

const labels: AppLabel[] = [
  {
    id: "label-science",
    name: "Science",
    parentIds: [],
  },
  {
    id: "label-biology",
    name: "Biology",
    parentIds: ["label-science"],
  },
  {
    id: "label-chemistry",
    name: "Chemistry",
    parentIds: ["label-science"],
  },
  {
    id: "label-dormant",
    name: "Dormant",
    parentIds: [],
  },
];

const notes = [
  {
    labelIds: ["label-science"],
  },
  {
    labelIds: ["label-science"],
  },
  {
    labelIds: ["label-biology"],
  },
];

describe("labels management view", () => {
  it("derives parent names, child counts, and direct note counts", () => {
    const rows = deriveLabelRows({
      labels,
      notes,
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          childCount: 2,
          directNoteCount: 2,
          isTopLevel: true,
          label: "Science",
          parentNames: [],
        }),
        expect.objectContaining({
          childCount: 0,
          directNoteCount: 1,
          isTopLevel: false,
          label: "Biology",
          parentNames: ["Science"],
        }),
        expect.objectContaining({
          childCount: 0,
          directNoteCount: 0,
          isUnused: true,
          label: "Dormant",
          parentNames: [],
        }),
      ]),
    );
  });

  it("derives compact summary counts", () => {
    const rows = deriveLabelRows({
      labels,
      notes,
    });
    const summary = deriveLabelsSummary(rows);

    expect(summary).toEqual({
      relationshipCount: 2,
      topLevelCount: 2,
      totalCount: 4,
      unusedCount: 2,
    });
  });

  it("filters by top-level and unused labels", () => {
    const rows = deriveLabelRows({
      labels,
      notes,
    });

    expect(
      deriveVisibleLabelRows({
        filterValue: "top-level",
        rows,
        searchQuery: "",
        sortValue: "name-asc",
      }).map((row) => row.label),
    ).toEqual(["Dormant", "Science"]);

    expect(
      deriveVisibleLabelRows({
        filterValue: "unused",
        rows,
        searchQuery: "",
        sortValue: "name-asc",
      }).map((row) => row.label),
    ).toEqual(["Chemistry", "Dormant"]);
  });

  it("searches labels case-insensitively and sorts by notes and children", () => {
    const rows = deriveLabelRows({
      labels,
      notes,
    });

    expect(
      deriveVisibleLabelRows({
        filterValue: "all",
        rows,
        searchQuery: "CHEM",
        sortValue: "name-asc",
      }).map((row) => row.label),
    ).toEqual(["Chemistry"]);

    expect(
      deriveVisibleLabelRows({
        filterValue: "all",
        rows,
        searchQuery: "",
        sortValue: "notes-desc",
      }).map((row) => row.label),
    ).toEqual(["Science", "Biology", "Chemistry", "Dormant"]);

    expect(
      deriveVisibleLabelRows({
        filterValue: "all",
        rows,
        searchQuery: "",
        sortValue: "children-desc",
      }).map((row) => row.label),
    ).toEqual(["Science", "Biology", "Chemistry", "Dormant"]);
  });

  it("parses known filter and sort values", () => {
    expect(parseLabelsFilterValue("unused")).toBe("unused");
    expect(parseLabelsFilterValue("missing")).toBeNull();
    expect(parseLabelsSortValue("notes-desc")).toBe("notes-desc");
    expect(parseLabelsSortValue("missing")).toBeNull();
  });

  it("derives searchable parent options and excludes selected parents", () => {
    const rows = deriveLabelRows({
      labels,
      notes,
    });

    expect(
      deriveSelectableParentOptions({
        rows,
        searchQuery: "sci",
        selectedParentIds: [],
      }),
    ).toEqual([
      {
        directNoteCount: 2,
        id: "label-science",
        label: "Science",
      },
    ]);

    expect(
      deriveSelectableParentOptions({
        rows,
        searchQuery: "",
        selectedParentIds: ["label-science"],
      }).map((option) => option.id),
    ).not.toContain("label-science");
  });
});
