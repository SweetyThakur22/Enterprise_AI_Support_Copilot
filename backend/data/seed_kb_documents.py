"""Seed 6 Knowledge Base documents with realistic technical content."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models.kb_document import KbDocument

KB_DOCUMENTS = [
    {
        "title": "Oracle Database Troubleshooting Guide",
        "category": "DATABASE",
        "source": "internal-kb/oracle-troubleshooting-v3.2",
        "content": """# Oracle Database Troubleshooting Guide

## 1. ORA-01652: Unable to Extend Temp Segment

### Overview
ORA-01652 is one of the most common Oracle errors encountered in production batch environments. It occurs when Oracle cannot allocate additional space for temporary segments used during sort, hash join, or GROUP BY operations.

### Error Message Format
```
ORA-01652: unable to extend temp segment by <N> in tablespace <TABLESPACE_NAME>
```
Where `<N>` is the number of database blocks Oracle tried to allocate and `<TABLESPACE_NAME>` is typically TEMP.

### Root Causes
1. **TEMP tablespace is full**: The most common cause. Concurrent sessions or a single large query consuming all available TEMP space.
2. **Incorrect TEMP tablespace sizing**: TEMP was sized for historical data volumes and has not been reviewed after business growth.
3. **Large sort operations**: ORDER BY, GROUP BY, or analytical functions (RANK, ROW_NUMBER) on large datasets without adequate PGA sort memory.
4. **Hash join spill to disk**: Hash joins that cannot fit in PGA memory spill to TEMP.
5. **Suboptimal execution plans**: Missing indexes causing full table scans and large sorts.
6. **TEMP space not released**: Crashed or killed sessions may leave TEMP segments allocated until instance restart or segment reclaim.

### Immediate Diagnosis Queries

Check current TEMP usage:
```sql
SELECT
    u.username,
    u.sid,
    u.serial#,
    u.sql_id,
    u.program,
    t.segtype,
    t.blocks * (SELECT value FROM v$parameter WHERE name = 'db_block_size') / 1024 / 1024 AS mb_used
FROM v$tempseg_usage t
JOIN v$session u ON u.saddr = t.session_addr
ORDER BY mb_used DESC;
```

Check TEMP tablespace free space:
```sql
SELECT
    tablespace_name,
    ROUND(tablespace_size * 8192 / 1024 / 1024 / 1024, 2) AS total_gb,
    ROUND(allocated_space * 8192 / 1024 / 1024 / 1024, 2) AS used_gb,
    ROUND((tablespace_size - allocated_space) * 8192 / 1024 / 1024 / 1024, 2) AS free_gb,
    ROUND(allocated_space / NULLIF(tablespace_size, 0) * 100, 1) AS pct_used
FROM dba_temp_free_space;
```

Check TEMP datafile autoextend settings:
```sql
SELECT
    file_name,
    ROUND(bytes / 1024 / 1024 / 1024, 2) AS current_size_gb,
    autoextensible,
    ROUND(maxbytes / 1024 / 1024 / 1024, 2) AS max_size_gb,
    ROUND(increment_by * 8192 / 1024 / 1024, 0) AS increment_mb
FROM dba_temp_files;
```

Identify the offending SQL:
```sql
SELECT sql_id, sql_text
FROM v$sql
WHERE sql_id = '<sql_id_from_tempseg_query>';
```

### Immediate Resolution Steps

**Step 1: Add a TEMP datafile (fastest, no downtime)**
```sql
ALTER TABLESPACE TEMP ADD TEMPFILE '/u02/oradata/BILPRD01/temp02.dbf'
SIZE 10G AUTOEXTEND ON NEXT 1G MAXSIZE 30G;
```

**Step 2: Resize existing TEMP datafile**
```sql
ALTER DATABASE TEMPFILE '/u02/oradata/BILPRD01/temp01.dbf' RESIZE 80G;
```

**Step 3: Enable autoextend if disabled**
```sql
ALTER DATABASE TEMPFILE '/u02/oradata/BILPRD01/temp01.dbf'
AUTOEXTEND ON NEXT 2G MAXSIZE UNLIMITED;
```

**Step 4: Reclaim leaked TEMP segments**
```sql
-- Kill sessions holding TEMP space that are idle
SELECT 'ALTER SYSTEM KILL SESSION ''' || sid || ',' || serial# || ''' IMMEDIATE;'
FROM v$session
WHERE status = 'INACTIVE'
AND last_call_et > 3600
AND sid IN (SELECT DISTINCT sid FROM v$tempseg_usage);
```

