import { checkCronAuth } from "../cron-auth";

const h = (auth?: string) => new Headers(auth ? { authorization: auth } : {});

test("rejects when secret is unset (fail-closed)", () => {
  expect(checkCronAuth(h("Bearer x"), undefined)).toMatchObject({ ok: false, status: 401 });
});
test("rejects when header missing", () => {
  expect(checkCronAuth(h(), "s3cret")).toMatchObject({ ok: false, status: 401 });
});
test("rejects on wrong token", () => {
  expect(checkCronAuth(h("Bearer nope"), "s3cret")).toMatchObject({ ok: false, status: 401 });
});
test("accepts correct bearer", () => {
  expect(checkCronAuth(h("Bearer s3cret"), "s3cret")).toEqual({ ok: true, status: 200 });
});
test("fail-closed is the documented contract", () => {
  // guards against a future regression to fail-open
  const { checkCronAuth } = require("../cron-auth");
  expect(checkCronAuth(new Headers({ authorization: "Bearer anything" }), "").ok).toBe(false);
});
