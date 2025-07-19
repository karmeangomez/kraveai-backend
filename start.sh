#!/bin/bash
source /home/karmean/kraveai-backend/venv/bin/activate
cd /home/karmean/kraveai-backend
uvicorn src.main:app --host 0.0.0.0 --port 8000