### Prevention and Long-Term Remediation

1. **Right-size TEMP tablespace**: Review quarterly. Rule of thumb: TEMP should be at least 20% of the largest table being sorted in any batch job. For a 200GB billing dataset, size TEMP at minimum 40GB.

2. **Enable TEMP monitoring alerts**: Configure Oracle Enterprise Manager or custom monitoring to alert at 80% and 95% TEMP utilisation.

3. **Tune batch SQL**: Add hints or statistics to avoid large disk sorts:
   - Use `/*+ NO_MERGE */` to prevent view merging that causes large intermediate sorts
   - Ensure statistics are current: `EXEC DBMS_STATS.GATHER_TABLE_STATS('BILLING', 'BILLING_CALC_WORK')`

4. **Increase PGA for sort operations**: Larger PGA reduces TEMP spill:
   ```sql
   ALTER SYSTEM SET pga_aggregate_target = 8G SCOPE=BOTH;
   ```

5. **Batch checkpoint strategy**: Commit every N records to release sort space progressively rather than holding a single large transaction.

---

## 2. ORA-04031: Unable to Allocate Shared Pool Memory

Occurs when the shared pool cannot satisfy a memory allocation request. Usually indicates shared pool fragmentation or inadequate sizing.

### Quick Resolution
```sql
ALTER SYSTEM FLUSH SHARED_POOL;
ALTER SYSTEM SET shared_pool_size = 2G SCOPE=BOTH;
```

---

## 3. ORA-00060: Deadlock Detected

### Detection
```sql
SELECT * FROM dba_waiters;
```
Check alert log for deadlock trace file location. Deadlock graphs appear in trace files in `$ORACLE_BASE/diag/rdbms/`.

### Resolution
- Implement consistent lock ordering across concurrent processes
- Reduce transaction size — commit frequently in batch operations
- Use `SELECT ... FOR UPDATE SKIP LOCKED` for queue-based processing

---

## 4. ORA-01555: Snapshot Too Old

Occurs when a long-running query cannot find a consistent read version in the undo tablespace.

### Resolution
```sql
ALTER TABLESPACE UNDOTBS1 ADD DATAFILE SIZE 10G;
ALTER SYSTEM SET undo_retention = 10800 SCOPE=BOTH;
```

---

## 5. Database Performance Baseline Queries

Monitor top SQL by elapsed time:
```sql
SELECT sql_id, executions, elapsed_time/1000000 AS elapsed_secs,
       ROUND(elapsed_time / NULLIF(executions,0) / 1000000, 3) AS avg_secs,
       sql_text
FROM v$sql
WHERE executions > 0
ORDER BY elapsed_time DESC
FETCH FIRST 10 ROWS ONLY;
```

AWR report generation:
```sql
-- Generate AWR report for last hour
SELECT output FROM TABLE(
    DBMS_WORKLOAD_REPOSITORY.AWR_REPORT_TEXT(
        l_dbid => (SELECT dbid FROM v$database),
        l_inst_num => 1,
        l_bid => (SELECT min(snap_id) FROM dba_hist_snapshot WHERE begin_interval_time > SYSDATE - 1/24),
        l_eid => (SELECT max(snap_id) FROM dba_hist_snapshot)
    )
);
```
""",
    },
    {
        "title": "Batch Processing Runbook",
        "category": "BATCH",
        "source": "internal-kb/batch-processing-runbook-v2.1",
        "content": """# Batch Processing Runbook

## Overview
This runbook covers the operation, monitoring, and recovery of enterprise batch processing jobs across the Billing Platform, Meter Data Platform, and Payment Processing systems.

---

## 1. Billing Batch Job (BILL_BATCH_JOB_001)

### Schedule
- Runs nightly at 02:00 UTC
- Monthly billing run: 1st of month at 02:00 UTC (larger dataset, runs 45–90 minutes)
- Quarterly reconciliation: 1st of quarter at 03:00 UTC

### Normal Completion Times
| Run Type      | Expected Duration | Max Acceptable |
|---------------|-------------------|----------------|
| Nightly       | 12–18 minutes     | 30 minutes     |
| Monthly       | 45–90 minutes     | 120 minutes    |
| Quarterly     | 3–5 hours         | 8 hours        |

### Job Phases
1. **Phase 1 – Meter Reading Consolidation**: Aggregates raw meter readings into billing-period totals
2. **Phase 2 – Usage Calculation**: Applies tiered rate schedules and standing charges
3. **Phase 3 – Invoice Generation**: Creates invoice records and applies adjustments
4. **Phase 4 – Delivery Preparation**: Formats invoices for print, email, and portal delivery
5. **Phase 5 – Archive and Audit**: Moves processed records to archive tables and writes audit trail

