"""Losslessly pack/unpack the Atlas numerical prefab format (stdlib only)."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import zlib

MAGIC = b"ATPF"
RECORD_BYTES = 44


def read_prefab(directory, manifest, record):
    if manifest["format"] == 2:
        metadata = json.loads((directory / (record["data"] + ".json")).read_text(encoding="utf-8"))
        blocks = zlib.decompress((directory / (record["data"] + ".binz")).read_bytes())
    elif manifest["format"] == 3:
        payload = (directory / (record["data"] + ".apf")).read_bytes()
        if payload[:4] != MAGIC:
            raise ValueError("Invalid ATPF header")
        length = struct.unpack_from("<I", payload, 4)[0]
        metadata = json.loads(zlib.decompress(payload[8 : 8 + length]))
        blocks = zlib.decompress(payload[8 + length :])
    else:
        raise ValueError("Unsupported manifest format")
    if len(blocks) != metadata["blockCount"] * RECORD_BYTES:
        raise ValueError("Invalid prefab block count")
    return metadata, blocks


def convert(source, destination, unpack=False):
    source, destination = source.resolve(), destination.resolve()
    if source == destination or source in destination.parents:
        raise ValueError("Use a separate output folder outside the input directory")
    if destination.exists() and any(destination.iterdir()):
        raise ValueError("Output folder must be empty")
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    result = {**manifest, "format": 2 if unpack else 3, "prefabs": {}}
    result["recordBytes"] = RECORD_BYTES
    result["compression"] = "zlib" if unpack else "zlib-segments"
    if not unpack:
        result["container"] = (
            "ATPF + u32le compressed metadata length + zlib UTF-8 JSON + zlib 44-byte block records"
        )
    else:
        result.pop("container", None)
    destination.mkdir(parents=True, exist_ok=True)
    original_bytes = output_bytes = 0
    for path, record in manifest["prefabs"].items():
        metadata, blocks = read_prefab(source, manifest, record)
        encoded = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        encoded = zlib.compress(encoded, 9)
        compressed_blocks = (
            (source / (record["data"] + ".binz")).read_bytes()
            if manifest["format"] == 2
            else zlib.compress(blocks, 9)
        )
        packed = MAGIC + struct.pack("<I", len(encoded)) + encoded + compressed_blocks
        key = hashlib.sha256(packed).hexdigest()[:24]
        target = {**record, "data": key}
        if unpack:
            (destination / (key + ".json")).write_text(
                json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            (destination / (key + ".binz")).write_bytes(zlib.compress(blocks, 6))
        else:
            (destination / (key + ".apf")).write_bytes(packed)
        result["prefabs"][path] = target
        # Validate the actual serialized output, not just the in-memory representation.
        restored_metadata, restored_blocks = read_prefab(destination, result, target)
        if restored_metadata != metadata or restored_blocks != blocks:
            raise ValueError("Round-trip mismatch: " + path)
        suffixes = (".json", ".binz") if manifest["format"] == 2 else (".apf",)
        original_bytes += sum((source / (record["data"] + ext)).stat().st_size for ext in suffixes)
        output_bytes += sum(
            (destination / (key + ext)).stat().st_size
            for ext in ((".json", ".binz") if unpack else (".apf",))
        )
    (destination / "manifest.json").write_text(
        json.dumps(result, separators=(",", ":")), encoding="utf-8"
    )
    if (source / "geometry.json").exists():
        shutil.copy2(source / "geometry.json", destination / "geometry.json")
    return {
        "prefabs": len(result["prefabs"]),
        "inputBytes": original_bytes,
        "outputBytes": output_bytes,
        "roundTripErrors": 0,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--unpack", action="store_true")
    args = parser.parse_args()
    print(json.dumps(convert(args.source, args.destination, args.unpack), indent=2))


if __name__ == "__main__":
    main()
