import json
import random
import os
from datetime import datetime, timedelta

PROXY_FILE = os.path.join(os.path.dirname(__file__), "proxies.json")

def load_proxies():
    with open(PROXY_FILE, "r") as f:
        return json.load(f)

def save_proxies(proxies):
    with open(PROXY_FILE, "w") as f:
        json.dump(proxies, f, indent=2)

def get_next_proxy():
    proxies = load_proxies()
    now = datetime.utcnow()

    available = [
        p for p in proxies
        if p["status"] == "ok" and (
            not p.get("lastUsed") or
            datetime.strptime(p["lastUsed"], "%Y-%m-%dT%H:%M:%S") < now - timedelta(minutes=3)
        )
    ]

    if not available:
        return None

    proxy = random.choice(available)
    proxy["lastUsed"] = now.strftime("%Y-%m-%dT%H:%M:%S")
    save_proxies(proxies)
    return proxy["proxy"]

def mark_failed(bad_proxy):
    proxies = load_proxies()
    for p in proxies:
        if p["proxy"] == bad_proxy:
            p["status"] = "fail"
            break
    save_proxies(proxies)
