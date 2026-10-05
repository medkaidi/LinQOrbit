import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, me: vi.fn(), updateProfile: vi.fn() };
});

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, updateTargetPosition: vi.fn() };
});

import { me, updateProfile, type AuthUser } from "@/lib/api/auth.api";
import { updateTargetPosition } from "@/lib/api/candidate.api";
import { IdentityCard, IdentitySection } from "@/features/candidate/identity-card";
import { useAuthStore } from "@/stores/auth-store";

const mockedMe = vi.mocked(me);
const mockedUpdateProfile = vi.mocked(updateProfile);
const mockedUpdateTargetPosition = vi.mocked(updateTargetPosition);

const account: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: "+1 555 000 0000",
  homeCountry: "GB",
  currentCity: "Paris",
  currentCountry: "FR",
};

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityCard targetPosition="Staff Engineer" />
    </QueryClientProvider>,
  );
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentitySection targetPosition="Staff Engineer" />
    </QueryClientProvider>,
  );
}

describe("IdentityCard", () => {
  beforeEach(() => {
    mockedMe.mockReset();
    mockedUpdateProfile.mockReset();
    mockedUpdateTargetPosition.mockReset();
    useAuthStore.getState().clearAuth();
  });

  it("shows the account identity with its avatar and no photo action", async () => {
    mockedMe.mockResolvedValue(account);
    renderCard();

    expect(
      await screen.findByRole("heading", { name: "Personal Information" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("+1 555 000 0000")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByText("France")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change photo" })).not.toBeInTheDocument();
  });

  it("falls back to the stored session when the server is unreachable", async () => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user: account });
    mockedMe.mockRejectedValue(new Error("network down"));
    renderCard();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/unable to load/i)).not.toBeInTheDocument();
  });

  it("reports a missing target position instead of an empty value", async () => {
    mockedMe.mockResolvedValue(account);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <IdentityCard targetPosition={null} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Not provided")).toBeInTheDocument();
  });
});

describe("IdentitySection", () => {
  beforeEach(() => {
    mockedMe.mockReset();
    mockedUpdateProfile.mockReset();
    mockedUpdateTargetPosition.mockReset();
    useAuthStore.getState().clearAuth();
  });

  it("prefills the form with an editable target position and a read-only email", async () => {
    mockedMe.mockResolvedValue(account);
    renderSection();

    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace");
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 555 000 0000");
    expect(screen.getByLabelText("Current city")).toHaveValue("Paris");
    expect(screen.getByLabelText("Target position")).toHaveValue("Staff Engineer");
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("blocks the save while a required field is empty", async () => {
    mockedMe.mockResolvedValue(account);
    renderSection();

    const firstName = await screen.findByLabelText("First name");
    fireEvent.change(firstName, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
    expect(mockedUpdateTargetPosition).not.toHaveBeenCalled();
  });

  it("saves the account fields and the target position, then confirms the section", async () => {
    mockedMe.mockResolvedValue(account);
    mockedUpdateProfile.mockResolvedValue({ ...account, firstName: "Augusta Ada" });
    mockedUpdateTargetPosition.mockResolvedValue(undefined);
    renderSection();

    const firstName = await screen.findByLabelText("First name");
    fireEvent.change(firstName, { target: { value: "Augusta Ada" } });
    const targetPosition = await screen.findByLabelText("Target position");
    fireEvent.change(targetPosition, { target: { value: "Principal Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Section saved")).toBeInTheDocument();
    expect(mockedUpdateProfile).toHaveBeenCalledWith({
      firstName: "Augusta Ada",
      lastName: "Lovelace",
      phone: "+1 555 000 0000",
      currentCity: "Paris",
      currentCountry: "FR",
    });
    expect(mockedUpdateTargetPosition).toHaveBeenCalledWith("Principal Engineer");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled(),
    );
  });

  it("shows the server message when the save fails", async () => {
    mockedMe.mockResolvedValue(account);
    mockedUpdateProfile.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        isAxiosError: true,
        response: { data: { title: "Update failed", detail: "This phone number is not allowed." } },
      }),
    );
    renderSection();

    const city = await screen.findByLabelText("Current city");
    fireEvent.change(city, { target: { value: "Lyon" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Could not save this section")).toBeInTheDocument();
    expect(screen.getByText("This phone number is not allowed.")).toBeInTheDocument();
  });

  it("discards local edits and restores the account values", async () => {
    mockedMe.mockResolvedValue(account);
    renderSection();

    const city = await screen.findByLabelText("Current city");
    fireEvent.change(city, { target: { value: "Lyon" } });
    const targetPosition = await screen.findByLabelText("Target position");
    fireEvent.change(targetPosition, { target: { value: "Principal Engineer" } });
    expect(screen.getByRole("button", { name: /discard/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /discard/i }));

    expect(screen.getByLabelText("Current city")).toHaveValue("Paris");
    expect(screen.getByLabelText("Target position")).toHaveValue("Staff Engineer");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("keeps the photo badge unavailable", async () => {
    mockedMe.mockResolvedValue(account);
    renderSection();

    const badge = await screen.findByRole("button", { name: "Change photo" });
    expect(badge).toBeDisabled();
    expect(badge).toHaveAttribute("aria-disabled", "true");
    expect(badge).toHaveAttribute("title", "Coming soon");
  });
});