### Monitoring Dashboard
- Grafana: `https://grafana.internal/d/batch-billing`
- Key metrics: records/sec throughput, TEMP tablespace %, PGA usage, commit frequency

---

## 2. Batch Failure Response Procedures

### 2.1 Immediate Assessment (First 5 Minutes)
When a batch failure alert fires:

1. Check batch log for exit code and last error message
2. Identify the failure phase (Phase 1–5)
3. Check Oracle alert log: `tail -100 $ORACLE_BASE/diag/rdbms/bilprd01/BILPRD01/trace/alert_BILPRD01.log`
4. Check for concurrent resource contention from other jobs

### 2.2 ORA-01652 Failure Recovery Procedure

This is the most common batch failure mode. Follow this sequence:

**Step 1: Confirm TEMP exhaustion**
```sql
SELECT tablespace_name, pct_used
FROM dba_temp_free_space_pct;
```

**Step 2: Page DBA on-call**
Contact: ops-dba@company.com or PagerDuty escalation policy: `BILLING-DBA-ONCALL`

**Step 3: DBA extends TEMP tablespace**
```sql
ALTER TABLESPACE TEMP ADD TEMPFILE '/u02/oradata/BILPRD01/temp02.dbf'
SIZE 15G AUTOEXTEND ON NEXT 2G MAXSIZE 30G;
```

**Step 4: Verify TEMP has sufficient free space**
Ensure at least 15GB free before re-running. Monthly billing sort operations require approximately 12GB of TEMP at peak.

**Step 5: Determine restart point**
Check BATCH_AUDIT_LOG for last committed checkpoint:
```sql
SELECT phase, checkpoint_seq, records_committed, checkpoint_time
FROM batch_audit_log
WHERE job_id = 'BILL_BATCH_JOB_001'
AND run_date = TRUNC(SYSDATE)
ORDER BY checkpoint_time DESC;
```

**Step 6: Restart batch from Phase 3 (Invoice Generation)**
If Phase 1 and Phase 2 completed successfully, restart from Phase 3:
```bash
./run_billing_batch.sh --job-id BILL_BATCH_JOB_001 --restart-phase 3 --date 2026-08-20
```

**Step 7: Monitor for TEMP warnings**
Watch TEMP tablespace closely during restart. Alert threshold: 75%.

**Step 8: Post-recovery validation**
```sql
SELECT COUNT(*) AS invoices_generated,
       SUM(invoice_amount) AS total_billed,
       MIN(invoice_date) AS earliest,
       MAX(invoice_date) AS latest
FROM invoice_staging
WHERE batch_run_date = TRUNC(SYSDATE);
```
Expected: 1,200,000 invoices for monthly run.

### 2.3 Batch Timeout Recovery
If batch exceeds maximum acceptable duration:

1. Check for lock contention: `SELECT * FROM v$lock WHERE block = 1`
2. Kill blocking sessions if safe
3. Consider reducing parallelism: restart with `--parallelism 2` if resource contention detected

### 2.4 Data Integrity Failure Recovery
If batch completes but reconciliation shows discrepancy:

1. Run reconciliation report:
   ```bash
   ./billing_reconcile.sh --run-date 2026-08-20 --report-only
   ```
2. Identify mismatched accounts
3. Re-process specific accounts:
   ```bash
   ./billing_reprocess.sh --account-ids-file /tmp/mismatch_accounts.txt
   ```

---

## 3. Batch Job Dependencies

```
METER_DATA_EXTRACT (22:00) → STAGING_LOAD (23:00) → BILL_BATCH_JOB_001 (02:00)
BILL_BATCH_JOB_001 → INVOICE_DELIVERY (05:00) → PAYMENT_ALLOCATION (07:00)
```
If BILL_BATCH_JOB_001 fails, INVOICE_DELIVERY and PAYMENT_ALLOCATION will not run. Revenue reporting will be delayed.

---

## 4. Escalation Path
| Severity | Escalation                           | SLA        |
|----------|--------------------------------------|------------|
| P1       | DBA on-call → Head of Operations     | 15 minutes |
| P2       | DBA on-call                          | 1 hour     |
| P3       | Next business day DBA                | 4 hours    |

---

