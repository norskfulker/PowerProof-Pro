import { describe, expect, it } from "vitest";
import { contrast } from "../color";
import { PAGE_TEMPLATES } from "./templates";
import { artFor, TEMPLATE_ART } from "./template-art";

describe("template art", () => {
  it("keeps white text readable on every gradient stop", () => {
    for (const [id, a] of Object.entries(TEMPLATE_ART)) {
      expect(contrast("#FFFFFF", a.from), `${id} from`).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#FFFFFF", a.to), `${id} to`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("gives every ready-made page its own colours", () => {
    for (const t of PAGE_TEMPLATES) expect(TEMPLATE_ART[t.id], t.id).toBeDefined();
    expect(artFor("unknown")).toBe(TEMPLATE_ART.blank);
  });
});
