import { describe, it, expect } from "vitest";
import { interpolateVariables } from "@replyza/shared";

describe("Variable Interpolation Engine", () => {
  it("interpolates first_name, username, keyword, and link correctly", () => {
    const template =
      "Hey {{first_name}} (@{{username}})! Thanks for commenting {{keyword}}. Get it here: {{link}}";
    const result = interpolateVariables(template, {
      firstName: "Sarah",
      username: "sarah_travels",
      keyword: "GUIDE",
      link: "https://example.com/guide.pdf",
    });

    expect(result).toBe(
      "Hey Sarah (@sarah_travels)! Thanks for commenting GUIDE. Get it here: https://example.com/guide.pdf"
    );
  });

  it("handles case-insensitivity and whitespace inside curly braces", () => {
    const template = "Hi {{ FIRST_NAME }}, check {{ Link }} for {{   KEYWORD   }}";
    const result = interpolateVariables(template, {
      firstName: "Dave",
      keyword: "DISCOUNT",
      link: "https://shop.com/deal",
    });

    expect(result).toBe("Hi Dave, check https://shop.com/deal for DISCOUNT");
  });

  it("gracefully falls back when firstName is null, empty, or whitespace", () => {
    const template = "Hello {{first_name}}!";

    // Null firstName with username
    expect(
      interpolateVariables(template, {
        firstName: null,
        username: "johndoe",
      })
    ).toBe("Hello @johndoe!");

    // Empty firstName without username
    expect(
      interpolateVariables(template, {
        firstName: "  ",
        username: null,
      })
    ).toBe("Hello there!");
  });

  it("handles empty template strings and missing variables safely", () => {
    expect(interpolateVariables("", {})).toBe("");
    expect(interpolateVariables("No variables here", {})).toBe("No variables here");
    expect(
      interpolateVariables("Link: {{link}}, Key: {{keyword}}", {})
    ).toBe("Link: , Key: ");
  });
});
