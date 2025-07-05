#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const packageJson = require("../package.json");

/**
 * Upload YML metadata files to GitHub release
 * This script uploads the generated YML files to the GitHub release
 * so that electron-updater can find them for auto-updates.
 */

function uploadToRelease() {
  const version = packageJson.version;
  const tag = `v${version}`;
  const outDir = path.join(__dirname, "../out/make");

  // Check if YML files exist
  const ymlFiles = [
    path.join(outDir, "latest-mac.yml"),
    path.join(outDir, "latest.yml"), // Windows YML if it exists
  ].filter((file) => fs.existsSync(file));

  if (ymlFiles.length === 0) {
    console.log('No YML files found to upload. Run "npm run generate-yml" first.');
    return;
  }

  console.log(`Uploading YML files to release ${tag}...`);

  ymlFiles.forEach((ymlFile) => {
    const fileName = path.basename(ymlFile);
    console.log(`Uploading ${fileName}...`);

    try {
      const command = `gh release upload ${tag} "${ymlFile}" --clobber`;
      execSync(command, { stdio: "inherit" });
      console.log(`✅ Successfully uploaded ${fileName}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${fileName}:`, error.message);
    }
  });

  console.log("YML upload completed!");
}

function main() {
  // Check if GitHub CLI is installed
  try {
    execSync("gh --version", { stdio: "ignore" });
    uploadToRelease();
  } catch (error) {
    console.log("GitHub CLI (gh) is not installed.");
    console.log("Manual upload instructions:");
    console.log("1. Go to https://github.com/lvcabral/carabiner/releases");
    console.log("2. Edit your latest release");
    console.log("3. Upload the following files from out/make/:");

    const outDir = path.join(__dirname, "../out/make");
    const ymlFiles = ["latest-mac.yml", "latest.yml"].filter((file) =>
      fs.existsSync(path.join(outDir, file))
    );

    ymlFiles.forEach((file) => {
      console.log(`   - ${file}`);
    });

    console.log("4. Save the release");
    console.log("\nAlternatively, install GitHub CLI with: brew install gh");
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  uploadToRelease,
};
