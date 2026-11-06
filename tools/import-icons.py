"""Import supplied PNG icons once, deduplicate by content and write a browser manifest."""

import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1] / "site")
    args = parser.parse_args()
    root = args.source
    target = args.site / "assets/icons"
    target.mkdir(parents=True, exist_ok=True)
    entries = {}

    def add(key, folder, name):
        source = root / folder / (name + ".png")
        if not source.exists():
            return
        data = source.read_bytes()
        filename = hashlib.sha256(data).hexdigest()[:20] + ".png"
        (target / filename).write_bytes(data)
        entries[key] = "assets/icons/" + filename

    for key, name in {
        "structures": "estructuras",
        "golems": "golems",
        "mob": "mobs",
        "wood": "maderas",
        "ore": "minerales",
        "chest": "cofres",
    }.items():
        add("family:" + key, "01_categorias_principales", name)
    for key, name in {
        "portal": "portal",
        "temple": "templo",
        "dungeon": "mazmorras",
        "mine": "minas",
        "shipwreck": "naufragios",
        "ruins": "ruinas",
        "village": "aldeas",
        "farm": "granjas",
        "camp": "campamentos",
        "statue": "estatuas",
        "bridge": "puentes",
        "tower": "torres",
        "house": "casas",
        "altar": "altares",
        "tomb": "tumbas",
        "other": "otras_estructuras",
    }.items():
        add("structure:" + key, "02_estructuras", name)
    add("unique:spawn", "02_estructuras", "spawn")
    for key, name in {
        "Copper": "cobre",
        "Iron": "hierro",
        "Silver": "plata",
        "Gold": "oro",
        "Thorium": "torio",
        "Cobalt": "cobalto",
        "Adamantite": "adamantita",
        "Mithril": "mitrilo",
    }.items():
        add("ore:" + key, "04_minerales", name)
    for key, name in {
        "Golem_Crystal_Earth": "golem_cristal_tierra",
        "Golem_Crystal_Flame": "golem_brasa",
        "Golem_Crystal_Frost": "golem_escarcha",
        "Golem_Crystal_Sand": "golem_arena",
        "Golem_Crystal_Thunder": "golem_trueno",
        "Golem_Firesteel": "golem_acero_igneo",
        "Golem_Guardian_Void": "golem_guardian_vacio",
    }.items():
        add("mob:" + key, "05_golems", name)
    for key, name in {
        "Oak": "roble",
        "Birch": "abedul",
        "Fir": "abeto",
        "Aspen": "alamo",
        "Camphor": "alcanfor",
        "Amber": "ambar",
        "Bottletree": "arbol_botella",
        "Maple": "arce",
        "Azure": "azure",
        "Bamboo": "bambu",
        "Banyan": "banyan",
        "Cedar": "cedro",
        "Stormbark": "corteza_tormenta",
        "Crystal": "cristal",
        "Poisoned": "envenenada",
        "Spiral": "espiral",
        "Ash": "fresno",
        "Fire": "fuego",
        "Wisteria_Wild": "glicinia_salvaje",
        "Gumboab": "gumboab",
        "Beech": "haya",
        "Ice": "hielo_frostwood",
        "Fig_Blue": "higo_azul",
        "Apple": "manzano",
        "Palm": "palmera",
        "Palo": "palo",
        "Petrified": "petrificada",
        "Burnt": "quemada",
        "Gnarled": "raices_retorcidas",
        "Sallow": "sauce_dorado",
        "Sadwillow": "sauce_lloron",
        "Windwillow": "sauce_viento",
        "Dry": "seca",
        "Redwood": "secuoya",
        "Jungle": "selva",
        "Goldenwood": "tronco_dorado",
        "Mushroom_Yellow": "seta_amarilla",
        "Mushroom_Blue": "seta_azul",
        "Mushroom_White": "seta_blanca",
        "Mushroom_Brown": "seta_marron",
        "Mushroom_Purple": "seta_purpura",
        "Mushroom_Red": "seta_roja",
        "Mushroom_Green": "seta_verde",
    }.items():
        add("wood:" + key, "07_maderas", name)
    mobs = {
        "Wraith": "aparecido_wraith",
        "Spider_Cave": "arana_cuevas",
        "Dragon_Frost": "dragon_escarcha",
        "Scorpion": "escorpion",
        "Skeleton_Sand_Soldier": "esqueleto_arena",
        "Skeleton_Archer": "esqueleto_arquero",
        "Skeleton_Knight": "esqueleto_caballero",
        "Skeleton_Frost_Soldier": "esqueleto_escarcha",
        "Skeleton_Mage": "esqueleto_mago",
        "Feran_Civilian": "feran_civil",
        "Feran_Burrower": "feran_madriguera_burrower",
        "Outlander_Berserker": "forastero_berserker",
        "Outlander_Cultist": "forastero_cultista",
        "Goblin_Scrapper": "goblin_chatarrero_scrapper",
        "Goblin_Glutton": "goblin_gloton",
        "Goblin_Burner": "goblin_incendiario_burner",
        "Goblin_Thief": "goblin_ladron",
        "Kweebec_Sapling": "kweebec_brote_sapling",
        "Kweebec_Sproutling": "kweebec_rootling",
        "Larva_Void": "larva_del_vacio",
        "Wolf_White": "lobo_blanco",
        "Wolf_Black": "lobo_negro",
        "Bat": "murcielago",
        "Bear_Grizzly": "oso_grizzly",
        "Crawler_Void": "reptador_del_vacio",
        "Scarak_Defender": "scarak_defensor",
        "Scarak_Fighter": "scarak_guerrero",
        "Scarak_Broodmother": "scarak_reina_broodmother",
        "Hedera": "the_hedera",
        "Trork_Shaman": "trork_chaman",
        "Trork_Warrior": "trork_guerrero",
        "Trork_Chieftain": "trork_jefe_chieftain",
        "Trork_Brawler": "trork_luchador_brawler",
    }
    for key, name in mobs.items():
        add("mob:" + key, "08_mobs_fijos", name)
    for key, name in {
        "surface": "biomas_superficie",
        "underground": "zonas_subterraneas",
        "grid": "cuadricula_coordenadas",
    }.items():
        add("layer:" + key, "03_capas_mapa", name)
    entries["container:all"] = entries["family:chest"]
    entries["family:kweebec"] = entries.get("mob:Kweebec_Sproutling", entries["structure:village"])
    entries["family:outlander"] = entries.get("mob:Outlander_Cultist", entries["structure:temple"])
    entries["family:iconic"] = entries.get("mob:Dragon_Frost", entries["family:mob"])
    for key in ["kweebec", "kweebec-camp", "kweebec-garden"]:
        entries["structure:" + key] = entries["family:kweebec"]
    for key in ["outlander", "outlander-camp", "outlander-temple"]:
        entries["structure:" + key] = entries["family:outlander"]
    manifest = {
        "entries": entries,
        "provenance": "PNG files supplied by the project owner; see THIRD_PARTY.md. Original pixels are retained; shared sizing and rarity frames are rendered by the Atlas UI.",
    }
    (target / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "mappedKeys": len(entries),
                "uniquePNGs": len(set(entries.values())),
                "bytes": sum(p.stat().st_size for p in target.glob("*.png")),
            }
        )
    )


if __name__ == "__main__":
    main()
