$HostName = "com.hyperdm.core"
$CurrentDir = (Get-Item -Path ".\").FullName
$ManifestPath = Join-Path $CurrentDir "com.hyperdm.core.json"

# Note: Before running this, you need to update the path in com.hyperdm.core.json to point to the built .exe
# and you must replace <EXTENSION_ID_HERE> with the actual ID from chrome://extensions

$RegPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"

if (-not (Test-Path $RegPath)) {
    New-Item -Path $RegPath -Force | Out-Null
}

Set-ItemProperty -Path $RegPath -Name "(default)" -Value $ManifestPath

Write-Host "Native Messaging Host registered successfully in HKCU."
Write-Host "Manifest Path: $ManifestPath"
