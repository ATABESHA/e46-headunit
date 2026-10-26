@echo off
rem Opens the head unit and the cluster as two app windows in Microsoft Edge.
rem You can run it again if you closed a window. Press F11 in a window for full screen.
timeout /t 4 /nobreak >nul
start "" msedge --app=http://127.0.0.1:8765/ --window-size=1100,560
start "" msedge --app=http://127.0.0.1:8765/cluster.html --window-size=1940,800
