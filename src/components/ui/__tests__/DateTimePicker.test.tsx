import { render, screen, waitFor } from "@testing-library/react";
import { DateTimePicker } from "../DateTimePicker";

describe("DateTimePicker", () => {
  it("renders the date/time field and shows local timezone details", async () => {
    render(<DateTimePicker label="Unlock Date & Time" id="unlockAt" name="unlockAt" />);

    const input = screen.getByLabelText(/unlock date & time/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "datetime-local");

    await waitFor(() => {
      expect(input).toHaveAttribute("min");
      const min = input.getAttribute("min");
      expect(min).toBeTruthy();
      if (min) {
        const minDate = new Date(min);
        expect(minDate.getTime()).toBeGreaterThanOrEqual(Date.now() + 59 * 60 * 1000);
      }
    });

    expect(screen.getByText(/your local timezone:/i)).toBeInTheDocument();
  });
});
