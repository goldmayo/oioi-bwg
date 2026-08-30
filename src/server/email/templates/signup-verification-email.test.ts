import { describe, expect, it } from "vitest";

import { createSignupVerificationEmail } from "./signup-verification-email";

describe("createSignupVerificationEmail", () => {
  it("creates an OTP email with a plain-text fallback", () => {
    const email = createSignupVerificationEmail("123456");

    expect(email.subject).toBe("[어이어이 바위게] 이메일 인증 코드");
    expect(email.text).toContain("123456");
    expect(email.text).toContain("5분");
  });

  it("uses a table layout and inline CSS without unsupported layout primitives", () => {
    const { html } = createSignupVerificationEmail("123456");

    expect(html).toContain('role="presentation"');
    expect(html).toContain('style="');
    expect(html).not.toContain("<style");
    expect(html).not.toContain("display:flex");
    expect(html).not.toContain("display:grid");
    expect(html).not.toContain("@media");
  });

  it("escapes dynamic HTML content", () => {
    const { html } = createSignupVerificationEmail('<img src=x onerror="alert(1)">');

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
  });
});
