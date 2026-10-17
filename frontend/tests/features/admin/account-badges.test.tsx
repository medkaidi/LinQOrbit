import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountBadges } from "@/features/admin/account-badges";
import { ROLE } from "@/lib/utils/roles";
import type { AdminUser } from "@/types/admin";

const account: AdminUser = {
  id: "u1",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "ACTIVE",
  roles: [],
  hasCandidateProfile: false,
  hasRecruiterProfile: false,
};

describe("AccountBadges", () => {
  it("renders nothing for a plain account", () => {
    const { container } = render(<AccountBadges account={account} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Admin, Candidate and Recruiter in that order", () => {
    const { container } = render(
      <AccountBadges
        account={{
          ...account,
          roles: [ROLE.ADMIN],
          hasCandidateProfile: true,
          hasRecruiterProfile: true,
        }}
      />,
    );
    expect(container).toHaveTextContent("AdminCandidateRecruiter");
  });

  it("renders each capability on its own", () => {
    render(<AccountBadges account={{ ...account, hasRecruiterProfile: true }} />);
    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidate")).not.toBeInTheDocument();
  });
});
