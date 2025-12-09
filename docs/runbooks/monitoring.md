# Monitoring Runbook

## Quick Reference

### Dashboard Access
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Jaeger**: http://localhost:16686
- **Loki**: http://localhost:3100

### Key Metrics to Watch

#### System Health
- Error rate < 0.1%
- p95 latency < 200ms (text), < 500ms (audio)
- CPU usage < 80%
- Memory usage < 8GB

#### LLM Performance
- Cache hit rate > 30%
- Circuit breaker closed
- Response time p95 < 3s

#### Session Management
- Session recovery success rate > 99%
- Active sessions < 1000 (per instance)

---

## Alert Response Procedures

### High Error Rate
**Alert:** Error rate > 10% for 5 minutes

**Steps:**
1. Check Grafana "System Overview" dashboard
2. Identify failing service in traces (Jaeger)
3. Check logs for error details (Loki/Grafana)
4. Review recent deployments
5. Rollback if necessary

**Common Causes:**
- Database connection issues
- LLM service unavailable
- Invalid input data
- Memory exhaustion

---

### LLM Circuit Breaker Open
**Alert:** Circuit breaker opened for 1 minute

**Steps:**
1. Check Ollama service health: `curl http://localhost:11434/api/tags`
2. Verify network connectivity
3. Check Ollama logs: `docker logs ollama`
4. Restart Ollama if needed: `docker restart ollama`
5. Circuit breaker will auto-close after recovery

**Common Causes:**
- Ollama service down
- Network issues
- Model loading failures
- Resource exhaustion

---

### High Latency
**Alert:** p95 latency > 1s for 5 minutes

**Steps:**
1. Check "LLM Performance" dashboard
2. Identify slow operations in traces (Jaeger)
3. Check database query performance
4. Review cache hit rates
5. Consider scaling if sustained

**Common Causes:**
- Slow database queries
- Low cache hit rate
- High concurrent load
- Large context windows

---

### Database Connection Pool Exhausted
**Alert:** Connection pool > 90% full

**Steps:**
1. Check active connections in MongoDB
2. Look for long-running queries
3. Check for connection leaks in code
4. Restart service if needed
5. Increase pool size if sustained

**Common Causes:**
- Connection leaks
- Slow queries
- High concurrent load
- Insufficient pool size

---

### High Session Recovery Failures
**Alert:** Recovery failures > 0.1/sec for 5 minutes

**Steps:**
1. Check session storage (MongoDB)
2. Verify checkpoint data integrity
3. Check logs for recovery errors
4. Review recent session changes
5. May need to clear corrupted sessions

**Common Causes:**
- Corrupted checkpoint data
- Schema changes
- Database issues
- Code bugs

---

### Low Cache Hit Rate
**Alert:** Cache hit rate < 30% for 10 minutes

**Steps:**
1. Check Redis service health
2. Verify cache TTL settings
3. Review cache key generation
4. Check for cache evictions
5. Consider increasing cache size

**Common Causes:**
- Cache evictions (memory pressure)
- Short TTL values
- Unique queries (low reusability)
- Redis issues

---

## Common Issues

### Grafana Dashboard Not Loading

**Symptoms:** Dashboard shows "No data" or fails to load

**Diagnosis:**
```bash
# Check if Prometheus is running
curl http://localhost:9090/-/healthy

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check backend metrics endpoint
curl http://localhost:3001/metrics
```

**Solutions:**
- Verify Prometheus datasource configuration in Grafana
- Ensure backend is exposing metrics on port 3001
- Check Prometheus scrape configuration
- Restart Grafana: `docker restart gnani-grafana`

---

### Missing Metrics

**Symptoms:** Specific metrics not appearing in Prometheus

**Diagnosis:**
```bash
# Check if backend is exposing the metric
curl http://localhost:3001/metrics | grep <metric_name>

# Check Prometheus targets status
curl http://localhost:9090/api/v1/targets | jq
```

