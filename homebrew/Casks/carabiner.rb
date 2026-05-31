cask "carabiner" do
  version "2.0.0"
  sha256 "ae98fc015a4593da95fe67f0be4a2403a7e7bd21c1c5ca7ecf0274e1dfea5f6a"

  url "https://github.com/lvcabral/carabiner/releases/download/v#{version}/Carabiner-#{version}-universal.dmg"
  name "Carabiner"
  desc "Live video overlay for streaming device development and QA"
  homepage "https://github.com/lvcabral/carabiner"

  depends_on macos: ">= :monterey"

  app "Carabiner.app"

  zap trash: [
    "~/Library/Application Support/carabiner",
    "~/Library/Preferences/com.lvcabral.carabiner.plist",
    "~/Library/Saved Application State/com.lvcabral.carabiner.savedState",
  ]
end
