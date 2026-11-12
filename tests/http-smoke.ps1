param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$AdminToken = "",
    [string]$MemberToken = ""
)

$ErrorActionPreference = "Stop"
$pass = 0
$fail = 0

function Status {
    param([string]$Method = "GET", [string]$Path, [string[]]$Headers = @(), [string]$BodyFile = "")

    $arguments = @("-s", "-o", "NUL", "-w", "%{http_code}", "-X", $Method)
    foreach ($header in $Headers) { $arguments += @("-H", $header) }
    if ($BodyFile -ne "") { $arguments += @("--data-binary", "@$BodyFile") }
    $arguments += ($BaseUrl + $Path)

    return (& curl.exe @arguments)
}

function Check {
    param([string]$Name, [string]$Expected, [string]$Actual)

    if ($Actual -eq $Expected) {
        Write-Host "PASS $Name ($Actual)"
        $script:pass++
    } else {
        Write-Host "FAIL $Name (expected $Expected, got $Actual)"
        $script:fail++
    }
}

$temp = Join-Path ([IO.Path]::GetTempPath()) "flarum-social-smoke.json"
Set-Content -Path $temp -Value '{"body":"guest smoke test"}' -NoNewline

Check "guest bootstrap" "200" (Status -Path "/api/social/bootstrap")
Check "guest feed" "200" (Status -Path "/api/social/feed")
$guestWrite = Status -Method POST -Path "/api/social/posts" -Headers @("Content-Type: application/json") -BodyFile $temp
if ($guestWrite -in @("400", "401", "403")) {
    Write-Host "PASS guest write blocked ($guestWrite)"
    $pass++
} else {
    Write-Host "FAIL guest write blocked (got $guestWrite)"
    $fail++
}
Check "public room" "200" (Status -Path "/api/social/rooms/1")
Check "missing media" "404" (Status -Path "/api/social/media/999999/file")

if ($AdminToken -ne "") {
    $adminHeaders = @("Authorization: Token $AdminToken")
    Check "admin overview" "200" (Status -Path "/api/social/admin/overview" -Headers $adminHeaders)
    Check "janitor" "200" (Status -Method POST -Path "/api/social/presence/janitor" -Headers $adminHeaders)
    Check "admin room manager" "200" (Status -Path "/api/social/admin/rooms" -Headers $adminHeaders)
}

if ($MemberToken -ne "") {
    Check "member bootstrap" "200" (Status -Path "/api/social/bootstrap" -Headers @("Authorization: Token $MemberToken"))
    Check "member admin denied" "403" (Status -Path "/api/social/admin/overview" -Headers @("Authorization: Token $MemberToken"))
}

Remove-Item -Path $temp -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Passed: $pass  Failed: $fail"
if ($fail -ne 0) { exit 1 }