## 5. Contact List
- DBA On-Call: +44 7700 000001 (PagerDuty: BILLING-DBA-ONCALL)
- Batch Operations Lead: batch-ops@company.com
- Billing Platform Owner: billing-team@company.com
""",
    },
    {
        "title": "Network Connectivity Procedures",
        "category": "NETWORK",
        "source": "internal-kb/network-procedures-v1.8",
        "content": """# Network Connectivity Procedures

## 1. Network Troubleshooting Framework

When a network connectivity incident is reported, follow this structured approach to isolate and resolve the issue rapidly.

### 1.1 Initial Triage (First 2 Minutes)
1. Identify the affected services and direction of traffic (inbound/outbound/east-west)
2. Determine if the issue is total loss or partial/intermittent
3. Check network monitoring dashboard: `https://netmon.internal/dashboard`
4. Review recent change log for any network changes in the past 24 hours

---

## 2. Common Connectivity Issues

### 2.1 Service-to-Service Connectivity Loss (Internal)
Symptoms: Microservice A cannot reach Microservice B; connection refused or timeout.

**Diagnosis steps:**
```bash
# From affected service pod/VM, test DNS resolution
nslookup billing-platform.internal
dig billing-platform.internal A

# Test TCP connectivity
nc -zv billing-platform.internal 8080
telnet billing-platform.internal 8080

# Check routing table
ip route show
netstat -rn

# Trace route
traceroute billing-platform.internal
```

**Common causes:**
- DNS record missing or stale (check DNS propagation TTL)
- Security group or firewall rule blocking the port
- Service not listening on expected port (check `ss -tlnp`)
- Load balancer health check failing causing target removal

**Resolution:**
1. Update DNS if record is missing or incorrect
2. Review and update security group rules
3. Restart the target service if it stopped listening
4. Check load balancer target group health and re-register healthy instances

### 2.2 External API Connectivity Loss
Symptoms: Service cannot reach third-party APIs (payment gateway, SMS provider, etc.)

**Diagnosis steps:**
```bash
# Test from application host
curl -v --max-time 10 https://api.payment-gateway.com/health
wget --timeout=10 https://api.sms-provider.com/status

# Test DNS resolution of external endpoint
nslookup api.payment-gateway.com 8.8.8.8

# Check if outbound proxy is required and configured
echo $http_proxy $https_proxy
curl -v --proxy http://proxy.internal:3128 https://api.payment-gateway.com/health
```

**Common causes:**
- Outbound firewall rule blocking HTTPS (port 443) to external ranges
- Proxy configuration missing or incorrect
- Third-party provider outage (check provider status page)
- SSL/TLS certificate validation failure (check certificate chain)

### 2.3 High Latency / Packet Loss
Symptoms: Intermittent timeouts, slow API responses, TCP retransmissions.

**Diagnosis:**
```bash
# Check interface errors
ifconfig eth0 | grep -E 'errors|dropped|overruns'
ip -s link show eth0

# Check for packet loss
ping -c 100 -i 0.2 10.0.1.1 | tail -2

# Monitor in real time
sar -n DEV 1 60

# Check TCP retransmissions
netstat -s | grep retransmit
ss -ti
```

**Resolution:**
- Check NIC for hardware errors; replace if persistent errors
- Check switch port for duplex mismatch: `ethtool eth0`
- Review QoS policies if traffic is being throttled
- Scale up bandwidth if utilisation exceeds 70% sustained

---

## 3. Head-End System (HES) Network Procedures

The HES connects to 45,000+ smart meters via cellular and RF WAN. Connectivity loss here affects meter reading ingestion.

### 3.1 HES WAN Connectivity Loss
1. Check HES management console: `https://hes-mgmt.internal`
2. Verify cellular carrier status (EE, Vodafone, O2)
3. Check WAN router status on affected segment
4. If router unresponsive, initiate remote power cycle via out-of-band management

### 3.2 Meter Communication Failure
If specific meters are unresponsive:
1. Check meter IMSI and network registration status in HES
2. Verify SIM not expired or suspended
3. Use HES diagnostic tool to send wake-up ping to meter
4. Log as field service request if meter remains unresponsive

---

## 4. Network Change Management
All network changes (firewall rules, DNS updates, routing changes) must be:
1. Logged in ServiceNow with a change request
2. Approved by Network Architecture team for production
3. Implemented in DEV/TEST first
4. Rolled back within 15 minutes if unexpected impact observed

**Emergency change process:** For P1 incidents, raise an emergency change record in ServiceNow with the P1 incident linked. DBA/Network approval is still required but can be expedited.
""",
    },
    {
        "title": "Authentication & SSO Troubleshooting",
        "category": "AUTHENTICATION",
        "source": "internal-kb/auth-sso-troubleshooting-v2.0",
        "content": """# Authentication & SSO Troubleshooting Guide

