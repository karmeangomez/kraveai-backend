#!/bin/bash
cd /home/karmean/kraveai-backend/
source venv/bin/activate
exec uvicorn src.main:app --host 127.0.0.1 --port 8000
