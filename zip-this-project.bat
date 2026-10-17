@echo off
setlocal

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set "datetime=%%I"

if not defined datetime (
    echo ERROR: Could not determine the current date.
    pause
    exit /b 1
)

set "ZIPNAME=project-%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%.zip"
set "DESKTOP="

if exist "%USERPROFILE%\Desktop\" set "DESKTOP=%USERPROFILE%\Desktop"

if not defined DESKTOP if exist "%USERPROFILE%\OneDrive\Desktop\" set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"

if not defined DESKTOP (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$p=Get-ChildItem Env: | Where-Object { $_.Name -like 'OneDrive*' } | ForEach-Object { Join-Path $_.Value 'Desktop' } | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | Select-Object -First 1; if ($p) { $p }"`) do set "DESKTOP=%%I"
)

if not defined DESKTOP (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$p=[Environment]::GetFolderPath('DesktopDirectory'); if ($p -and (Test-Path -LiteralPath $p -PathType Container)) { $p }"`) do set "DESKTOP=%%I"
)

if not defined DESKTOP (
    echo ERROR: Could not locate your Desktop folder.
    echo Checked standard Desktop and OneDrive locations.
    pause
    exit /b 1
)

set "DESTINATION=%DESKTOP%\%ZIPNAME%"

echo.
echo Creating "%ZIPNAME%" on Desktop...
echo Desktop: "%DESKTOP%"
echo Excluding: node_modules, .cache, .freebuff, .git, .next, public, client, .env, .mongo, test-results, legacy-code.zip, zip-this-project.bat
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $exclude=@('node_modules','.cache','.freebuff','.git','.next','public','client','.env','.mongo','test-results','legacy-code.zip','zip-this-project.bat'); try { $root=(Get-Location).Path; $dest='%DESTINATION%'; $items=@(Get-ChildItem -LiteralPath $root -Force | Where-Object { $exclude -notcontains $_.Name -and $_.FullName -ne $dest }); if ($items.Count -eq 0) { throw 'Nothing to zip.' }; Compress-Archive -Path $items.FullName -DestinationPath $dest -Force; if (!(Test-Path -LiteralPath $dest -PathType Leaf)) { throw 'ZIP file was not created.' }; Write-Host 'ZIP created successfully.' -ForegroundColor Green; exit 0 } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"

if errorlevel 1 (
    echo.
    echo ZIP creation failed.
    pause
    exit /b 1
)

echo.
echo Saved to: "%DESTINATION%"
timeout /t 2 >nul
exit /b 0