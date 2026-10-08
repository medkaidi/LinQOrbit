import { describe, expect, it } from "vitest";
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from "axios";
import { getApiErrorMessage } from "@/lib/utils/api-error";

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const config = {} as InternalAxiosRequestConfig;
  const response = { data, status, statusText: String(status), headers: {}, config } as AxiosResponse;
  return new AxiosError(`Request failed with status code ${status}`, String(status), config, null, response);
}

describe("getApiErrorMessage", () => {
  it("prefers the ProblemDetail detail (backend-built message, shown as-is)", () => {
    const error = axiosErrorWith(404, {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Skill suggestion not found",
    });

    expect(getApiErrorMessage(error)).toBe("Skill suggestion not found");
  });

  it("falls back to the ProblemDetail title when detail is absent", () => {
    expect(getApiErrorMessage(axiosErrorWith(403, { title: "Forbidden" }))).toBe("Forbidden");
  });

  it("uses the generic message when the body carries neither detail nor title", () => {
    expect(getApiErrorMessage(axiosErrorWith(500, {}))).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("uses the network message when the server cannot be reached", () => {
    const config = {} as InternalAxiosRequestConfig;
    const error = new AxiosError("Network Error", "ERR_NETWORK", config, null);

    expect(getApiErrorMessage(error)).toBe("Cannot reach the server. Please try again.");
  });

  it("uses the generic message for a non-axios error", () => {
    expect(getApiErrorMessage(new Error("boom"))).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
