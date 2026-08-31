# Zabbix → Alert Buddy integration

Alert Buddy is the **gateway** for every monitoring system. Zabbix, Grafana (and
anything added later) POST to a webhook; Alert Buddy normalises the payload,
routes it to whoever is on standby, falls back to a broadcast, records history
and auto-closes the alert when a recovery event arrives.

```
Zabbix trigger ──> Media type (webhook) ──> POST /api/webhooks/zabbix ──┐
Grafana alert  ──> Contact point         ──> POST /api/webhooks/grafana ─┤
                                                                         ▼
                                            dispatchAlerts()  → standby / broadcast
                                                              → Firestore history
                                                              → auto-resolve on recovery
```

- Endpoint: `POST https://<your-host>/api/webhooks/zabbix`
- Auth: HTTP Basic (`WEBHOOK_USER` / `WEBHOOK_PASSWORD`) **or** Bearer (`WEBHOOK_TOKEN`)
- Back-compat: the old `POST /api/grafana/webhook` still works.

---

## 1. Server config

Set at least one credential style in the backend environment:

```bash
WEBHOOK_USER=alertbuddy
WEBHOOK_PASSWORD=<long-random-string>
# and/or
WEBHOOK_TOKEN=<long-random-string>
```

Existing `GRAFANA_WEBHOOK_USER` / `GRAFANA_WEBHOOK_PASSWORD` are still honoured, so
current Grafana setups keep working with no change.

---

## 2. Create the Zabbix media type

**Administration → Media types → Create media type**

| Field | Value |
|-------|-------|
| Name  | `Alert Buddy` |
| Type  | `Webhook` |
| Script | *(paste the script below)* |
| Timeout | `10s` |
| Process tags | `No` |

### Parameters

| Name | Value |
|------|-------|
| `URL` | `https://<your-host>/api/webhooks/zabbix` |
| `Token` | `<WEBHOOK_TOKEN>` *(omit if you use Basic auth in the URL instead)* |
| `alertId` | `{EVENT.ID}` |
| `eventValue` | `{EVENT.VALUE}` |
| `eventUpdateStatus` | `{EVENT.UPDATE.STATUS}` |
| `eventNSeverity` | `{EVENT.NSEVERITY}` |
| `severity` | `{EVENT.SEVERITY}` |
| `name` | `{EVENT.NAME}` |
| `host` | `{HOST.NAME}` |
| `hostGroups` | `{TRIGGER.HOSTGROUP.NAME}` |
| `opdata` | `{EVENT.OPDATA}` |
| `tags` | `{EVENT.TAGSJSON}` |
| `url` | `{$ZABBIX.URL}/tr_events.php?triggerid={TRIGGER.ID}&eventid={EVENT.ID}` |

### Script

```javascript
var AlertBuddy = {
    params: {},

    request: function () {
        var req = new HttpRequest();
        req.addHeader('Content-Type: application/json');
        if (AlertBuddy.params.Token) {
            req.addHeader('Authorization: Bearer ' + AlertBuddy.params.Token);
        }

        var payload = JSON.stringify(AlertBuddy.params);
        Zabbix.log(4, '[Alert Buddy] POST ' + AlertBuddy.params.URL + ' ' + payload);

        var body = req.post(AlertBuddy.params.URL, payload);
        var status = req.getStatus();

        if (status < 200 || status >= 300) {
            throw 'Alert Buddy responded ' + status + ': ' + body;
        }
        return body;
    }
};

try {
    AlertBuddy.params = JSON.parse(value);
    if (!AlertBuddy.params.URL) {
        throw 'missing "URL" parameter';
    }
    return AlertBuddy.request();
} catch (error) {
    Zabbix.log(3, '[Alert Buddy] webhook failed: ' + error);
    throw 'Alert Buddy webhook failed: ' + error;
}
```

> Using HTTP Basic instead of a token? Drop the `Token` parameter and put the
> credentials in the URL: `https://alertbuddy:password@<your-host>/api/webhooks/zabbix`.

### Message templates

On the media type's **Message templates** tab add at least:

| Message type | Subject | Message |
|--------------|---------|---------|
| Problem | `{EVENT.NAME}` | `{EVENT.OPDATA}` |
| Problem recovery | `RESOLVED: {EVENT.NAME}` | `{EVENT.RECOVERY.NAME}` |

---

## 3. Wire it to a user + action

1. **Users → *your notification user* → Media** → add `Alert Buddy`, "send to" can
   be any non-empty string (e.g. `alert-buddy`), severities = all you care about.
2. **Alerts → Actions → Trigger actions** → in the action's **Operations**,
   **Recovery operations** and **Update operations**, send a message via the
   `Alert Buddy` media type. Recovery operations are what let Alert Buddy
   auto-close the alert.

---

## 4. Channel routing

Alert Buddy maps each alert to an Alert Buddy channel using, in priority order:

1. an event **tag** `channel=<id>` (e.g. `channel=core-monitoring`)
2. the host group name (`{TRIGGER.HOSTGROUP.NAME}`)
3. the host name

Add a `channel` tag on the trigger, template or host to route deterministically.
Unmapped alerts fall back to **VSA IT Crisis War Room**. Known values:

| Tag / group value | Channel |
|-------------------|---------|
| `core-monitoring` | Core Services Monitoring |
| `infra-alerts` | Cloud Infrastructure Alerts |
| `api-gateway` | External API Gateway |
| `db-health` | Database Health Cluster |
| `nemo` | Nemo |
| `infinity dal ms` | Infinity DAL MS |

(full list + runtime additions in `backend/server/alert-routing.ts`)

## 5. Severity mapping

| Zabbix (`{EVENT.NSEVERITY}` / name) | Alert Buddy |
|------------------------------------|-------------|
| 5 Disaster, 4 High | `CRITICAL` |
| 3 Average, 2 Warning | `WARNING` |
| 1 Information, 0 Not classified | `INFO` |

---

## 6. Test without Zabbix

```bash
curl -u alertbuddy:change-me -X POST https://<your-host>/api/webhooks/zabbix \
  -H 'Content-Type: application/json' \
  -d '{
    "alertId": "99001",
    "eventValue": "1",
    "severity": "High",
    "name": "High CPU load on web01",
    "host": "web01",
    "opdata": "Current value: 96 %",
    "tags": "[{\"tag\":\"channel\",\"value\":\"core-monitoring\"}]"
  }'
```

Recovery (auto-closes alert `zbx-99001`):

```bash
curl -u alertbuddy:change-me -X POST https://<your-host>/api/webhooks/zabbix \
  -H 'Content-Type: application/json' \
  -d '{ "alertId": "99001", "eventValue": "0", "name": "High CPU load on web01", "host": "web01" }'
```

The Alerts page in the portal also has **Test Grafana** / **Test Zabbix** buttons
that exercise the same pipeline (via `POST /api/webhooks/test`).
