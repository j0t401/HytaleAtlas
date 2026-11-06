"""Round-trip a numerical prefab through both documented CLI formats."""
import importlib.util
import json
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("prefab_assets", ROOT / "tools/prefab-assets.py")
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)
manifest = json.loads((ROOT / "site/data/native-prefabs/manifest.json").read_text(encoding="utf-8"))
reference = json.loads((ROOT / "tests/fixtures/prefab-references.json").read_text(encoding="utf-8"))[0]
name = reference["path"]
small = {**manifest, "prefabs": {name: manifest["prefabs"][name]}}
with tempfile.TemporaryDirectory(prefix="atlas-prefab-test-") as temporary:
    root = Path(temporary)
    source = root / "input"
    source.mkdir()
    (source / "manifest.json").write_text(json.dumps(small), encoding="utf-8")
    filename = manifest["prefabs"][name]["data"] + ".apf"
    (source / filename).write_bytes((ROOT / "site/data/native-prefabs" / filename).read_bytes())
    assets.convert(source, root / "unpacked", unpack=True)
    assets.convert(root / "unpacked", root / "repacked")
    rebuilt = json.loads((root / "repacked/manifest.json").read_text(encoding="utf-8"))
    before = assets.read_prefab(source, small, small["prefabs"][name])
    after = assets.read_prefab(root / "repacked", rebuilt, rebuilt["prefabs"][name])
    assert before == after
print("Prefab CLI round-trip preserved all blocks and metadata")
