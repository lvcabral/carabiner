import {
  RCE_MISSING,
  mergeWindowSources,
  findAccountByToken,
  normalizeRceAccounts,
  applyAccountDevices,
  renameAccount,
  removeAccount,
  publicAccount,
} from "../../public/rce-accounts";
import { RCE_MISSING as UI_RCE_MISSING } from "../components/devices/devicesModel";

test("the settings UI uses the same 'missing' status as main", () => {
  expect(UI_RCE_MISSING).toBe(RCE_MISSING);
});

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

  test("a token that can't be decrypted right now is left for the next launch", () => {
    const locked = () => "";
    const settings = { streams: { sources: [rce("a", 1, "enc:aaaa"), rce("b", 2, "enc:aaaa")] } };
    expect(normalizeRceAccounts(settings, { unseal: locked, newId: ids() })).toBe(false);
    expect(settings.rce.accounts).toEqual([]);
    expect(settings.streams.sources.every((s) => !s.accountId)).toBe(true);
  });

  test("is idempotent", () => {
    const settings = { streams: { sources: [rce("a", 1, "enc:aaaa")] } };
    normalizeRceAccounts(settings, { unseal, newId: ids() });
    const snapshot = JSON.stringify(settings);
    expect(normalizeRceAccounts(settings, { unseal, newId: ids() })).toBe(false);
    expect(JSON.stringify(settings)).toBe(snapshot);
  });
});

describe("stream sources sent by the settings window", () => {
  const stored = [
    rce("r1", 1, "enc:t", { accountId: "a1", status: "running", name: "Box" }),
    rce("r2", 2, "enc:t", { accountId: "a1", status: "running" }), // just added by a refresh
    { id: "s1", type: "sim", name: "Sim", host: "localhost", port: 8090 },
  ];

  test("a stale list can't drop, resurrect or roll back Cloud Emulator devices", () => {
    const stale = [
      { id: "r1", type: "rce", name: "Renamed", status: "shutdown", hasToken: true, chosen: false }, // old status
      { id: "gone", type: "rce", name: "Removed by refresh", hasToken: true },
      { id: "s1", type: "sim", name: "Sim", host: "localhost", port: 8090, hasToken: false },
    ];
    const merged = mergeWindowSources(stored, stale);
    expect(merged.map((s) => s.id).sort()).toEqual(["r1", "r2", "s1"]);
    const r1 = merged.find((s) => s.id === "r1");
    expect(r1).toMatchObject({ name: "Renamed", chosen: false, status: "running", token: "enc:t", accountId: "a1" });
    expect(merged.every((s) => !("hasToken" in s))).toBe(true);
  });

  test("the window can remove a device that is missing from its account, but not one still on it", () => {
    const withMissing = [...stored, rce("m1", 3, "enc:t", { accountId: "a1", status: RCE_MISSING })];
    const sent = [{ id: "s1", type: "sim", name: "Sim", host: "localhost", port: 8090 }]; // r1, r2, m1 left out
    expect(mergeWindowSources(withMissing, sent).map((s) => s.id).sort()).toEqual(["r1", "r2", "s1"]);
  });

  test("tokens sent by the window are ignored; every source keeps its stored token", () => {
    const merged = mergeWindowSources(
      [stored[0], { id: "w", type: "webrtc", url: "http://x", token: "kept" }],
      [
        { id: "r1", type: "rce", name: "Box", token: "plain-from-window" },
        { id: "w", type: "webrtc", url: "http://x", token: "plain-from-window" },
        { id: "w2", type: "webrtc", url: "http://y", token: "plain-from-window" },
      ]
    );
    expect(merged.map((s) => [s.id, s.token])).toEqual([
      ["r1", "enc:t"],
      ["w", "kept"],
      ["w2", ""],
    ]);
  });

  test("re-checking a device clears its chosen flag; other sources keep their stored token", () => {
    const merged = mergeWindowSources([{ ...stored[0], chosen: false }, { id: "w", type: "webrtc", url: "http://x", token: "" }], [
      { id: "r1", type: "rce", name: "Box" },
      { id: "w", type: "webrtc", url: "http://x" },
    ]);
    expect("chosen" in merged.find((s) => s.id === "r1")).toBe(false);
    expect(merged.find((s) => s.id === "w").token).toBe("");
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
  test("adds new devices unchosen, refreshes status, keeps devices no longer on the account as missing", () => {
    const sources = [rce("keep", 1, "enc:t", { accountId: "a1", status: "shutdown" }), rce("gone", 2, "enc:t", { accountId: "a1", name: "Mine", chosen: false }), rce("other", 9, "enc:x", { accountId: "a2" })];
    const res = applyAccountDevices(sources, account, [{ id: 1, name: "Dev 1", status: "running" }, { id: 3, name: "New", status: "shutdown" }], ids());
    expect(res.missingIds).toEqual(["gone"]);
    expect(res.addedCount).toBe(1);
    expect(res.sources.find((s) => s.id === "keep").status).toBe("running");
    // Kept (so its pair and window settings survive) with its name and chosen flag untouched.
    expect(res.sources.find((s) => s.id === "gone")).toMatchObject({ status: RCE_MISSING, name: "Mine", chosen: false, deviceId: 2 });
    expect(res.sources.find((s) => s.name === "New")).toMatchObject({ accountId: "a1", chosen: false, deviceId: 3, token: "enc:t" });
    expect(res.sources.find((s) => s.id === "other")).toBe(sources[2]);
  });

  test("a missing device that is listed again comes back as the same source", () => {
    const sources = [rce("dev", 4, "enc:t", { accountId: "a1", status: RCE_MISSING })];
    const res = applyAccountDevices(sources, account, [{ id: 4, name: "Dev 4", status: "running" }], ids());
    expect(res.sources).toHaveLength(1);
    expect(res.sources[0]).toMatchObject({ id: "dev", status: "running" });
    expect(res.missingIds).toEqual([]);
    expect(res.addedCount).toBe(0);
  });

  test("an empty listing marks every device missing instead of removing it", () => {
    const sources = [rce("a", 1, "enc:t", { accountId: "a1" }), rce("b", 2, "enc:t", { accountId: "a1" })];
    const res = applyAccountDevices(sources, account, [], ids());
    expect(res.sources.map((s) => [s.id, s.status])).toEqual([
      ["a", RCE_MISSING],
      ["b", RCE_MISSING],
    ]);
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

  test("renaming an account changes only its label; an empty name or unknown account is refused", () => {
    const settings = { rce: { accounts: [{ ...account }, { id: "a2", label: "Personal", token: "enc:x" }] } };
    expect(renameAccount(settings, "a1", "  Staging ")).toMatchObject({ id: "a1", label: "Staging", token: "enc:t" });
    expect(settings.rce.accounts.map((a) => a.label)).toEqual(["Staging", "Personal"]);
    expect(renameAccount(settings, "a1", "   ")).toBeNull();
    expect(renameAccount(settings, "nope", "X")).toBeNull();
    expect(settings.rce.accounts[0].label).toBe("Staging");
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
