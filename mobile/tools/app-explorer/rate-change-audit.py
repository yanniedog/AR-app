"""Reconcile actual emulator banners with the immutable full-tier archive."""
import base64
import gzip
import hashlib
import json
import re
import subprocess
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import sys
from functools import lru_cache
from pathlib import Path

BASE = "https://ar-app-data.jkokavec.workers.dev/v1/release/"
OBSERVATIONS = {"rate", "comparison_rate", "ongoing_rate", "last_updated", "rate_index",
                "exact_alert_eligible", "bank_rate_tier"}


def percent(value):
    if value == 0:
        return "0%"
    number = Decimal(str(value))
    precision = Decimal(1).scaleb(number.adjusted() - 2)
    return f"{number.quantize(precision, rounding=ROUND_HALF_UP):f}%"


def signature(row):
    return json.dumps({k: v for k, v in row.items() if k not in OBSERVATIONS}, sort_keys=True)


def archive_moves(core, catalogue):
    days = catalogue["run_dates"]
    result = {}
    for section, tiers in catalogue["sections"].items():
        indexed = {signature(t["row"]): t["spans"] for t in tiers}
        for row in core["sections"][section]["rates"]:
            spans = indexed.get(signature(row), [])
            last = move = None
            next_position = 0
            for start, count, values, _ in spans:
                if start != next_position or len(values) != 1:
                    last = move = None
                next_position = start + count
                if len(values) == 1:
                    value = round(values[0], 9)
                    if last is not None and last != value:
                        move = (days[start - 1], last, days[start], value)
                    last = value
            key = (section, row["product_key"], row.get("rate_index"))
            current = float(row["rate"])
            if current <= 1:
                current *= 100
            valid = move and days[next_position - 1] == core["run_date"] and abs(last - current) < 1e-7
            result[key] = move if valid and key not in result else None
    return result


def checked(data, digest):
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("Historical source checksum mismatch")
    return data


@lru_cache(maxsize=2)
def publication(tag, digest):
    if not re.fullmatch(r"app-payload-\d{4}-\d{2}-\d{2}(?:-r\d+)?", tag or ""):
        raise ValueError(f"Unpinned publication {tag}")
    def read(name):
        if "/" in name:
            raise ValueError("Invalid asset name")
        return subprocess.check_output(["curl", "--fail", "--silent", "--show-error", "--location",
                                        "--retry", "2", "--max-time", "60", BASE + tag + "/" + name])
    manifest = json.loads(read("manifest.json"))
    def asset(desc):
        return json.loads(gzip.decompress(checked(read(desc["name"]), desc["sha256"])))
    core_desc = manifest["files"]["core"]
    if core_desc["sha256"] != digest:
        raise ValueError("Emulator and archive core editions differ")
    core = asset(core_desc)
    archive = asset(manifest["bank_rate_history_catalogue"]["file"])
    if archive["core_sha256"] != digest:
        raise ValueError("Catalogue belongs to a different core")
    envelope = archive["catalogue"]
    catalogue = json.loads(checked(gzip.decompress(base64.b64decode(envelope["gzip_base64"])), envelope["sha256"]))
    moves = archive_moves(core, catalogue)
    published = core.get("exact_rate_moves")
    if published is not None:
        actual = {(sec, product, int(index)): move for sec, products in published.items()
                  for product, items in products.items() for index, move in items.items()}
        expected = {key: move for key, move in moves.items() if move and type(key[2]) is int}
        if actual.keys() != expected.keys():
            raise ValueError(f"Incomplete or spurious movements in {tag}: {len(actual.keys() ^ expected.keys())} offers")
        for key, (prior, before, day, after) in expected.items():
            recorded = actual[key]
            if (recorded[0] != prior or recorded[2] != day or
                    abs(recorded[1] * 100 - before) > 1e-7 or abs(recorded[3] * 100 - after) > 1e-7):
                raise ValueError(f"{key}: published {recorded}, archive {expected[key]}")
        print(f"{tag}: reconciled {len(expected)} changes across {len(moves)} catalogue rows")
    return moves, core


def audit(directory):
    device_day = date.fromisoformat(subprocess.check_output(
        ["adb", "shell", "date", "+%Y-%m-%d"], text=True).strip())
    covered = set()
    verified_income_plus = set()
    for file in Path(directory).rglob("*.nodes.json"):
        nodes = json.loads(file.read_text())["nodes"]
        labels = [n.get("text") or n.get("desc") or "" for n in nodes]
        banners = [s for s in labels if re.search(r"(Best advertised|Advertised rate) [↑↓].* → ", s)]
        heroes = [n for n in nodes if n.get("id", "").startswith('["rate-evidence",')]
        if banners and not heroes:
            raise ValueError(f"{file.name}: change banner without source identity: {banners}")
        for hero in heroes:
            _, tag, digest, section, product, index = json.loads(hero["id"])
            moves, core = publication(tag, digest)
            key = (section, product, index)
            covered.add(key)
            move = moves.get(key)
            for banner in banners:
                if not move:
                    raise ValueError(f"{key}: no matching archived change for {banner}")
                _, before, day, after = move
                bps = round((after - before) * 100, 1)
                expected = f"{'↑' if bps > 0 else '↓'} {abs(bps):g} bps"
                endpoints = f"{percent(before)} → {percent(after)}"
                observed = date.fromisoformat(day)
                age = (device_day - observed).days
                when = ("today" if age <= 0 else "yesterday" if age == 1 else
                        f"{age} days ago" if age < 7 else f"{observed.day} {observed:%b %Y}")
                # Australian short month spelling differs between ICU and Python.
                normalised = banner.replace("Sept ", "Sep ")
                if f"{expected} · {when} · {endpoints}" not in normalised:
                    raise ValueError(f"{key}: {banner}; archive {move}")
                if section == "TD" and product.split("|")[1:2] == ["3b2158a8-34ee-4cb2-870d-1b741ad6e77e"]:
                    selected = [r for r in core["sections"][section]["rates"] if r.get("product_key") == product
                                and r.get("rate_index") == index and r.get("term") == "P12M"
                                and r.get("interest_payment") == "monthly"]
                    if len(selected) == 1 and hero.get("text") == percent(after):
                        verified_income_plus.add((tag, banner))
            # Fail on missing genuine movements for straightforward advertised prices.
            if core.get("exact_rate_moves") is not None and move and 'Rate' in labels and hero.get("text") == percent(move[3]) and not banners:
                raise ValueError(f"{key}: missing advertised change {move}")
    if not verified_income_plus:
        raise ValueError("Income Plus regression screen was not verified")
    for tag, banner in sorted(verified_income_plus):
        print(f"Income Plus 12 months monthly | {tag} | {banner}")
    print(f"Exact rate history checked on {len(covered)} distinct emulator offers")


if __name__ == "__main__":
    audit(sys.argv[1])
