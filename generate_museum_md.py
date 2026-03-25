#!/usr/bin/env python3

import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_FILE = PROJECT_ROOT / "museum.md"

# Keep a predictable order for the rendered markdown sections.
CHAIN_ORDER = ["bitcoin", "ethereum", "cardano"]


def load_chain_data(chain_name: str) -> dict:
    with (DATA_DIR / f"{chain_name}.json").open("r", encoding="utf-8") as file:
        return json.load(file)


def chain_heading(chain_name: str) -> str:
    return chain_name.capitalize()


def normalize_tx_entry(entry) -> dict | None:
    """Return {"hash": str, "description": str} or None for invalid entries."""
    if isinstance(entry, str) and entry.strip():
        return {"hash": entry.strip(), "description": ""}
    if isinstance(entry, dict):
        h = (entry.get("hash") or "").strip() if isinstance(entry.get("hash"), str) else ""
        if h:
            desc = (entry.get("description") or "").strip() if isinstance(entry.get("description"), str) else ""
            return {"hash": h, "description": desc}
    return None


def render_event(event: dict, explorer_base: str) -> list[str]:
    lines: list[str] = []
    title = (event.get("title") or "").strip() or "Untitled Event"
    description = (event.get("description") or "").strip() or "Description coming soon."
    tx_entries = [
        e for e in (normalize_tx_entry(h) for h in (event.get("tx_hashes") or [])) if e is not None
    ]

    lines.append(f"- **{title}**")
    lines.append(f"  - {description}")

    if tx_entries:
        lines.append("  - Transactions:")
        for tx in tx_entries:
            tx_url = f"{explorer_base}{tx['hash']}"
            label = f"`{tx['hash']}`"
            if tx["description"]:
                label += f" — {tx['description']}"
            lines.append(f"    - [{label}]({tx_url})")
    else:
        lines.append("  - Transactions: None listed")

    return lines


def build_markdown() -> str:
    lines: list[str] = ["# Museum of Blockchain History", ""]

    for chain_name in CHAIN_ORDER:
        chain_data = load_chain_data(chain_name)
        explorer_base = (chain_data.get("settings") or {}).get("explorer", "")
        events = chain_data.get("events") or []

        lines.append(f"## {chain_heading(chain_name)}")
        lines.append("")

        if not events:
            lines.append("- No events available.")
            lines.append("")
            continue

        for event in events:
            lines.extend(render_event(event, explorer_base))
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()

    markdown = build_markdown()
    OUTPUT_FILE.write_text(markdown, encoding="utf-8")
    print(f"Created {OUTPUT_FILE.name}")


if __name__ == "__main__":
    main()
