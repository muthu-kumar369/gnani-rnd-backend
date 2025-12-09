# Start Monitoring Stack
Write-Host "Starting Gnani Monitoring Stack..." -ForegroundColor Green

# Check if Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "Error: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Start monitoring stack
Write-Host "`nStarting services..." -ForegroundColor Yellow
docker compose -f docker-compose.monitoring.yml up -d

# Wait for services to be healthy
Write-Host "`nWaiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "`nService Status:" -ForegroundColor Green
docker compose -f docker-compose.monitoring.yml ps

# Display access URLs
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Monitoring Stack Started Successfully!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Access the following services:" -ForegroundColor Yellow
Write-Host "  Grafana:       http://localhost:3000 (admin/admin)" -ForegroundColor White
Write-Host "  Prometheus:    http://localhost:9090" -ForegroundColor White
Write-Host "  Alertmanager:  http://localhost:9093" -ForegroundColor White
Write-Host "  Jaeger UI:     http://localhost:16686" -ForegroundColor White
Write-Host "  Loki:          http://localhost:3100" -ForegroundColor White

Write-Host "`nTo view logs:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.monitoring.yml logs -f" -ForegroundColor White

Write-Host "`nTo stop:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.monitoring.yml down" -ForegroundColor White
Write-Host ""
