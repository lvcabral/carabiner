/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// Roku Cloud Emulator accounts (settings.rce.accounts[]). Pure helpers, no Electron, so they
// can be unit tested; main.js supplies the token unseal function.
//
// Settings compatibility: accounts are purely additive. Every RCE stream source keeps its own
// sealed copy of its account's token (as older builds expect) and just gains an `accountId`,
// so a settings file written by this build still streams in an older one, and one written by an
// older build is turned into accounts by normalizeRceAccounts() on the next launch.

const tokenTail = (token) => String(token || "").slice(-4);

// Public (renderer-safe) view of an account: never the token.
const publicAccount = ({ token, ...rest }) => rest;

// Label for the Nth account when the user gives none: the first is "Default".
const defaultAccountLabel = (existingCount) => (existingCount === 0 ? "Default" : `Account ${existingCount + 1}`);

function findAccountByToken(accounts, token, unseal) {
  const plain = String(token || "").trim();
  if (!plain) return null;
  return (accounts || []).find((a) => unseal(a.token) === plain) || null;
}

// Give every RCE source an account, creating one per distinct token (the first labelled
// "Default"). Idempotent: sources that already point at an existing account are left alone.
// Returns true when settings changed.
function normalizeRceAccounts(settings, { unseal, newId }) {
  const sources = settings?.streams?.sources || [];
  if (!settings.rce || typeof settings.rce !== "object") settings.rce = {};
  if (!Array.isArray(settings.rce.accounts)) settings.rce.accounts = [];
  const accounts = settings.rce.accounts;
  let changed = false;
  for (const src of sources) {
    if (src.type !== "rce") continue;
    if (src.accountId && accounts.some((a) => a.id === src.accountId)) continue;
    const plain = unseal(src.token);
    let account = plain ? findAccountByToken(accounts, plain, unseal) : null;
    if (!account) {
      account = {
        id: newId(),
        label: defaultAccountLabel(accounts.length),
        token: src.token || "",
        tail: tokenTail(plain),
        ...(src.apiUrl ? { apiUrl: src.apiUrl } : {}),
      };
      accounts.push(account);
    }
    src.accountId = account.id;
    changed = true;
  }
  return changed;
}

// Merge an account's current device listing into the stream-source catalog: known devices get
// their name/status refreshed, new ones are added unchosen, and devices no longer on the account
// are dropped. Returns { sources, removedIds, addedCount }.
function applyAccountDevices(sources, account, devices, newId) {
  const listed = new Map((devices || []).map((d) => [String(d.id), d]));
  const removedIds = [];
  const next = [];
  for (const src of sources || []) {
    if (src.type !== "rce" || src.accountId !== account.id) {
      next.push(src);
      continue;
    }
    const d = listed.get(String(src.deviceId));
    if (!d) {
      removedIds.push(src.id);
      continue;
    }
    listed.delete(String(src.deviceId));
    // A source that was never renamed follows the device's name on the account. (One saved by
    // an older build has no deviceName yet, so its name is kept: it may have been customized.)
    const deviceName = d.name || `Device ${d.id}`;
    const followName = !!src.deviceName && src.name === src.deviceName;
    next.push({ ...src, status: d.status, token: account.token, deviceName, ...(followName ? { name: deviceName } : {}) });
  }
  let addedCount = 0;
  for (const d of listed.values()) {
    next.push({
      id: newId(),
      type: "rce",
      name: d.name || `Device ${d.id}`,
      deviceName: d.name || `Device ${d.id}`,
      deviceId: Number(d.id),
      token: account.token,
      apiUrl: account.apiUrl || "",
      accountId: account.id,
      status: d.status,
      chosen: false,
    });
    addedCount++;
  }
  return { sources: next, removedIds, addedCount };
}

// Remove an account and every source that belongs to it. Returns the removed source ids.
function removeAccount(settings, accountId) {
  const sources = settings?.streams?.sources || [];
  const removedIds = sources.filter((s) => s.type === "rce" && s.accountId === accountId).map((s) => s.id);
  settings.streams = { ...(settings.streams || {}), sources: sources.filter((s) => !removedIds.includes(s.id)) };
  settings.rce = { ...(settings.rce || {}), accounts: (settings.rce?.accounts || []).filter((a) => a.id !== accountId) };
  return removedIds;
}

module.exports = {
  tokenTail,
  publicAccount,
  defaultAccountLabel,
  findAccountByToken,
  normalizeRceAccounts,
  applyAccountDevices,
  removeAccount,
};
