# Generate a local development strong-name identity; this is not a Dataverse credential.
# Ephemeral key storage avoids requiring access to a persisted Windows key container.
$ErrorActionPreference = 'Stop'
$keyPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\InterpreterCRM.Plugins\InterpreterCRM.Plugins.snk'))
if (Test-Path -LiteralPath $keyPath) {
    throw "A signing key already exists at $keyPath. Refusing to replace the assembly identity."
}
$parameters = [Security.Cryptography.CspParameters]::new()
$parameters.Flags = [Security.Cryptography.CspProviderFlags]::CreateEphemeralKey
$rsa = [Security.Cryptography.RSACryptoServiceProvider]::new(2048, $parameters)
try {
    [IO.File]::WriteAllBytes($keyPath, $rsa.ExportCspBlob($true))
    Write-Output "Generated development signing key: $keyPath"
}
finally {
    $rsa.Dispose()
}
