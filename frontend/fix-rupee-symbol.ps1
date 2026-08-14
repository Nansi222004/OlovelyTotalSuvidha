# Fix Rupee Symbol Encoding Issue
$files = Get-ChildItem -Path "src" -Recurse -Include "*.tsx", "*.ts", "*.jsx", "*.js"
$replacements = 0

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        
        # Replace corrupted rupee symbol with proper one
        $newContent = $content -replace '₹', '₹'
        
        if ($content -ne $newContent) {
            [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.UTF8Encoding]::new($false))
            $replacements++
            Write-Host "Fixed: $($file.Name)"
        }
    }
    catch {
        Write-Host "Error processing $($file.Name): $_"
    }
}

Write-Host "`nTotal files fixed: $replacements"
