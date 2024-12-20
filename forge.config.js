module.exports = {
  packagerConfig: {
    name: 'carabiner',
    productName: "Carabiner",
    icon: './images/icon',
    asar: true
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
        icon: './images/icon.icns'
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
