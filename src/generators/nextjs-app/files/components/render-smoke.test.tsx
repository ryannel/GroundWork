import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Loading from "@/app/loading";

/**
 * Component render tests — Tier 1 of the visual verification loop.
 *
 * A page-level behavioural test passes while a component throws on a prop or
 * state combination it was never rendered with; this layer catches that in
 * isolation, before any page integrates the component. Every component should
 * render without throwing across the states the design system names — default,
 * loading, empty, error, and long-content — not only the populated happy path.
 *
 * This example proves the harness on the scaffold's own `Loading` component.
 * A bet extends this pattern per component it delivers, one `describe` block per
 * component with one `it` per named state:
 *
 *   describe("UserCard", () => {
 *     it("renders default", () => expect(render(<UserCard user={u} />).container.firstChild).not.toBeNull());
 *     it("renders empty", () => expect(render(<UserCard user={null} />).container.firstChild).not.toBeNull());
 *     it("renders long content", () => expect(render(<UserCard user={longName} />).container.firstChild).not.toBeNull());
 *   });
 */
describe("Loading", () => {
  it("renders without throwing", () => {
    const { container } = render(<Loading />);
    expect(container.firstChild).not.toBeNull();
  });
});
