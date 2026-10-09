require("dotenv").config();

const fs = require("fs");
const path = require("path");

// Only these paths (relative to the project root, "/"-separated) go into the
// packaged app. Everything else (.env, .claude/, .mcp.json, docs/, src/, scripts/,
// forge.config.js...) is left out. node_modules is pruned to production
// dependencies by the packager.
const PACKAGE_ALLOWLIST = [
  /^\/package\.json$/,
  /^\/public(\/|$)/, // main process + Display window
  /^\/build(\/|$)/, // compiled Settings app (Vite)
  /^\/images$/,
  /^\/images\/(menuicon\.png|icon\.ico)$/, // tray icons (menu.js)
  /^\/node_modules(\/|$)/,
];

function ignoreNotAllowed(file) {
  if (!file) return false; // the project root itself
  return !PACKAGE_ALLOWLIST.some((re) => re.test(file));
}

// Names that must never ship, even if the allowlist is widened by mistake.
const FORBIDDEN_FILES = [
  /^\.env(\..*)?$/,
  /^\.mcp\.json$/,
  /^settings\.local\.json$/,
  /\.(pem|p12|p8|key|cer|mobileprovision|provisionprofile)$/i,
];

function findForbiddenFiles(dir, root = dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === root && entry.name.startsWith(".")) found.push(entry.name); // .claude, .github...
      else findForbiddenFiles(full, root, found);
    } else if (FORBIDDEN_FILES.some((re) => re.test(entry.name))) {
      found.push(path.relative(root, full));
    }
  }
  return found;
}

module.exports = {
  packagerConfig: {
    name: "Carabiner",
    icon: "./images/icon",
    asar: true,
    // Dot-entries in node_modules (.bin, .cache, .vite, .package-lock.json...) are
    // build tooling and caches, never read at runtime.
    ignore: (file) => ignoreNotAllowed(file) || /^\/node_modules\/\./.test(file),
    appBundleId: "com.lvcabral.carabiner",
    appCategoryType: "public.app-category.utilities",
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
  rebuildConfig: {},
  hooks: {
    // Fail the build before the asar is written if a secret slipped in.
    packageAfterCopy: async (_config, buildPath) => {
      const found = findForbiddenFiles(buildPath);
      if (found.length) {
        throw new Error(`Refusing to package sensitive files:\n  ${found.join("\n  ")}`);
      }
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        setupIcon: "./images/icon.ico",
      },
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        icon: "./images/icon.icns",
        background: "./images/dmg-background.png",
        format: "ULFO",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
      config: {
        // Enable auto-update metadata generation for macOS
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        icon: "./images/icon.png",
        categories: ['Utility'],
        // packagerConfig.name is "Carabiner", so the Linux executable is capitalized;
        // electron-installer-debian defaults to package.json's lowercase name.
        bin: "Carabiner",
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        icon: "./images/icon.png",
        categories: ['Utility'],
        // packagerConfig.name is "Carabiner", so the Linux executable is capitalized;
        // electron-installer-debian defaults to package.json's lowercase name.
        bin: "Carabiner",
      },
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "lvcabral",
          name: "carabiner",
        },
        prerelease: false,
        draft: false, // Changed from true to false for auto-updates to work
        generateReleaseNotes: true,
      },
    },
  ],
};
