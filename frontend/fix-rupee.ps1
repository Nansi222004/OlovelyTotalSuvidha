# Fix Rupee Symbol - Clean Version
$files = Get-ChildItem -Path src -Recurse -Include *.tsx,*.ts,*.jsx,*.js
$count = 0
$rupee = [char]0x20B9

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    $original = $content
    
    # Replace common corrupted forms
    $content = $content -replace '?', $rupee
    $content = $content -replace '????', $rupee
    
    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, (New-Object System.Text.UTF8Encoding $false))
        $count++
        Write-Host "Fixed: $($file.Name)"
    }
}

Write-Host "`nTotal files fixed: $count"
