
👨‍💻 Bienvenido, Karmean – Raspberry Pi lista 🚀

karmean@raspberrypi:~/kraveai-backend$ cd ~/kraveai-backend
rm -rf venv
karmean@raspberrypi:~/kraveai-backend$ python3 -m venv venv
source venv/bin/activate
(venv) karmean@raspberrypi:~/kraveai-backend$ pip install --upgrade pip
pip install -r requirements.txt
Looking in indexes: https://pypi.org/simple, https://www.piwheels.org/simple
Requirement already satisfied: pip in ./venv/lib/python3.11/site-packages (23.0.1)
Collecting pip
  Using cached pip-25.1.1-py3-none-any.whl (1.8 MB)
Installing collected packages: pip
  Attempting uninstall: pip
    Found existing installation: pip 23.0.1
    Uninstalling pip-23.0.1:
      Successfully uninstalled pip-23.0.1
Successfully installed pip-25.1.1
Looking in indexes: https://pypi.org/simple, https://www.piwheels.org/simple
Collecting fastapi==0.100.0 (from -r requirements.txt (line 1))
  Using cached https://www.piwheels.org/simple/fastapi/fastapi-0.100.0-py3-none-any.whl (65 kB)
Collecting uvicorn==0.22.0 (from -r requirements.txt (line 2))
  Using cached https://www.piwheels.org/simple/uvicorn/uvicorn-0.22.0-py3-none-any.whl (58 kB)
Collecting instagrapi==1.19.8 (from -r requirements.txt (line 3))
  Using cached https://archive1.piwheels.org/simple/instagrapi/instagrapi-1.19.8-py3-none-any.whl (109 kB)
Collecting pydantic==1.10.9 (from -r requirements.txt (line 4))
  Using cached pydantic-1.10.9-py3-none-any.whl.metadata (147 kB)
Collecting python-dotenv (from -r requirements.txt (line 5))
  Using cached python_dotenv-1.1.1-py3-none-any.whl.metadata (24 kB)
Collecting pillow==10.3.0 (from -r requirements.txt (line 6))
  Using cached pillow-10.3.0-cp311-cp311-manylinux_2_28_aarch64.whl.metadata (9.2 kB)
Collecting requests (from -r requirements.txt (line 7))
  Using cached requests-2.32.4-py3-none-any.whl.metadata (4.9 kB)
Collecting starlette<0.28.0,>=0.27.0 (from fastapi==0.100.0->-r requirements.txt (line 1))
  Using cached https://www.piwheels.org/simple/starlette/starlette-0.27.0-py3-none-any.whl (66 kB)
Collecting typing-extensions>=4.5.0 (from fastapi==0.100.0->-r requirements.txt (line 1))
  Using cached typing_extensions-4.14.1-py3-none-any.whl.metadata (3.0 kB)
Collecting click>=7.0 (from uvicorn==0.22.0->-r requirements.txt (line 2))
  Using cached click-8.2.1-py3-none-any.whl.metadata (2.5 kB)
Collecting h11>=0.8 (from uvicorn==0.22.0->-r requirements.txt (line 2))
  Using cached h11-0.16.0-py3-none-any.whl.metadata (8.3 kB)
Collecting PySocks==1.7.1 (from instagrapi==1.19.8->-r requirements.txt (line 3))
  Using cached https://www.piwheels.org/simple/pysocks/PySocks-1.7.1-py3-none-any.whl (16 kB)
Collecting pycryptodomex==3.18.0 (from instagrapi==1.19.8->-r requirements.txt (line 3))
  Using cached pycryptodomex-3.18.0-cp35-abi3-manylinux2014_aarch64.whl.metadata (3.3 kB)
Collecting charset_normalizer<4,>=2 (from requests->-r requirements.txt (line 7))
  Using cached charset_normalizer-3.4.2-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl.metadata (35 kB)
Collecting idna<4,>=2.5 (from requests->-r requirements.txt (line 7))
  Using cached https://www.piwheels.org/simple/idna/idna-3.10-py3-none-any.whl (70 kB)
Collecting urllib3<3,>=1.21.1 (from requests->-r requirements.txt (line 7))
  Using cached urllib3-2.5.0-py3-none-any.whl.metadata (6.5 kB)
