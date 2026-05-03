import { sanitizeMessage, stripHtmlTags } from "../sanitize";

describe("sanitizeMessage", () => {
  it("should return undefined for undefined input", () => {
    expect(sanitizeMessage(undefined)).toBeUndefined();
  });

  it("should return empty string for empty input", () => {
    expect(sanitizeMessage("")).toBe("");
  });

  it("should encode HTML special characters", () => {
    const input = '<script>alert("XSS")</script>';
    const expected = "&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;";
    expect(sanitizeMessage(input)).toBe(expected);
  });

  it("should encode ampersand", () => {
    expect(sanitizeMessage("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("should encode less than and greater than", () => {
    expect(sanitizeMessage("5 < 10 > 3")).toBe("5 &lt; 10 &gt; 3");
  });

  it("should encode double quotes", () => {
    expect(sanitizeMessage('He said "hello"')).toBe("He said &quot;hello&quot;");
  });

  it("should encode single quotes", () => {
    expect(sanitizeMessage("It's working")).toBe("It&#x27;s working");
  });

  it("should encode forward slash", () => {
    expect(sanitizeMessage("</script>")).toBe("&lt;&#x2F;script&gt;");
  });

  it("should handle plain text without changes", () => {
    expect(sanitizeMessage("Hello, this is a gift message!")).toBe(
      "Hello, this is a gift message!"
    );
  });

  it("should handle complex XSS payload", () => {
    const input = '<img src=x onerror="alert(1)">';
    const expected = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;";
    expect(sanitizeMessage(input)).toBe(expected);
  });

  it("should handle javascript protocol", () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const expected = "&lt;a href=&quot;javascript:alert(1)&quot;&gt;click&lt;&#x2F;a&gt;";
    expect(sanitizeMessage(input)).toBe(expected);
  });
});

describe("stripHtmlTags", () => {
  it("should return undefined for undefined input", () => {
    expect(stripHtmlTags(undefined)).toBeUndefined();
  });

  it("should return empty string for empty input", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("should strip script tags", () => {
    expect(stripHtmlTags("<script>alert('XSS')</script>Hello")).toBe("Hello");
  });

  it("should strip all HTML tags", () => {
    expect(stripHtmlTags("<p>Hello <b>World</b></p>")).toBe("Hello World");
  });

  it("should handle nested tags", () => {
    expect(stripHtmlTags("<div><span><strong>Test</strong></span></div>")).toBe("Test");
  });

  it("should handle self-closing tags", () => {
    expect(stripHtmlTags("Hello<br/>World")).toBe("HelloWorld");
  });

  it("should handle attributes in tags", () => {
    expect(
      stripHtmlTags('<a href="https://example.com" onclick="evil()">Link</a>')
    ).toBe("Link");
  });

  it("should preserve plain text", () => {
    expect(stripHtmlTags("Just plain text")).toBe("Just plain text");
  });

  it("should handle malformed HTML", () => {
    expect(stripHtmlTags("<div>Unclosed tag")).toBe("Unclosed tag");
  });
});