## 1. Authentication Architecture Overview

The platform uses a layered authentication architecture:
- **External users**: SAML 2.0 SSO via Keycloak identity broker → corporate IdP (Azure AD)
- **Internal services**: OAuth 2.0 client credentials flow via Keycloak
- **API partners**: API key authentication via API Gateway
- **Batch jobs**: Database user authentication (Oracle wallet) and service accounts (JWT)

---

## 2. SAML SSO Troubleshooting

### 2.1 SAML Assertion Signature Mismatch
Error: `SAML signature validation failed: Invalid signature`

**Root causes:**
- IdP signing certificate has been rotated but not updated in Keycloak
- Clock skew between IdP and SP (SAML requires clocks within 5 minutes)
- Incorrect signature algorithm (RSA-SHA256 vs RSA-SHA1)
- SAML response is being modified in transit

**Diagnosis:**
1. Download SAML assertion from browser (use SAML Tracer browser extension)
2. Decode the Base64 assertion and inspect the `<Signature>` element
3. Compare signing certificate thumbprint with Keycloak trusted IdP certificates
4. Check Keycloak audit log: Admin Console → Events → Login Events

**Resolution:**
1. Export updated IdP metadata from Azure AD portal
2. Import into Keycloak: Realm Settings → Identity Providers → [Provider] → Import from URL
3. Restart Keycloak sessions: `kcadm.sh delete sessions/realm/YOUR_REALM`

### 2.2 SAML Clock Skew
Error: `SAML assertion not yet valid` or `SAML assertion expired`

**Resolution:**
```bash
# Check NTP sync on all servers
chronyc tracking
timedatectl status

# Force NTP sync
chronyc makestep

# Verify Keycloak clock tolerance (default 30s, increase if needed)
# Keycloak Admin → Realm Settings → Tokens → Clock Skew
```

---

## 3. OAuth 2.0 / JWT Troubleshooting

### 3.1 JWT Validation Failure
Error: `JWT signature verification failed` or `Invalid token`

**Diagnosis:**
```bash
# Decode JWT (without verification) to inspect claims
echo "eyJ..." | cut -d. -f2 | base64 -d | python3 -m json.tool

# Check issuer claim matches expected
# Check exp (expiry) timestamp
# Check aud (audience) claim
```

**Common causes:**
- Token issued by wrong Keycloak realm
- Token expired (`exp` claim in past)
- Signing algorithm mismatch (RS256 vs ES256)
- Wrong audience (`aud` claim)
- Public key not retrieved from correct JWKS endpoint

**JWKS endpoint verification:**
```bash
curl https://keycloak.internal/realms/copilot/protocol/openid-connect/certs
```

### 3.2 Token Expiry Issues
Short-lived access tokens (default 5 minutes) require refresh token handling:
```bash
# Refresh access token
curl -X POST https://keycloak.internal/realms/copilot/protocol/openid-connect/token \
  -d "grant_type=refresh_token" \
  -d "refresh_token=<refresh_token>" \
  -d "client_id=<client_id>" \
  -d "client_secret=<client_secret>"
```

---

## 4. API Key Authentication (API Gateway)

### 4.1 HTTP 401 on Valid API Keys
1. Verify API key is active in API Gateway management console
2. Check key has not exceeded rate limit (HTTP 429 is different error)
3. Verify API key is being sent in correct header: `X-API-Key: <key>` or `Authorization: Bearer <key>`
4. Check if key is scoped to correct API plan/product

### 4.2 HTTP 403 After Successful Authentication
Indicates authorisation failure rather than authentication:
1. Check API key's subscribed API product and plan
2. Verify endpoint is included in the API product
3. Check IP whitelist if configured
4. Review RBAC policy assignments in API Gateway

---

## 5. Database Authentication

### 5.1 Oracle Wallet Authentication
For batch jobs using Oracle wallet:
```bash
# Check wallet status
mkstore -wrl /etc/oracle/wallet -listCredential

# Test wallet connection
sqlplus /@BILPRD01
```

### 5.2 Service Account Lockout
Oracle accounts lock after 10 failed login attempts (default):
```sql
-- Unlock account
ALTER USER BILLING_BATCH_SVC ACCOUNT UNLOCK;

-- Reset failed login count
ALTER PROFILE APP_PROFILE LIMIT FAILED_LOGIN_ATTEMPTS UNLIMITED;
```

---

## 6. Keycloak Admin Procedures

