import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("focuses a focusable child and closes on Escape", () => {
    const onClose = jest.fn();
    render(
      <Modal title="Test dialog" onClose={onClose}>
        <button type="button">Confirm</button>
      </Modal>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape", keyCode: 27 });
    expect(onClose).toHaveBeenCalled();
  });
});
