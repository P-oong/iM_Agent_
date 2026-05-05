# agentserver FastAPI start script
$env:PYTHONPATH = "$PSScriptRoot\src"
$py = "$PSScriptRoot\.venv\Scripts\python.exe"

# Load OPENAI_API_KEY from .env (one level up, at iM_Agent_ root)
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    $lines = Get-Content $envFile
    foreach ($line in $lines) {
        if ($line -match "^OPENAI_API_KEY=(.+)$") {
            $env:OPENAI_API_KEY = $Matches[1].Trim()
            Write-Host "OPENAI_API_KEY loaded" -ForegroundColor Green
        }
    }
} else {
    Write-Host "Warning: .env file not found at $envFile" -ForegroundColor Yellow
}

Write-Host "Starting iM Bank Sales Agent API (http://localhost:8000)" -ForegroundColor Cyan
Write-Host "API docs: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "Stop: Ctrl+C" -ForegroundColor Gray

& $py -m uvicorn bank_sales_agent.api:app --host 0.0.0.0 --port 8000 --reload