### Keycloak Health Check
```bash
curl https://keycloak.internal/health/ready
curl https://keycloak.internal/health/live
```

### Session Management
```bash
# List active sessions for a user
kcadm.sh get users -r copilot --query username=jsmith | \
  python3 -c "import sys,json; u=json.load(sys.stdin); print(u[0]['id'])" | \
  xargs -I{} kcadm.sh get users/{}/sessions -r copilot

# Force logout all sessions
kcadm.sh delete users/<user_id>/sessions -r copilot
```

### Keycloak Restart (if required)
```bash
sudo systemctl restart keycloak
# or in Kubernetes:
kubectl rollout restart deployment/keycloak -n auth
```
""",
    },
    {
        "title": "API Gateway Operations Guide",
        "category": "API",
        "source": "internal-kb/api-gateway-operations-v1.5",
        "content": """# API Gateway Operations Guide

## 1. API Gateway Architecture

The API Gateway (Kong Enterprise v3.4) serves as the single entry point for all external and partner API traffic. It handles:
- Authentication (API keys, OAuth 2.0, JWT)
- Rate limiting and throttling
- Request/response transformation
- Load balancing across backend services
- SSL termination
- Logging and analytics

**Cluster:** 3-node Kong cluster behind AWS NLB
- `kong-gw-01.internal:8000` (proxy)
- `kong-gw-02.internal:8000` (proxy)
- `kong-gw-03.internal:8000` (proxy)
- `kong-gw-01.internal:8001` (admin API)

---

## 2. Common Operational Issues

### 2.1 HTTP 429 Too Many Requests (Rate Limit)
Partners or consumers hitting rate limits unexpectedly.

**Diagnosis:**
```bash
# Check rate limit counters for a consumer
curl http://kong-gw-01.internal:8001/consumers/<consumer_id>/plugins

# Check current rate limit configuration
curl http://kong-gw-01.internal:8001/plugins?name=rate-limiting

# Check Redis for rate limit keys (if using Redis backend)
redis-cli -h redis.internal keys "kong_rate_limit:*" | head -20
```

**Common causes:**
- Rate limit configured on wrong time window (per-second vs per-minute vs per-hour)
- Consumer assigned to wrong API plan with lower limits
- Rate limit plugin applied at both service and route level (cumulative)
- Configuration change not replicated across cluster nodes

**Resolution:**
1. Identify the consumer and their contracted rate limit tier
2. Update rate limit plugin configuration:
```bash
curl -X PATCH http://kong-gw-01.internal:8001/plugins/<plugin_id> \
  -d "config.minute=1000" \
  -d "config.hour=50000"
```
3. Verify configuration propagated to all nodes (Kong config is DB-backed, auto-sync)

### 2.2 High Upstream Latency / Timeout Errors

**Diagnosis:**
```bash
# Check Kong access logs for upstream response times
tail -f /var/log/kong/access.log | grep '"upstream_response_time"'

# Check upstream service health
curl http://kong-gw-01.internal:8001/upstreams/<upstream_name>/health

# List unhealthy targets
curl http://kong-gw-01.internal:8001/upstreams/<upstream_name>/targets/all
```

**Resolution:**
1. Mark unhealthy targets:
```bash
curl -X POST http://kong-gw-01.internal:8001/upstreams/<upstream_name>/targets/<target_host:port>/unhealthy
```
2. Increase timeout if backend is legitimately slow:
```bash
curl -X PATCH http://kong-gw-01.internal:8001/services/<service_id> \
  -d "read_timeout=60000" \
  -d "write_timeout=60000" \
  -d "connect_timeout=10000"
```

### 2.3 SSL/TLS Certificate Issues
HTTP 502 errors with `SSL_ERROR_RX_RECORD_TOO_LONG` or certificate errors.

**Check certificate expiry:**
```bash
echo | openssl s_client -connect api.company.com:443 2>/dev/null | \
  openssl x509 -noout -dates
```

**Rotate certificate:**
```bash
# Upload new certificate
curl -X POST http://kong-gw-01.internal:8001/certificates \
  -F "cert=@/etc/ssl/certs/api.company.com.crt" \
  -F "key=@/etc/ssl/private/api.company.com.key"

# Associate with SNI
curl -X POST http://kong-gw-01.internal:8001/snis \
  -d "name=api.company.com" \
  -d "certificate.id=<cert_id>"
```

---

## 3. Configuration Management