Collecting certifi>=2017.4.17 (from requests->-r requirements.txt (line 7))
  Downloading certifi-2025.7.14-py3-none-any.whl.metadata (2.4 kB)
Collecting anyio<5,>=3.4.0 (from starlette<0.28.0,>=0.27.0->fastapi==0.100.0->-r requirements.txt (line 1))
  Using cached https://www.piwheels.org/simple/anyio/anyio-4.9.0-py3-none-any.whl (100 kB)
Collecting sniffio>=1.1 (from anyio<5,>=3.4.0->starlette<0.28.0,>=0.27.0->fastapi==0.100.0->-r requirements.txt (line 1))
  Using cached https://www.piwheels.org/simple/sniffio/sniffio-1.3.1-py3-none-any.whl (10 kB)
Using cached pydantic-1.10.9-py3-none-any.whl (157 kB)
Using cached pillow-10.3.0-cp311-cp311-manylinux_2_28_aarch64.whl (4.3 MB)
Using cached pycryptodomex-3.18.0-cp35-abi3-manylinux2014_aarch64.whl (2.1 MB)
Using cached requests-2.32.4-py3-none-any.whl (64 kB)
Using cached charset_normalizer-3.4.2-cp311-cp311-manylinux_2_17_aarch64.manylinux2014_aarch64.whl (142 kB)
Using cached urllib3-2.5.0-py3-none-any.whl (129 kB)
Using cached python_dotenv-1.1.1-py3-none-any.whl (20 kB)
Downloading certifi-2025.7.14-py3-none-any.whl (162 kB)
Using cached click-8.2.1-py3-none-any.whl (102 kB)
Using cached h11-0.16.0-py3-none-any.whl (37 kB)
Using cached typing_extensions-4.14.1-py3-none-any.whl (43 kB)
Installing collected packages: urllib3, typing-extensions, sniffio, python-dotenv, PySocks, pycryptodomex, pillow, idna, h11, click, charset_normalizer, certifi, uvicorn, requests, pydantic, anyio, starlette, instagrapi, fastapi
Successfully installed PySocks-1.7.1 anyio-4.9.0 certifi-2025.7.14 charset_normalizer-3.4.2 click-8.2.1 fastapi-0.100.0 h11-0.16.0 idna-3.10 instagrapi-1.19.8 pillow-10.3.0 pycryptodomex-3.18.0 pydantic-1.10.9 python-dotenv-1.1.1 requests-2.32.4 sniffio-1.3.1 starlette-0.27.0 typing-extensions-4.14.1 urllib3-2.5.0 uvicorn-0.22.0
(venv) karmean@raspberrypi:~/kraveai-backend$ fastapi
uvicorn
python-dotenv
pydantic
instagrapi
bash: fastapi: command not found
Usage: uvicorn [OPTIONS] APP
Try 'uvicorn --help' for help.

Error: Missing argument 'APP'.
Usage: python-dotenv [OPTIONS] COMMAND [ARGS]...

  This script is used to set, get or unset values from a .env file.

Options:
  -f, --file PATH                 Location of the .env file, defaults to .env
                                  file in current working directory.
  -q, --quote [always|never|auto]
                                  Whether to quote or not the variable values.
                                  Default mode is always. This does not affect
                                  parsing.
  -e, --export BOOLEAN            Whether to write the dot file as an
                                  executable bash script.
  --version                       Show the version and exit.
  --help                          Show this message and exit.

Commands:
  get    Retrieve the value for the given key.
  list   Display all the stored key/value.
  run    Run command with environment variables present.
  set    Store the given key/value.
  unset  Removes the given key.
