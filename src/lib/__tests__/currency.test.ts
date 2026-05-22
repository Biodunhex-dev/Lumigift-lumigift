import { formatNGN, formatUSDC } from "@/lib/currency";

describe("currency formatters", () => {
  describe("formatNGN", () => {
    it.each([
      [0, "₦0.00"],
      [1000, "₦1,000.00"],
      [-2500.5, "-₦2,500.50"],
      [1234567890.12, "₦1,234,567,890.12"],
      ["5000", "₦5,000.00"],
    ])("formats %p as %s", (amount, expected) => {
      expect(formatNGN(amount)).toBe(expected);
    });
  });

  describe("formatUSDC", () => {
    it.each([
      [0, "0.00 USDC"],
      [1, "1.00 USDC"],
      ["3.0000000", "3.00 USDC"],
      [-12.345, "-12.35 USDC"],
      [1234567890.12, "1,234,567,890.12 USDC"],
    ])("formats %p as %s", (amount, expected) => {
      expect(formatUSDC(amount)).toBe(expected);
    });
  });

  it("rejects non-finite amounts", () => {
    expect(() => formatNGN(Number.NaN)).toThrow(TypeError);
    expect(() => formatUSDC("not-a-number")).toThrow(TypeError);
  });
});
