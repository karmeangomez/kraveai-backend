#!/usr/bin/env python3
import argparse
import sys
from login_utils import login_instagram, guardar_sesion

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("username", help="Usuario de Instagram")
    parser.add_argument("password", help="Contraseña")
    args = parser.parse_args()

    print(f"🚀 Login para @{args.username}")
    try:
        cl = login_instagram(args.username, args.password)
        if cl:
            guardar_sesion(cl, args.username)
            print(f"✅ Sesión guardada para @{args.username}")
            sys.exit(0)
    except Exception as e:
        print(f"❌ Error: {e}")
    sys.exit(1)

if __name__ == "__main__":
    main()
