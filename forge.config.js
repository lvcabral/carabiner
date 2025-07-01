require("dotenv").config();

module.exports = {
  packagerConfig: {
    name: "Carabiner",
    icon: "./images/icon",
    asar: true,
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
        draft: true,
      },
    },
  ],
};
