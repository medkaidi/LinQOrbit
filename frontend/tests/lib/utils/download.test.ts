import { describe, expect, it, vi } from "vitest";

import { saveBlob } from "@/lib/utils/download";

function stubBlobUrl() {
  const createObjectURL = vi.fn(() => "blob:mock");
  const revokeObjectURL = vi.fn();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  return {
    createObjectURL,
    revokeObjectURL,
    restore: () => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    },
  };
}

describe("saveBlob", () => {
  it("saves the blob through a temporary link and revokes the URL", () => {
    const stub = stubBlobUrl();
    let clickedDownload: string | null = null;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download;
      });

    try {
      const blob = new Blob(["content"], { type: "text/plain" });
      saveBlob(blob, "file.txt");
    } finally {
      clickSpy.mockRestore();
      stub.restore();
    }

    expect(stub.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickedDownload).toBe("file.txt");
    expect(stub.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("revokes the URL even when the click fails", () => {
    const stub = stubBlobUrl();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click failed");
    });

    try {
      expect(() => saveBlob(new Blob(["x"]), "file.txt")).toThrow("click failed");
    } finally {
      clickSpy.mockRestore();
      stub.restore();
    }

    expect(stub.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
