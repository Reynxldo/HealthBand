cd C:\Users\LENOVO\OneDrive\Reynaldo\Proyectos\HealthBand
taskkill /F /IM node.exe
pm2 start servidor.js --name healthband --max-memory-restart 150M