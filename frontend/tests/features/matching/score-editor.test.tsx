import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ScoreEditor } from "@/features/matching/score-editor";

function Harness({
  initial = "",
  aiScore = 80,
  onRemove = vi.fn(),
}: {
  initial?: string;
  aiScore?: number;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <ScoreEditor
      label="Java"
      aiScore={aiScore}
      value={value}
      name="score"
      onChange={setValue}
      onRemove={() => {
        onRemove();
        setValue("");
      }}
    />
  );
}

const score = () => screen.getByRole("spinbutton", { name: "Your score for Java" });
const slider = () => screen.getByRole("slider", { name: "Adjust your score for Java" });
const increase = () => fireEvent.click(screen.getByRole("button", { name: "Increase your score for Java" }));
const decrease = () => fireEvent.click(screen.getByRole("button", { name: "Decrease your score for Java" }));

describe("ScoreEditor", () => {
  it("anchors the empty slider on the AI score and creates a value only on a gesture", () => {
    render(<Harness />);

    expect(score()).toHaveValue(null);
    expect(slider()).toHaveValue("80");

    increase();
    expect(score()).toHaveValue(81);
    expect(slider()).toHaveValue("81");

    decrease();
    decrease();
    expect(score()).toHaveValue(79);
    expect(slider()).toHaveValue("79");
  });

  it("keeps the numeric input and the slider in sync", () => {
    render(<Harness />);

    fireEvent.change(slider(), { target: { value: "40" } });
    expect(score()).toHaveValue(40);

    fireEvent.change(score(), { target: { value: "95" } });
    expect(slider()).toHaveValue("95");
  });

  it("clamps the stepper to 0 and 100", () => {
    const { unmount } = render(<Harness initial="100" />);
    increase();
    expect(score()).toHaveValue(100);
    unmount();

    render(<Harness initial="0" />);
    decrease();
    expect(score()).toHaveValue(0);
  });

  it("clears the score, then cancels the empty editor", () => {
    const onRemove = vi.fn();
    render(<Harness initial="50" onRemove={onRemove} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear your score for Java" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(score()).toHaveValue(null);
    expect(slider()).toHaveValue("80");

    fireEvent.click(screen.getByRole("button", { name: "Cancel editing your score for Java" }));
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
