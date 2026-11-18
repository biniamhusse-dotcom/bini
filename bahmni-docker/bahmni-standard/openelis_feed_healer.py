#!/usr/bin/env python3
import subprocess
import time
import datetime
import os
import re

LOG_FILE = "/var/log/openelis_feed_healer.log"

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass

def psql(query):
    cmd = [
        "docker", "exec", "bahmni-standard-openelisdb-1",
        "psql", "-U", "clinlims", "-d", "clinlims", "-t", "-A", "-c", query
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
        if res.returncode == 0:
            return res.stdout.strip()
        else:
            return None
    except Exception as e:
        return None

def check_and_heal():
    # 1. Clean failed events that have exceeded retries or are permanently unresolvable (500/404)
    failed_rows = psql("SELECT id, retries, left(error_message, 120) FROM clinlims.failed_events;")
    if failed_rows:
        for row in failed_rows.splitlines():
            parts = row.split("|")
            if len(parts) >= 2:
                fid = parts[0].strip()
                try:
                    retries = int(parts[1].strip())
                except ValueError:
                    retries = 0
                err = parts[2].strip() if len(parts) > 2 else ""
                
                # If retries >= 2 or error is 500 / 404 / NPE
                if retries >= 2 or "500" in err or "404" in err or "NullPointer" in err:
                    log(f"Auto-removing stuck failed_event id={fid} (retries={retries}, err={err[:60]})")
                    psql(f"DELETE FROM clinlims.failed_events WHERE id = {fid};")

    # 2. Check encounter markers against dead history (page <= 20)
    marker_uri = psql("SELECT feed_uri_for_last_read_entry FROM clinlims.markers WHERE feed_uri LIKE '%encounter%' LIMIT 1;")
    if marker_uri:
        m = re.search(r'/encounter/(\d+)', marker_uri)
        if m:
            page_num = int(m.group(1))
            if page_num < 20:
                log(f"Encounter marker is at page {page_num} (< 20 dead pages). Fast-forwarding past dead events to page 20.")
                sql_ff = """
                UPDATE clinlims.markers 
                SET feed_uri_for_last_read_entry = 'http://openmrs:8080/openmrs/ws/atomfeed/encounter/20',
                    last_read_entry_id = 'tag:atomfeed.ict4h.org:791558f2-18bd-4c45-a4dd-86e8625668ba'
                WHERE feed_uri LIKE '%encounter%';
                """
                psql(sql_ff)

    # 3. Check Quartz cron scheduler liveness
    last_run_str = psql("SELECT last_run FROM clinlims.quartz_cron_scheduler WHERE name = 'atom-feed-openmrs-encounter';")
    if last_run_str:
        age_seconds_str = psql("SELECT EXTRACT(EPOCH FROM (NOW() - last_run)) FROM clinlims.quartz_cron_scheduler WHERE name = 'atom-feed-openmrs-encounter';")
        if age_seconds_str:
            try:
                age_seconds = float(age_seconds_str)
                if age_seconds > 180: # 3 minutes without running
                    log(f"WARNING: OpenELIS encounter feed job stalled! Last run was {age_seconds:.0f}s ago. Restarting openelis container (fast stop)...")
                    subprocess.run(["docker", "restart", "-t", "3", "bahmni-standard-openelis-1"], timeout=30)
                    log("OpenELIS container restarted successfully.")
            except ValueError:
                pass

def main():
    log("Starting OpenELIS Feed Auto-Healer Daemon...")
    while True:
        try:
            check_and_heal()
        except Exception as e:
            log(f"Error in check_and_heal loop: {e}")
        time.sleep(20)

if __name__ == "__main__":
    main()