**Solutions:**
- Verify metric is registered in `metrics.ts`
- Ensure metric is being incremented/observed
- Check for typos in metric names
- Restart backend to reload metrics

---

### Traces Not Appearing in Jaeger

**Symptoms:** No traces visible in Jaeger UI

**Diagnosis:**
```bash
# Check Jaeger is running
curl http://localhost:16686

# Verify OTLP endpoint
curl http://localhost:4318/v1/traces

# Check backend OTEL configuration
echo $OTEL_EXPORTER_OTLP_ENDPOINT
```

**Solutions:**
- Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is set correctly
- Ensure tracing is initialized in backend
- Check Jaeger logs: `docker logs gnani-jaeger`
- Generate test traffic to create traces

---

### Logs Not Appearing in Loki

**Symptoms:** No logs in Grafana Explore (Loki datasource)

**Diagnosis:**
```bash
# Check Loki is receiving logs
curl 'http://localhost:3100/loki/api/v1/query?query={job="gnani-backend"}'

# Check Promtail is running
docker logs gnani-promtail

# Verify log file path
ls -la ./logs/
```

**Solutions:**
- Ensure logs are being written to `./logs/` directory
- Check Promtail configuration for correct path
- Verify log format is JSON
- Restart Promtail: `docker restart gnani-promtail`

---

### Alerts Not Firing

**Symptoms:** Expected alerts not triggering

**Diagnosis:**
```bash
# Check alert rules in Prometheus
curl http://localhost:9090/api/v1/rules

# Check Alertmanager status
curl http://localhost:9093/api/v1/status

# Verify alert conditions
curl 'http://localhost:9090/api/v1/query?query=<alert_expression>'
```

**Solutions:**
- Verify alert rule syntax in `alerts.yml`
- Check alert evaluation interval
- Ensure Alertmanager is configured correctly
- Test Slack webhook: `curl -X POST $SLACK_WEBHOOK_URL -d '{"text":"test"}'`

---

## Maintenance Tasks

### Daily
- [ ] Review error rate trends
- [ ] Check for new alerts
- [ ] Verify all services are healthy

### Weekly
- [ ] Review dashboard metrics
- [ ] Check for performance degradation
- [ ] Update alert thresholds if needed
- [ ] Review trace samples for bottlenecks

### Monthly
- [ ] Review and update runbook
- [ ] Analyze long-term trends
- [ ] Optimize slow queries
- [ ] Update dashboards based on new metrics

---

## Useful Queries

### Prometheus Queries

```promql
# Request rate by endpoint
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Cache hit rate
rate(gnani_cache_hits_total[5m]) / (rate(gnani_cache_hits_total[5m]) + rate(gnani_cache_misses_total[5m]))

# Active sessions
active_sessions_total

# LLM request rate
rate(llm_request_total[5m])

# Memory usage
gnani_memory_usage_bytes{type="heapUsed"} / 1024 / 1024
```

### Loki Queries

```logql
# All logs from backend
{job="gnani-backend"}

# Error logs only
{job="gnani-backend"} |= "error"

# Logs from specific service
{job="gnani-backend", service="session-coordinator"}

# Logs with specific trace ID
{job="gnani-backend"} | json | trace_id="abc123"
```

---

## Escalation

### Severity Levels

**Critical (P0):**
- Service completely down
- Data loss risk
- Security breach
- Circuit breaker open

**High (P1):**
- Degraded performance
- High error rate
- Failed deployments

**Medium (P2):**
- Low cache hit rate
- Slow queries
- Resource warnings

**Low (P3):**
- Informational alerts
- Optimization opportunities

### Escalation Path

1. **On-call Engineer** - First responder
2. **Team Lead** - If issue persists > 30 minutes
3. **Engineering Manager** - If critical and unresolved > 1 hour

---

## Contact Information

- **Slack Channel**: #gnani-alerts
- **On-call**: Check PagerDuty schedule
- **Email**: oncall@gnani.ai

---

**Last Updated:** December 9, 2025  
**Version:** 1.0
