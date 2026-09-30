const {
  findAccountByToken,
  normalizeRceAccounts,
  applyAccountDevices,
  removeAccount,
  publicAccount,
} = require("../../public/rce-accounts");

// Stand-in for safeStorage: "enc:<token>" decrypts to <token>.
const unseal = (t) => (t && t.startsWith("enc:") ? t.slice(4) : t || "");
const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

const rce = (id, deviceId, token, extra = {}) => ({ id, type: "rce", name: `Dev ${deviceId}`, deviceId, token, apiUrl: "", ...extra });

describe("normalizeRceAccounts (settings from older builds)", () => {
  test("a single existing token becomes one account labelled Default, devices stay chosen", () => {
    const settings = { streams: { sources: [rce("rce-a", 1, "enc:tok1111"), rce("rce-b", 2, "enc:tok1111")] } };
    expect(normalizeRceAccounts(settings, { unseal, newId: ids() })).toBe(true);
    expect(settings.rce.accounts).toEqual([{ id: "id1", label: "Default", token: "enc:tok1111", tail: "1111" }]);
    expect(settings.streams.sources.map((s) => s.accountId)).toEqual(["id1", "id1"]);
    expect(settings.streams.sources.every((s) => s.chosen === undefined)).toBe(true);
    // Each source keeps its own token copy, so an older build can still stream it.
    expect(settings.streams.sources.map((s) => s.token)).toEqual(["enc:tok1111", "enc:tok1111"]);
  });

  test("distinct tokens become separate accounts", () => {
    const settings = { streams: { sources: [rce("a", 1, "enc:aaaa"), rce("b", 2, "enc:bbbb"), { id: "s", type: "sim" }] } };
    normalizeRceAccounts(settings, { unseal, newId: ids() });
    expect(settings.rce.accounts.map((a) => a.label)).toEqual(["Default", "Account 2"]);
    expect(settings.streams.sources[2].accountId).toBeUndefined();
  });

  test("is idempotent", () => {
    const settings = { streams: { sources: [rce("a", 1, "enc:aaaa")] } };
    normalizeRceAccounts(settings, { unseal, newId: ids() });
    const snapshot = JSON.stringify(settings);
    expect(normalizeRceAccounts(settings, { unseal, newId: ids() })).toBe(false);
    expect(JSON.stringify(settings)).toBe(snapshot);
  });
});

describe("duplicate token rejection", () => {
  const accounts = [{ id: "a1", label: "Personal", token: "enc:secret-token-c3f9" }];
  test("finds an account with the same token, ignoring surrounding spaces", () => {
    expect(findAccountByToken(accounts, "  secret-token-c3f9 ", unseal)?.id).toBe("a1");
  });
  test("a different token is not a duplicate", () => {
    expect(findAccountByToken(accounts, "other-token", unseal)).toBeNull();
  });
});

describe("account device listing", () => {
  const account = { id: "a1", label: "Work", token: "enc:t" };
  test("adds new devices unchosen, refreshes status, drops devices no longer on the account", () => {
    const sources = [rce("keep", 1, "enc:t", { accountId: "a1", status: "shutdown" }), rce("gone", 2, "enc:t", { accountId: "a1" }), rce("other", 9, "enc:x", { accountId: "a2" })];
    const res = applyAccountDevices(sources, account, [{ id: 1, name: "Dev 1", status: "running" }, { id: 3, name: "New", status: "shutdown" }], ids());
    expect(res.removedIds).toEqual(["gone"]);
    expect(res.addedCount).toBe(1);
    expect(res.sources.find((s) => s.id === "keep").status).toBe("running");
    expect(res.sources.find((s) => s.name === "New")).toMatchObject({ accountId: "a1", chosen: false, deviceId: 3, token: "enc:t" });
    expect(res.sources.find((s) => s.id === "other")).toBe(sources[2]);
  });

  test("names follow the account unless renamed; names saved by older builds are kept", () => {
    const sources = [
      rce("same", 1, "enc:t", { accountId: "a1", name: "Old", deviceName: "Old" }),
      rce("renamed", 2, "enc:t", { accountId: "a1", name: "Mine", deviceName: "Old" }),
      rce("legacy", 3, "enc:t", { accountId: "a1", name: "Custom" }),
    ];
    const listing = [1, 2, 3].map((id) => ({ id, name: "New", status: "running" }));
    const res = applyAccountDevices(sources, account, listing, ids());
    expect(res.sources.map((s) => [s.name, s.deviceName])).toEqual([
      ["New", "New"],
      ["Mine", "New"],
      ["Custom", "New"],
    ]);
  });

  test("removing an account removes only its devices", () => {
    const settings = {
      rce: { accounts: [account, { id: "a2", label: "Personal", token: "enc:x" }] },
      streams: { sources: [rce("w1", 1, "enc:t", { accountId: "a1" }), rce("p1", 2, "enc:x", { accountId: "a2" })] },
    };
    expect(removeAccount(settings, "a1")).toEqual(["w1"]);
    expect(settings.streams.sources.map((s) => s.id)).toEqual(["p1"]);
    expect(settings.rce.accounts.map((a) => a.id)).toEqual(["a2"]);
  });

  test("the public view never carries the token", () => {
    expect(publicAccount({ id: "a1", label: "Work", token: "enc:t", tail: "c3f9" })).toEqual({ id: "a1", label: "Work", tail: "c3f9" });
  });
});
