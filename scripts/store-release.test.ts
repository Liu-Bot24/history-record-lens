import { describe, expect, it } from "vitest";
import { getStorePackageBaseName, getStorePackageFilePath, getStorePackageFileName } from "./store-release.mjs";

describe("store release naming", () => {
  it("builds the expected Chrome Web Store package names", () => {
    expect(getStorePackageBaseName("1.0.3")).toBe("history-record-lens-v1.0.3-cws");
    expect(getStorePackageFileName("1.0.3")).toBe("history-record-lens-v1.0.3-cws.zip");
    expect(getStorePackageFilePath("1.0.3")).toBe("releases/history-record-lens-v1.0.3-cws.zip");
  });
});
