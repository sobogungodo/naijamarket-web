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
