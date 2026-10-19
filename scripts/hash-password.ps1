# Uso: powershell -ExecutionPolicy Bypass -File scripts\hash-password.ps1
# Pide una contrasena y muestra el hash para APP_USERS (no necesita Node).
$secure = Read-Host -AsSecureString 'Contrasena'
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ($pw.Length -lt 10) { Write-Error 'Usa al menos 10 caracteres.'; exit 1 }
$iterations = 210000
$salt = New-Object byte[] 16
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($salt)
$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($pw, $salt, $iterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
$hash = $kdf.GetBytes(32)
"pbkdf2`$sha256`$$iterations`$$([Convert]::ToBase64String($salt))`$$([Convert]::ToBase64String($hash))"
