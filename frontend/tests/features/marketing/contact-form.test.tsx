import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ContactForm } from "@/features/marketing/contact-form";

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Lovelace" } });
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "ada@acme.com" },
  });
  fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme" } });
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: "21 - 100 employees (Series A-B)" }));
  fireEvent.click(screen.getByLabelText(/I agree to LinQOrbit/));
};

describe("ContactForm", () => {
  it("affiche les erreurs de validation à la soumission vide", async () => {
    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: /Send Message/ }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Work email is required")).toBeInTheDocument();
    expect(screen.getByText("Company name is required")).toBeInTheDocument();
    expect(screen.getByText("Please select a team size")).toBeInTheDocument();
    expect(
      screen.getByText("You must accept the privacy policy to continue"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Thank you!/)).toBeNull();
  });

  it("bascule les centres d'intérêt sélectionnés", () => {
    render(<ContactForm />);

    const pill = screen.getByRole("button", { name: "Enterprise Demo" });
    expect(pill).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(pill);
    expect(pill).toHaveAttribute("aria-pressed", "false");
  });

  it("affiche un message de succès après une soumission valide", async () => {
    render(<ContactForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: /Send Message/ }));

    expect(
      await screen.findByText(/Thank you! We'll get back to you within two business days\./),
    ).toBeInTheDocument();
    expect(screen.queryByText("First name is required")).toBeNull();
  });
});
