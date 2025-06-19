# verificacion_fallback.py

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

def obtener_codigo_visual(email):
    nombre, dominio = email.split("@")
    url = f"https://email-fake.com/{dominio}/{nombre}"

    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")

    driver = webdriver.Chrome(options=chrome_options)
    driver.get("https://email-fake.com")
    driver.execute_script("window.open('');")
    driver.switch_to.window(driver.window_handles[1])
    driver.get(url)

    print(f"Esperando código en {url}...")

    # Espera hasta que el título no diga "Fake"
    while True:
        titulo = driver.title
        if titulo.startswith("Fake") or "email" in titulo.lower():
            time.sleep(2)
            driver.refresh()
        else:
            break

    codigo = titulo[:6]
    driver.quit()
    return codigo
