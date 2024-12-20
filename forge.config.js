require('dotenv').config();

module.exports = {
  packagerConfig: {
    name: 'carabiner',
    productName: "Carabiner",
    icon: './images/icon',
    asar: true,
    osxSign: {},
    osxNotarize: {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        setupIcon: "./images/icon.ico"
      },
    },
    {
      name: '@electron-forge/maker-zip',
      config: {
        icon: './images/icon.icns',
        arch: ['x64', "arm64"],
      },
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        icon: './images/icon.png'
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
};
