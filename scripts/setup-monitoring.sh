#!/bin/bash

echo "========================================="
echo "Setting up GNANI Monitoring Stack"
echo "========================================="

# Create monitoring directory structure
echo "Creating monitoring directories..."
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/datasources

# Create Prometheus configuration
echo "Creating Prometheus configuration..."
cat > monitoring/prometheus/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# Load alert rules
rule_files:
  - 'alerts.yml'

scrape_configs:
  - job_name: 'gnani-backend'
    static_configs:
      - targets: ['host.docker.internal:9464']
    
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF

# Create Prometheus alert rules
echo "Creating Prometheus alert rules..."
cat > monitoring/prometheus/alerts.yml <<'EOF'
groups:
  - name: gnani_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(gnani_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: HighSTTLatency
        expr: histogram_quantile(0.95, gnani_stt_latency_ms_bucket) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High STT latency"
          description: "P95 STT latency is {{ $value }}ms"

      - alert: HighLLMLatency
        expr: histogram_quantile(0.95, gnani_llm_latency_ms_bucket) > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High LLM latency"
          description: "P95 LLM latency is {{ $value }}ms"

      - alert: HighMemoryUsage
        expr: gnani_memory_usage_bytes{type="heapUsed"} > 1073741824
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage"
          description: "Heap usage is {{ $value }} bytes (>1GB)"
EOF

# Create Grafana datasource configuration
echo "Creating Grafana datasource configuration..."
cat > monitoring/grafana/datasources/prometheus.yml <<'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

# Create Grafana dashboard provisioning
echo "Creating Grafana dashboard provisioning..."
cat > monitoring/grafana/dashboards/dashboard.yml <<'EOF'
apiVersion: 1

providers:
  - name: 'GNANI Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

# Create basic Grafana dashboard
echo "Creating Grafana dashboard..."
cat > monitoring/grafana/dashboards/gnani-overview.json <<'EOF'
{
  "dashboard": {
    "title": "GNANI System Overview",
    "tags": ["gnani", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Active Sessions",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "gnani_active_sessions",
            "legendFormat": "Active Sessions"
          }
        ]
      },
      {
        "id": 2,
        "title": "STT Latency (P95)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, gnani_stt_latency_ms_bucket)",
            "legendFormat": "P95 Latency"
          }
        ]
      },
      {
        "id": 3,
        "title": "LLM Latency (P95)",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "histogram_quantile(0.95, gnani_llm_latency_ms_bucket)",
            "legendFormat": "P95 Latency"
          }
        ]
      },
      {
        "id": 4,
        "title": "Error Rate",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "rate(gnani_errors_total[5m])",
            "legendFormat": "Errors/sec"
          }
        ]
      },
      {
        "id": 5,
        "title": "Memory Usage",
        "type": "graph",
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 16},
        "targets": [
          {
            "expr": "gnani_memory_usage_bytes{type='heapUsed'}",
            "legendFormat": "Heap Used"
          }
        ]
      }
    ]
  }
}
EOF

echo ""
echo "========================================="
echo "Monitoring setup complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Start monitoring stack: docker-compose up -d prometheus grafana jaeger"
echo "2. Install OpenTelemetry dependencies: npm install --save @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-prometheus @opentelemetry/exporter-jaeger prom-client"
echo "3. Access monitoring services:"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3001 (admin/admin)"
echo "   - Jaeger: http://localhost:16686"
echo ""
echo "========================================="