bash: pydantic: command not found
bash: instagrapi: command not found
(venv) karmean@raspberrypi:~/kraveai-backend$ pip install -r requirements.txt
Looking in indexes: https://pypi.org/simple, https://www.piwheels.org/simple
Requirement already satisfied: fastapi==0.100.0 in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 1)) (0.100.0)
Requirement already satisfied: uvicorn==0.22.0 in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 2)) (0.22.0)
Requirement already satisfied: instagrapi==1.19.8 in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 3)) (1.19.8)
Requirement already satisfied: pydantic==1.10.9 in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 4)) (1.10.9)
Requirement already satisfied: python-dotenv in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 5)) (1.1.1)
Requirement already satisfied: pillow==10.3.0 in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 6)) (10.3.0)
Requirement already satisfied: requests in ./venv/lib/python3.11/site-packages (from -r requirements.txt (line 7)) (2.32.4)
Requirement already satisfied: starlette<0.28.0,>=0.27.0 in ./venv/lib/python3.11/site-packages (from fastapi==0.100.0->-r requirements.txt (line 1)) (0.27.0)
Requirement already satisfied: typing-extensions>=4.5.0 in ./venv/lib/python3.11/site-packages (from fastapi==0.100.0->-r requirements.txt (line 1)) (4.14.1)
Requirement already satisfied: click>=7.0 in ./venv/lib/python3.11/site-packages (from uvicorn==0.22.0->-r requirements.txt (line 2)) (8.2.1)
Requirement already satisfied: h11>=0.8 in ./venv/lib/python3.11/site-packages (from uvicorn==0.22.0->-r requirements.txt (line 2)) (0.16.0)
Requirement already satisfied: PySocks==1.7.1 in ./venv/lib/python3.11/site-packages (from instagrapi==1.19.8->-r requirements.txt (line 3)) (1.7.1)
Requirement already satisfied: pycryptodomex==3.18.0 in ./venv/lib/python3.11/site-packages (from instagrapi==1.19.8->-r requirements.txt (line 3)) (3.18.0)
Requirement already satisfied: charset_normalizer<4,>=2 in ./venv/lib/python3.11/site-packages (from requests->-r requirements.txt (line 7)) (3.4.2)
Requirement already satisfied: idna<4,>=2.5 in ./venv/lib/python3.11/site-packages (from requests->-r requirements.txt (line 7)) (3.10)
Requirement already satisfied: urllib3<3,>=1.21.1 in ./venv/lib/python3.11/site-packages (from requests->-r requirements.txt (line 7)) (2.5.0)
Requirement already satisfied: certifi>=2017.4.17 in ./venv/lib/python3.11/site-packages (from requests->-r requirements.txt (line 7)) (2025.7.14)
Requirement already satisfied: anyio<5,>=3.4.0 in ./venv/lib/python3.11/site-packages (from starlette<0.28.0,>=0.27.0->fastapi==0.100.0->-r requirements.txt (line 1)) (4.9.0)
Requirement already satisfied: sniffio>=1.1 in ./venv/lib/python3.11/site-packages (from anyio<5,>=3.4.0->starlette<0.28.0,>=0.27.0->fastapi==0.100.0->-r requirements.txt (line 1)) (1.3.1)
(venv) karmean@raspberrypi:~/kraveai-backend$ pm2 delete backend
pm2 start bash --name backend -- -c "source /home/karmean/kraveai-backend/venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 8000"
pm2 save
[PM2] Applying action deleteProcessId on app [backend](ids: [ 1 ])
[PM2] [backend](1) ✓
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ tunnel             │ fork     │ 1804 │ online    │ 200%     │ 21.9mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
[PM2] Starting /usr/bin/bash in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 2  │ backend            │ fork     │ 0    │ online    │ 0%       │ 6.2mb    │
│ 0  │ tunnel             │ fork     │ 1804 │ online    │ 0%       │ 29.4mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
[PM2] Saving current process list...
[PM2] Successfully saved in /home/karmean/.pm2/dump.pm2
(venv) karmean@raspberrypi:~/kraveai-backend$ curl https://api.kraveapi.xyz/health
{"status":"OK","versión":"v2.3 - estable","service":"KraveAI Python","login":"Fallido"}(venv) karmean@raspberrypi:~/kraveai-bapm2 flush2 flush
[PM2] Flushing /home/karmean/.pm2/pm2.log
[PM2] Flushing:
[PM2] /home/karmean/.pm2/logs/tunnel-out.log
[PM2] /home/karmean/.pm2/logs/tunnel-error.log
[PM2] Flushing:
[PM2] /home/karmean/.pm2/logs/backend-out.log
[PM2] /home/karmean/.pm2/logs/backend-error.log
[PM2] Logs flushed
(venv) karmean@raspberrypi:~/kraveai-backend$ 
