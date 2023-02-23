git add .
if %time:~0,2% gtr 10 goto a
if %time:~0,2% lss 10 goto b
:a
git commit -m "Backup at %date:~0,4%-%date:~5,2%-%date:~8,2% %time%"
goto c
:end
:b
git commit -m "Backup at %date:~0,4%-%date:~5,2%-%date:~8,2% 0%time:~1,12%"
goto c
:end
:c
git push
pause
:end