import os
import random
from pathlib import Path

PROXY_FILE = Path("src/proxies/proxies.txt")

def load_proxies():
    proxies = []
    if PROXY_FILE.exists():
        with open(PROXY_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line: continue
                if "@" in line:
                    proxies.append(f"http://{line}")
                elif line.count(":") == 3:
                    host, port, user, pwd = line.split(":")
                    proxies.append(f"http://{user}:{pwd}@{host}:{port}")
                elif line.count(":") == 1:
                    proxies.append(f"http://{line}")
    return proxies

def get_random_proxy(proxies):
    if proxies:
        return random.choice(proxies)
    return None
