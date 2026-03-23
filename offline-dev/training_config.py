import json
import os
from copy import deepcopy
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = BASE_DIR / "config" / "default.json"


def _deep_merge(base, override):
    merged = deepcopy(base)
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _read_json(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def load_training_config(config_path=None):
    config = _read_json(DEFAULT_CONFIG_PATH)

    candidate = config_path or os.getenv("TRAINING_CONFIG")
    if candidate:
        override_path = Path(candidate)
        if not override_path.is_absolute():
            override_path = (BASE_DIR / override_path).resolve()
        if not override_path.exists():
            raise FileNotFoundError(f"Config file not found: {override_path}")
        override = _read_json(override_path)
        config = _deep_merge(config, override)
        return config, str(override_path)

    return config, str(DEFAULT_CONFIG_PATH)
