# Gnani Monitoring Stack

This directory contains the monitoring infrastructure for Gnani backend using Prometheus and Grafana.

## Quick Start

```bash
# Start monitoring stack
cd monitoring
docker-compose up -d

# Check services
docker-compose ps

# View logs
docker-compose logs -f

# Stop monitoring stack
docker-compose down
```

## Services

### Prometheus
- **URL:** http://localhost:9090
- **Purpose:** Metrics collection and alerting
- **Scrapes:** Backend `/metrics` endpoint every 15s

### Grafana
- **URL:** http://localhost:3001
- **Login:** admin / admin
- **Purpose:** Metrics visualization and dashboards

### Alertmanager
- **URL:** http://localhost:9093
- **Purpose:** Alert routing and notifications

## Configuration

### Prometheus
- **Config:** `prometheus/prometheus.yml`
- **Alerts:** `prometheus/alerts.yml`
- **Scrape interval:** 15s
- **Evaluation interval:** 15s

### Grafana
- **Datasources:** `grafana/datasources/prometheus.yml`
- **Dashboards:** `grafana/dashboards/`

## Metrics Endpoint

The backend exposes Prometheus metrics at:
```
GET http://localhost:3000/metrics
```

## Useful Queries

### HTTP Metrics
```promql
# Request rate
rate(http_requests_total[5m])

# Request latency (p95)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m])
```

### LLM Metrics
```promql
# LLM request rate
rate(gnani_llm_calls_total[5m])

# LLM latency
rate(gnani_llm_latency_ms_sum[5m]) / rate(gnani_llm_latency_ms_count[5m])

# Cache hit rate
rate(gnani_cache_hits_total[5m]) / (rate(gnani_cache_hits_total[5m]) + rate(gnani_cache_misses_total[5m]))
```

### System Metrics
```promql
# CPU usage
rate(process_cpu_user_seconds_total[5m]) * 100

# Memory usage
process_resident_memory_bytes / 1024 / 1024

# Active sessions
active_sessions_total
```

## Alerts

Configured alerts:
- **HighErrorRate:** Error rate > 10 errors/sec for 5m
- **HighLLMLatency:** p95 latency > 10s for 5m
- **CircuitBreakerOpen:** Circuit breaker opened
- **LowCacheHitRate:** Cache hit rate < 30% for 10m
- **HighMemoryUsage:** Memory > 4GB for 5m
- **HighHTTPErrorRate:** 5xx error rate > 5% for 5m

## Troubleshooting

### Prometheus can't scrape backend
```bash
# Check if backend is running
curl http://localhost:3000/metrics

# Check Prometheus targets
open http://localhost:9090/targets
```

### Grafana can't connect to Prometheus
```bash
# Check if Prometheus is running
docker-compose ps prometheus

# Check Prometheus URL in Grafana datasource
# Should be: http://prometheus:9090
```

### No data in dashboards
```bash
# Generate some traffic
for i in {1..100}; do curl http://localhost:3000/health; done

# Check if metrics are being collected
curl http://localhost:3000/metrics | grep http_requests_total
```

## Development

### Add new metrics
1. Add metric to `src/core/monitoring/metrics.ts`
2. Use metric in your code
3. Restart backend
4. Check `/metrics` endpoint

### Add new dashboard
1. Create dashboard in Grafana UI
2. Export as JSON
3. Save to `grafana/dashboards/`
4. Restart Grafana

### Add new alert
1. Edit `prometheus/alerts.yml`
2. Restart Prometheus: `docker-compose restart prometheus`
3. Check alerts: http://localhost:9090/alerts
