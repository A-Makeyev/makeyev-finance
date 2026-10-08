@echo off
setlocal

:: Zip name: project-YYYY-MM-DD.zip
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "ZIPNAME=project-%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%.zip"
set "DESKTOP=%USERPROFILE%\Desktop\%ZIPNAME%"

echo.
echo Creating "%ZIPNAME%" on Desktop...
echo Excluding: node_modules, .cache, .freebuff, .git, .next, public, client, .env, test-results, legacy-code.zip, zip-this-project.bat
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$exclude=@('node_modules','.cache','.freebuff','.git','.next','public','client','.env','test-results','legacy-code.zip', 'zip-this-project.bat'); $items=Get-ChildItem -Force | Where-Object {$exclude -notcontains $_.Name}; if($items.Count -gt 0){Compress-Archive -Path $items.FullName -DestinationPath '%DESKTOP%' -Force; Write-Host 'Done → Desktop\%ZIPNAME%' -ForegroundColor Green}else{Write-Host 'Nothing to zip!' -ForegroundColor Yellow}"

timeout /t 1 >nul
exit