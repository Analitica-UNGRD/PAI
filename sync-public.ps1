# Script to sync src files to public directory for Vercel deployment
# This ensures all necessary files are properly available in the public directory

# Create directories if they don't exist
$dirs = @(
    "public/lib",
    "public/styles",
    "public/assets",
    "public/pages_scripts"
)

foreach ($dir in $dirs) {
    if (-not (Test-Path -Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
        Write-Host "Created directory: $dir"
    }
}

# Copy lib files
$libFiles = Get-ChildItem -Path "src/lib" -File
foreach ($file in $libFiles) {
    Copy-Item -Path $file.FullName -Destination "public/lib/" -Force
    Write-Host "Copied: $($file.Name) to public/lib/"
}

# Copy styles files
$styleFiles = Get-ChildItem -Path "src/styles" -File
foreach ($file in $styleFiles) {
    Copy-Item -Path $file.FullName -Destination "public/styles/" -Force
    Write-Host "Copied: $($file.Name) to public/styles/"
}

# Copy assets
$assetFiles = Get-ChildItem -Path "src/assets" -File
foreach ($file in $assetFiles) {
    Copy-Item -Path $file.FullName -Destination "public/assets/" -Force
    Write-Host "Copied: $($file.Name) to public/assets/"
}

# Copy page scripts
$pageScripts = Get-ChildItem -Path "src/pages_scripts" -File
foreach ($file in $pageScripts) {
    Copy-Item -Path $file.FullName -Destination "public/pages_scripts/" -Force
    Write-Host "Copied: $($file.Name) to public/pages_scripts/"
}

# Copy HTML pages
$htmlPages = Get-ChildItem -Path "src/pages" -File -Filter "*.html"
foreach ($file in $htmlPages) {
    Copy-Item -Path $file.FullName -Destination "public/" -Force
    Write-Host "Copied: $($file.Name) to public/"
}

Write-Host "Sync completed successfully!"