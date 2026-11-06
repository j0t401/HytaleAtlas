"""Audit NPC spawn coverage and extract habitat rules for the included numerical profile.

Development-only: reads Assets.zip and the matching server manifest, never ships game files.
Environment IDs are exact matches: NPCSpawn resolves each configured name directly.
"""

import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import struct
import zipfile
import zlib


def load(path):
    b = path.read_bytes()
    return json.loads(gzip.decompress(b) if path.suffix == ".gz" else b)


def build(site, assets, server):
    profile = load(site.parent / "CONJUNTO-DATOS.json")
    with zipfile.ZipFile(server) as jar:
        manifest = jar.read("META-INF/MANIFEST.MF").decode()
    if profile["version"] not in [
        line.partition(":")[2].strip()
        for line in manifest.splitlines()
        if line.startswith("Implementation-Version:")
    ]:
        raise ValueError("Server version does not match the included numerical profile")
    rules = load(site / "data/world-rules.json")
    strata = load(site / "engine/strata.json.gz")
    prefabs = load(site / "data/native-prefabs/manifest.json")
    assert rules["datasetId"] == strata["datasetId"] == prefabs["datasetId"] == profile["datasetId"]
    environment_ids = {v["name"]: int(k) for k, v in strata["catalog"].items()}
    references = collections.defaultdict(list)
    for path, record in prefabs["prefabs"].items():
        b = (site / "data/native-prefabs" / (record["data"] + ".apf")).read_bytes()
        n = struct.unpack_from("<I", b, 4)[0]
        meta = json.loads(zlib.decompress(b[8 : 8 + n]))
        for marker in meta["markers"]:
            references[marker["marker"]].append(path)
    mobs = {}
    labels = load(site / "data/display-names.json")
    source_hash = hashlib.sha256()
    with zipfile.ZipFile(assets) as archive:
        names = archive.namelist()
        languages = {}
        for language in ("en-US", "es-ES"):
            text = archive.read("Server/Languages/" + language + "/server.lang").decode("utf-8")
            languages[language] = dict(
                line.split("=", 1)
                for line in text.splitlines()
                if "=" in line and not line.startswith("#")
            )
            languages[language] = {k.strip(): v.strip() for k, v in languages[language].items()}

        def mob(role):
            key = "mob:" + role
            if key not in mobs:
                english = languages["en-US"].get(
                    "npcRoles." + role + ".name", labels.get(key, role.replace("_", " "))
                )
                display = languages["es-ES"].get("npcRoles." + role + ".name", english)
                mobs[key] = {
                    "key": key,
                    "kind": "mob",
                    "name": display,
                    "searchNames": [english, role],
                    "habitats": [],
                    "markers": [],
                    "events": [],
                }
            return mobs[key]

        # Inspect all role files; retain non-test variants and every role referenced by a spawn rule.
        role_count = 0
        role_files_inspected = 0
        for name in names:
            if not name.startswith("Server/NPC/Roles/") or not name.endswith(".json"):
                continue
            value = json.loads(archive.read(name))
            if (
                value.get("Type") != "Variant"
                or any(part in name.split("/") for part in ("_Core", "Templates", "Tests", "Debug"))
                or Path(name).stem.startswith("Test_")
            ):
                continue
            role_count += 1
            mob(Path(name).stem)
        world_files = 0
        for name in names:
            if not name.startswith(
                ("Server/NPC/Spawn/World/", "Server/NPC/Spawn/Beacons/")
            ) or not name.endswith(".json"):
                continue
            world_files += 1
            raw = archive.read(name)
            source_hash.update(name.encode() + raw)
            value = json.loads(raw)
            for npc in value["NPCs"]:
                if npc.get("Weight", 1) <= 0 or not npc.get("Id"):
                    continue
                data = {
                    "source": "beacon" if "/Beacons/" in name else "world",
                    "rule": Path(name).stem,
                    "environments": value["Environments"],
                    "environmentIds": [
                        environment_ids[e] for e in value["Environments"] if e in environment_ids
                    ],
                    "weight": npc.get("Weight", 1),
                }
                for k in (
                    "DayTimeRange",
                    "LightRanges",
                    "MoonPhaseWeightModifiers",
                    "Despawn",
                    "SpawnRadius",
                    "MinDistanceFromPlayer",
                    "MaxSpawnedNPCs",
                    "ConcurrentSpawnsRange",
                    "SpawnAfterGameTimeRange",
                ):
                    if k in value:
                        data[k] = value[k]
                for k in ("SpawnBlockSet", "SpawnFluidTag", "Flock"):
                    if k in npc:
                        data[k] = npc[k]
                mob(npc["Id"])["habitats"].append(data)
        for name in names:
            if name.startswith("Server/NPC/Spawn/Beacons/") and name.endswith(".json"):
                for npc in json.loads(archive.read(name)).get("NPCs", []):
                    if npc.get("Id") and npc.get("Weight", 1) > 0:
                        mob(npc["Id"])["events"].append(Path(name).stem)
    marker_choices = 0
    for rule in rules["catalog"]["markerRules"]:
        choices = [c for c in rule["choices"] if c.get("mob") and c.get("relativeWeight", 0) > 0]
        fixed = (
            not rule["manualTrigger"]
            and rule["maxHorizontalSpawnOffset"] == 0
            and choices
            and not any(c.get("flock") for c in choices)
            and len({c["mob"] for c in choices}) == 1
        )
        for role in {c["mob"] for c in choices}:
            marker_choices += 1
            mob(role)["markers"].append(
                {
                    "rule": rule["id"],
                    "prefabCount": len(references[rule["id"]]),
                    "fixed": bool(fixed),
                    "manualTrigger": rule["manualTrigger"],
                    "horizontalRadius": rule["maxHorizontalSpawnOffset"],
                }
            )
    for key, data in mobs.items():
        data["habitatEnvironments"] = sorted(
            {e for h in data["habitats"] for e in h["environmentIds"]}
        )
        data["fixedPrefabCount"] = sum(m["prefabCount"] for m in data["markers"] if m["fixed"])
        data["possiblePrefabCount"] = sum(
            m["prefabCount"] for m in data["markers"] if not m["fixed"]
        )
        data["available"] = bool(
            data["habitatEnvironments"] or data["fixedPrefabCount"] or data["possiblePrefabCount"]
        )
        data["spawnMode"] = (
            "fixed"
            if data["fixedPrefabCount"]
            else (
                "possible-marker"
                if data["possiblePrefabCount"]
                else "habitat" if data["habitatEnvironments"] else "unlocated"
            )
        )
        data["description"] = " · ".join(
            [
                *data["searchNames"],
                "Anclas fijas" if data["fixedPrefabCount"] else "",
                (
                    "Zona posible de aparición, no individuo garantizado"
                    if data["habitatEnvironments"]
                    else ""
                ),
                "Marcadores condicionales" if data["possiblePrefabCount"] else "",
                "Sin ubicación identificada en este perfil V1" if not data["available"] else "",
            ]
        )
        data["description"] = " · ".join(part for part in data["description"].split(" · ") if part)
        if key == "mob:Bear_Grizzly":
            data["description"] += " · oso grizzly grizly grezly oso pardo"
    result = {
        "datasetId": profile["datasetId"],
        "version": profile["version"],
        "sourceDigest": source_hash.hexdigest(),
        "environmentSemantics": "Exact environment IDs, no inferred parent habitats. Conditions are displayed, not simulated live.",
        "mobs": mobs,
    }
    result["revision"] = hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    encoded = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()
    (site / "data/mob-spawns.json.gz").write_bytes(gzip.compress(encoded, mtime=0))
    counts = collections.Counter(d["spawnMode"] for d in mobs.values())
    audit = {
        "atlasVersion": "0.12.0",
        "nativeProfile": profile["version"],
        "datasetId": profile["datasetId"],
        "spawnConfigurationFiles": world_files,
        "roleFilesInspected": role_files_inspected,
        "concreteRoleFilesInspected": role_count,
        "roleSelection": "Non-test Variant roles plus every role referenced by world, beacon or marker spawning. Components, templates and cinematic-only Generic definitions are excluded unless referenced.",
        "catalogMobs": len(mobs),
        "markerRulesInspected": len(rules["catalog"]["markerRules"]),
        "prefabsInspected": len(prefabs["prefabs"]),
        "markerChoicesInspected": marker_choices,
        "coverage": dict(counts),
        "habitatMobs": sum(bool(d["habitatEnvironments"]) for d in mobs.values()),
        "unlocated": [
            {
                "key": k,
                "name": d["name"],
                "reason": "events/instances or no located source in included V1 data",
                "events": d["events"],
            }
            for k, d in mobs.items()
            if not d["available"]
        ],
        "grizzly": mobs["mob:Bear_Grizzly"],
        "scope": "Habitat eligibility and prefab anchors, not a prediction of living NPC positions. Test templates excluded; source version checked against server manifest.",
    }
    dest = site.parent / "docs/validation/mob-coverage-0.12.0.json"
    dest.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "catalogMobs": len(mobs),
                "coverage": dict(counts),
                "habitatMobs": audit["habitatMobs"],
                "gzipBytes": (site / "data/mob-spawns.json.gz").stat().st_size,
            }
        )
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--server", type=Path, required=True)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1] / "site")
    args = parser.parse_args()
    build(args.site, args.assets, args.server)


if __name__ == "__main__":
    main()
