import { describe, expect, it } from "vitest";
import { AUTHOR_LINK, AUTHOR_TEXT } from "./branding";

describe("branding", () => {
  it("uses the public author link for the header attribution", () => {
    expect(AUTHOR_TEXT).toBe("Created by @liuqi");
    expect(AUTHOR_LINK).toBe("https://blog.liu-qi.cn/index.php/tools/");
  });
});
