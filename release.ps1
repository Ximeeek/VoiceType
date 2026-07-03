# release.ps1
# Automates the release process for VoiceType and its custom installer.

# 1. Get current version and determine next version
$tauriConfPath = "src-tauri/tauri.conf.json"
$tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
$currentVersion = $tauriConf.version
Write-Host "Current version: $currentVersion"

$versionParts = $currentVersion.Split('.')
$newVersion = "$($versionParts[0]).$($versionParts[1]).$([int]$versionParts[2] + 1)"

$inputVersion = Read-Host "Enter new version [$newVersion]"
if ($inputVersion -ne "") {
    $newVersion = $inputVersion
}

Write-Host "Releasing version $newVersion..."

# Update tauri.conf.json
$tauriConf.version = $newVersion
# Format JSON nicely
$jsonContent = ConvertTo-Json $tauriConf -Depth 10
Set-Content $tauriConfPath -Value $jsonContent

# 2. Build main VoiceType app locally in release mode
Write-Host "Building VoiceType in release mode..."
cd src-tauri
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build VoiceType!"
    cd ..
    exit 1
}
cd ..

# 3. Build VoiceType-Installer (which packages payload.zip automatically)
Write-Host "Building VoiceType-Installer..."
$installerDir = "../VoiceType-Installer"
if (-not (Test-Path $installerDir)) {
    Write-Error "Could not find VoiceType-Installer workspace at $installerDir!"
    exit 1
}

cd "$installerDir/src-tauri"
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build VoiceType-Installer!"
    cd ../../VoiceType
    exit 1
}
cd ..

# Copy compiled installer binary to root
Copy-Item -Path "src-tauri/target/release/voicetype-preview.exe" -Destination "voicetype-installer.exe" -Force
cd ../VoiceType

# 4. Commit, tag, and push to GitHub
Write-Host "Committing and tagging version $newVersion..."
git add src-tauri/tauri.conf.json
git commit -m "chore: bump version to $newVersion" -m "Automated version bump and release compilation."
git tag "v$newVersion" -m "v$newVersion"
git push origin master --tags

# 5. Upload installer to GitHub release
Write-Host "Uploading voicetype-installer.exe to GitHub release..."
# Wait a few seconds for GitHub Actions to register the tag/release
Start-Sleep -Seconds 5
gh release upload "v$newVersion" "../VoiceType-Installer/voicetype-installer.exe" --clobber

Write-Host "Release v$newVersion completed successfully!"
