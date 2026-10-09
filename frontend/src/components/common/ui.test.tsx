import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceBadge, StateBadge } from "./ui";

describe("status labelling (honesty-critical)", () => {
  it("renders the monitoring state verbatim", () => {
    render(<StateBadge state="ALERT" />);
    expect(screen.getByText("ALERT")).toBeTruthy();
  });

  it("labels official data as OFFICIAL and fixtures as FIXTURE, never LIVE", () => {
    const { rerender } = render(<SourceBadge source="IMPORTED_OFFICIAL" />);
    expect(screen.getByText("OFFICIAL")).toBeTruthy();
    rerender(<SourceBadge source="TEST_FIXTURE" />);
    expect(screen.getByText("FIXTURE")).toBeTruthy();
    expect(screen.queryByText("LIVE")).toBeNull();
  });
});
