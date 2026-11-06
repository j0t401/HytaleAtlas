"""Rebuild lightweight prefab indexes from the numerical profile shipped with Atlas."""

import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import struct


def load_json(path):
    raw = path.read_bytes()
    if path.suffix == ".gz":
        raw = gzip.decompress(raw)
    return json.loads(raw)


def write_gzip(path, value):
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.write_bytes(gzip.compress(raw, mtime=0))


def canonical(path):
    return path.removesuffix(".prefab.json").removesuffix(".lpf")


def rebuild(site, catalog):
    data = site / "data"
    rules = load_json(data / "world-rules.json")
    world = load_json(site / "engine/worldgen.json.gz")
    caves = load_json(site / "engine/caves.json.gz")
    manifest = load_json(data / "native-prefabs/manifest.json")
    dataset = world["datasetId"]
    if any(value.get("datasetId") != dataset for value in (rules, caves, manifest)):
        raise ValueError("Do not combine different numerical extractions")
    spec = importlib.util.spec_from_file_location(
        "prefab_assets", Path(__file__).with_name("prefab-assets.py")
    )
    assets = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(assets)
    resources = rules["catalog"]["resources"]
    mob_path = data / "mob-spawns.json.gz"
    if mob_path.exists():
        mob_profile = load_json(mob_path)
        if mob_profile["datasetId"] != dataset:
            raise ValueError("Mob profile does not match numerical extraction")
        for key, value in mob_profile["mobs"].items():
            catalog[key] = {**catalog.get(key, {}), **value}
    eligible = {}
    for rule in rules["catalog"]["markerRules"]:
        choices = [c for c in rule["choices"] if c.get("mob") and c["relativeWeight"] > 0]
        fixed = (
            not rule["manualTrigger"]
            and rule["maxHorizontalSpawnOffset"] == 0
            and choices
            and not any(c.get("flock") for c in choices)
            and len({c["mob"] for c in choices}) == 1
        )
        eligible[rule["id"]] = [
            {
                "key": "mob:" + role,
                "markerId": rule["id"],
                "conditional": not bool(fixed),
                "manualTrigger": rule["manualTrigger"],
                "horizontalRadius": rule["maxHorizontalSpawnOffset"],
            }
            for role in sorted({c["mob"] for c in choices})
        ]
    shape_paths = {
        p["path"]
        for n in caves["nodes"]
        if n.get("type") == "PrefabCaveNodeShape$PrefabCaveNodeShapeGenerator"
        for p in n["prefabs"]
    }
    prefabs, heights = {}, {}
    for path, record in manifest["prefabs"].items():
        metadata, blocks = assets.read_prefab(data / "native-prefabs", manifest, record)
        points, grouped = [], {}
        for marker in metadata["markers"]:
            for choice in eligible.get(marker["marker"], []):
                points.append(
                    {**choice, "kind": "mob", **{axis: marker[axis] for axis in ("x", "y", "z")}}
                )
        for block in struct.iter_unpack("<5if5i", blocks):
            x, y, z, block_id, mask, chance = block[:6]
            if mask & 4 and chance < 1:
                continue
            name = world["blockNames"].get(str(block_id), "")
            resource = resources.get(str(block_id))
            if resource:
                key, kind = resource["key"], resource["kind"]
            elif "Chest" in name or "Container_" in name:
                key, kind = "container:all", "chest"
            else:
                continue
            point = {"key": key, "kind": kind, "x": x, "y": y, "z": z}
            if kind == "chest":
                points.append(point)
            elif key not in grouped:
                grouped[key] = point
        points.extend(grouped.values())
        children = []
        for child in metadata["children"]:
            for choice in child.get("choices", []):
                if child.get("weights", {}).get(choice["name"], child.get("defaultWeight", 1)) <= 0:
                    continue
                conditional = len(child["choices"]) != 1 or child["inheritHeightCondition"]
                children.append(
                    {
                        **{k: child[k] for k in ("x", "y", "z", "rotation", "fitHeightmap")},
                        "path": canonical(choice["path"]),
                        "conditional": bool(conditional),
                    }
                )
        prefabs[path] = {"points": points, "children": children}
        if path in shape_paths:
            heights[path] = [
                [
                    x,
                    z,
                    struct.unpack_from("<i", blocks, start * 44 + 4)[0],
                    struct.unpack_from("<i", blocks, (start + count - 1) * 44 + 4)[0],
                ]
                for x, z, start, count in metadata["columns"]
                if count
            ]

    def keys(path, seen=None):
        seen = set() if seen is None else seen
        if path in seen:
            return set()
        seen.add(path)
        prefab = prefabs.get(path, {})
        result = {p["key"] for p in prefab.get("points", [])}
        for child in prefab.get("children", []):
            result |= keys(child["path"], seen)
        return result

    for path, prefab in prefabs.items():
        prefab["keys"] = sorted(keys(path))
    result = {
        "datasetId": dataset,
        "prefabs": {p: v for p, v in prefabs.items() if v["keys"]},
        "types": catalog,
        "semantics": "Prefab resource anchors and all positive marker choices. Conditional children and spawn choices are explicitly possible, never guaranteed. Final masks and live NPC conditions are separate.",
    }
    result["revision"] = hashlib.sha256(
        json.dumps(result, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    write_gzip(data / "poi-contents.json.gz", result)
    write_gzip(data / "poi-columns.json.gz", heights)
    return {
        "prefabs": len(result["prefabs"]),
        "columnPrefabs": len(heights),
        "revision": result["revision"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1] / "site")
    parser.add_argument("--catalog", type=Path)
    parser.add_argument("--export-catalog", type=Path)
    args = parser.parse_args()
    old = load_json(args.site / "data/poi-contents.json.gz")
    if args.export_catalog:
        args.export_catalog.parent.mkdir(parents=True, exist_ok=True)
        args.export_catalog.write_text(
            json.dumps(old["types"], ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        return
    catalog = load_json(args.catalog) if args.catalog else old["types"]
    if not isinstance(catalog, dict) or not all(isinstance(v, dict) for v in catalog.values()):
        raise ValueError("Catalog must map type keys to metadata objects")
    print(json.dumps(rebuild(args.site, catalog), indent=2))


if __name__ == "__main__":
    main()
