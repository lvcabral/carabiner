require("dotenv").config();

module.exports = {
  packagerConfig: {
    name: "Carabiner",
    icon: "./images/icon",
    asar: true,
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
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
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
