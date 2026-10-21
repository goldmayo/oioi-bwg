import assert from "node:assert/strict";

export async function assertWebSignupClosed(origin, sql) {
  // The caller only supplies its isolated PostgreSQL fixture, never a restored/operating DB.
  const [challenge] = await sql`insert into email_verification_challenge
    (email, otp_hash, status, ip_address, expires_at, last_sent_at, verified_at)
    values ('closed@p06.example.test', 'unused-fixture-hash', 'VERIFIED', '127.0.0.1',
      now() + interval '5 minutes', now(), now()) returning id`;
  const snapshot = async () => {
    const counts = await sql`select (select count(*) from account) as accounts,
      (select count(*) from password_credential) as credentials,
      (select count(*) from profile) as profiles,
      (select count(*) from email_verification_challenge) as challenges,
      (select count(*) from email_verification_rate_limit) as limits`;
    const rows = await sql`select * from email_verification_challenge where id = ${challenge.id}`;
    return JSON.stringify({ counts, rows });
  };
  try {
    const before = await snapshot();
    for (const [route, body] of [
      ["otp", { email: "closed@p06.example.test" }],
      ["otp/verify", { challengeId: challenge.id, otp: "123456" }],
      [
        "complete",
        { challengeId: challenge.id, password: "P06-fixture-pass1!", nickname: "closed-signup" },
      ],
    ]) {
      for (const input of [JSON.stringify(body), "{malformed"]) {
        const response = await fetch(`${origin}/api/auth/signup/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: input,
        });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal((await response.json()).code, "FORBIDDEN");
      }
    }
    assert.equal(
      await snapshot(),
      before,
      "closed signup must not consume proof or change account/OTP state",
    );
    assert.equal((await fetch(`${origin}/signup`)).status, 404);
    console.log(
      "Web signup closed: direct POST and verified-proof replay rejected; account/OTP state unchanged",
    );
  } finally {
    await sql`delete from email_verification_challenge where id = ${challenge.id}`;
  }
}