### Adding a New Route
```bash
# Create service
curl -X POST http://kong-gw-01.internal:8001/services \
  -d "name=billing-api-v2" \
  -d "url=http://billing-platform.internal:8080"

# Create route
curl -X POST http://kong-gw-01.internal:8001/services/billing-api-v2/routes \
  -d "name=billing-v2-route" \
  -d "paths[]=/v2/billing" \
  -d "strip_path=true"
```

### Enabling Rate Limiting on a Service
```bash
curl -X POST http://kong-gw-01.internal:8001/services/billing-api-v2/plugins \
  -d "name=rate-limiting" \
  -d "config.minute=100" \
  -d "config.hour=5000" \
  -d "config.policy=redis" \
  -d "config.redis_host=redis.internal"
```

---

## 4. Monitoring and Alerting

Key metrics to monitor:
- **Request rate**: Target < 10,000 req/min per node before scaling
- **Error rate**: Alert if 5xx errors exceed 1% of traffic
- **Upstream latency**: Alert if p99 exceeds 2s
- **Active connections**: Alert if exceeds 5,000 per node

Prometheus metrics endpoint: `http://kong-gw-01.internal:8001/metrics`

Grafana dashboard: `https://grafana.internal/d/api-gateway`

---

## 5. Kong Cluster Operations

### Health Check
```bash
curl http://kong-gw-01.internal:8001/status
```

### Node Restart (Rolling — zero downtime)
```bash
# Reload configuration without dropping connections
sudo kong reload

# Full restart (drops in-flight requests)
sudo systemctl restart kong
```

### Database Backup
Kong uses PostgreSQL for configuration storage:
```bash
pg_dump -h kong-db.internal -U kong kong > /backup/kong-$(date +%Y%m%d).sql
```
""",
    },
    {
        "title": "Performance Tuning Handbook",
        "category": "PERFORMANCE",
        "source": "internal-kb/performance-tuning-v2.3",
        "content": """# Performance Tuning Handbook

## 1. Performance Investigation Framework

Follow the USE method for systematic performance analysis:
- **Utilisation**: Is the resource busy? (CPU %, disk %, network %)
- **Saturation**: Is the resource overloaded? (queue depth, wait times)
- **Errors**: Are there errors affecting performance? (dropped packets, disk errors)

---

## 2. Database Performance

### 2.1 Oracle Query Performance

**Identify slow queries:**
```sql
SELECT sql_id,
       executions,
       ROUND(elapsed_time / 1000000, 2) AS elapsed_secs,
       ROUND(elapsed_time / NULLIF(executions, 0) / 1000000, 4) AS avg_sec_per_exec,
       ROUND(cpu_time / 1000000, 2) AS cpu_secs,
       buffer_gets,
       disk_reads,
       SUBSTR(sql_text, 1, 120) AS sql_snippet
FROM v$sql
WHERE executions > 10
ORDER BY elapsed_time DESC
FETCH FIRST 20 ROWS ONLY;
```

**Execution plan analysis:**
```sql
EXPLAIN PLAN FOR
SELECT * FROM billing_accounts WHERE account_status = 'ACTIVE' ORDER BY account_id;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'ALLSTATS LAST'));
```

**Common performance anti-patterns:**
1. **Full table scan on large tables**: Add appropriate index
2. **Implicit type conversion**: Ensure bind variable types match column types
3. **Missing join predicates**: Cartesian product creating millions of rows
4. **Function on indexed column**: `WHERE UPPER(email) = 'X'` won't use index on `email`; use function-based index

**Index creation for batch workloads:**
```sql
-- Covering index for billing query
CREATE INDEX idx_billing_acc_status_id
ON billing_accounts (account_status, account_id)
PARALLEL 4;

-- Monitor index usage
SELECT * FROM v$object_usage WHERE index_name = 'IDX_BILLING_ACC_STATUS_ID';
```

### 2.2 PostgreSQL Performance

**Identify slow queries:**
```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration,
       query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
ORDER BY duration DESC;
```

**Check for missing indexes:**
```sql
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'customer_profiles'
AND schemaname = 'public'
ORDER BY n_distinct DESC;

-- Check seq scans on large tables
SELECT relname, seq_scan, idx_scan,
       ROUND(100.0 * idx_scan / NULLIF(seq_scan + idx_scan, 0), 1) AS idx_pct
FROM pg_stat_user_tables
WHERE relname IN ('customer_profiles', 'billing_accounts')
ORDER BY seq_scan DESC;
```

**Vacuum and analyse:**
```sql
-- Check table bloat
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
       n_dead_tup, n_live_tup,
       ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC LIMIT 10;

-- Manual vacuum
VACUUM ANALYZE customer_profiles;
```

