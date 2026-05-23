@echo off
cd /d "%~dp0.."
if exist "apps\web\.next" rmdir /s /q "apps\web\.next"
npm.cmd run dev:web
