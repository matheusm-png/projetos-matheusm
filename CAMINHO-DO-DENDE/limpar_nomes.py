import os
import shutil

base_path = "/Users/matheusmoitinh0/Documents/PROJETOS 2026/CAMINHODODENDE/CAMINHO-DO-DENDE/assets/cardapio"

def sanitize(name):
    replacements = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'ã': 'a', 'õ': 'o', 'ç': 'c', ' ': '-', '́': ''
    }
    new_name = name.lower()
    for old, new in replacements.items():
        new_name = new_name.replace(old, new)
    # Remove any other non-ascii chars just in case
    return "".join(c for i, c in enumerate(new_name) if ord(c) < 128)

if os.path.exists(base_path):
    files = os.listdir(base_path)
    for filename in files:
        if filename.startswith('.'): continue
        new_filename = sanitize(filename)
        if new_filename != filename:
            old_file = os.path.join(base_path, filename)
            new_file = os.path.join(base_path, new_filename)
            os.rename(old_file, new_file)
            print(f"Renomeado: {filename} -> {new_filename}")
    print("Sucesso!")
else:
    print("Pasta não encontrada.")