---

## 3. Application Performance

### 3.1 JVM Tuning (Java Services)
```bash
# Check GC pressure
jstat -gcutil <pid> 1000 60

# Heap dump for OOM analysis
jmap -dump:format=b,file=/tmp/heap_$(date +%Y%m%d_%H%M%S).hprof <pid>

# GC log analysis
grep "Full GC" /var/log/billing-app/gc.log | tail -20
```

**Recommended JVM flags for batch workloads:**
```bash
-Xms4g -Xmx8g
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200
-XX:+PrintGCDetails -XX:+PrintGCDateStamps
-Xloggc:/var/log/app/gc.log
```

### 3.2 Python Service Performance

**Profile slow endpoints:**
```python
import cProfile
import pstats
import io

pr = cProfile.Profile()
pr.enable()
# ... your code ...
pr.disable()

s = io.StringIO()
ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
ps.print_stats(20)
print(s.getvalue())
```

**Async I/O optimisation:**
- Use `asyncio` for I/O-bound operations
- Connection pooling: minimum pool size = 5, maximum = 20 for production
- Use `uvicorn` with `--workers` set to `2 * CPU_cores + 1`

---

## 4. Infrastructure Performance

### 4.1 CPU Utilisation
```bash
# Real-time CPU breakdown
mpstat -P ALL 2 10

# Top CPU-consuming processes
ps aux --sort=-%cpu | head -20

# CPU steal time (VM environments — indicates host contention)
vmstat 1 10 | awk '{print $16}' # steal time column
```

### 4.2 Memory and Swap
```bash
# Check memory usage
free -h
cat /proc/meminfo | grep -E 'MemTotal|MemFree|Cached|SwapUsed'

# Check for swap usage (performance killer)
swapon --show
vmstat 1 5 | awk '{print $7, $8}' # si/so columns

# If swap is active, identify the swapping process
for pid in $(ls /proc | grep '^[0-9]'); do
  awk '/VmSwap/{print '$pid' " " $2}' /proc/$pid/status 2>/dev/null
done | sort -k2 -rn | head -10
```

### 4.3 Disk I/O
```bash
# I/O statistics per device
iostat -x 2 10

# Identify top I/O processes
iotop -ao --only

# Check for disk queue saturation (await > 20ms is concerning)
iostat -x | awk 'NR>2 {if ($14 > 20) print $1, "await:", $14, "ms"}'
```

### 4.4 Network Throughput
```bash
# Monitor interface throughput
sar -n DEV 1 30

# Check for bandwidth saturation
ifstat -i eth0 1 30

# Identify top network connections
ss -tnp | sort -k 4
nethogs eth0
```

---

## 5. Performance Benchmarks and Baselines

| Metric                        | Good      | Warning   | Critical  |
|-------------------------------|-----------|-----------|-----------|
| API p99 latency               | < 500ms   | 500ms–2s  | > 2s      |
| CPU utilisation (sustained)   | < 60%     | 60–80%    | > 80%     |
| Memory utilisation            | < 75%     | 75–90%    | > 90%     |
| Oracle TEMP tablespace        | < 70%     | 70–85%    | > 85%     |
| PostgreSQL connection pool    | < 60%     | 60–80%    | > 80%     |
| Disk I/O await                | < 5ms     | 5–20ms    | > 20ms    |
| Batch job throughput          | > 10K/min | 5–10K/min | < 5K/min  |

---

## 6. Capacity Planning
Review capacity monthly for PROD systems. Trigger scaling review when any metric sustains Warning level for more than 72 hours. All capacity changes require a change request and architecture review for changes > 50% of current allocation.
""",
    },
]


def seed_kb_documents() -> None:
    db = SessionLocal()
    try:
        created = 0
        for doc in KB_DOCUMENTS:
            existing = db.query(KbDocument).filter(KbDocument.title == doc["title"]).first()
            if existing:
                print(f"  [skip] '{doc['title']}' already exists")
                continue
            document = KbDocument(
                title=doc["title"],
                category=doc["category"],
                content=doc["content"],
                source=doc["source"],
            )
            db.add(document)
            created += 1
            words = len(doc["content"].split())
            print(f"  [+] '{doc['title']}' ({doc['category']}, {words} words)")
        db.commit()
        print(f"KB documents seeded: {created} created, {len(KB_DOCUMENTS) - created} skipped")
    finally:
        db.close()


if __name__ == "__main__":
    print("Seeding KB documents...")
    seed_kb_documents()
    print("Done.")
