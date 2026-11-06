'use strict';
function installV1FixedSpawns(Kernel) {
  const P = Kernel.prototype;
  P.fixedRole = function (rule) {
    if (!rule || rule.manualTrigger !== false || rule.maxHorizontalSpawnOffset !== 0) return null;
    const choices = rule.choices.filter((c) => c.weight > 0);
    if (!choices.length || choices.some((c) => c.flock)) return null;
    const roles = new Set(choices.map((c) => c.mob));
    return roles.size === 1 ? [...roles][0] : null;
  };
  P.fixedSpawnAnchors = function (profiles, structures) {
    if (profiles.version !== this.raw.version) throw Error('Fixed spawn profile version mismatch');
    const markers = [];
    for (const structure of structures) {
      const profile = profiles.structures[structure.name];
      if (!profile) continue;
      if (profile.prefabPath !== structure.prefabPath || profile.rotation !== structure.rotation)
        throw Error('Unsupported fixed spawn prefab variant ' + structure.name);
      for (const anchor of profile.anchors) {
        const rule = profiles.rules[anchor.marker],
          mob = this.fixedRole(rule);
        if (!mob) continue;
        const x = anchor.x - 0.5,
          z = anchor.z - 0.5;
        let rx, rz;
        switch (structure.rotation) {
          case 'ROTATION_0':
            rx = x;
            rz = z;
            break;
          case 'ROTATION_90':
            rx = z;
            rz = -x;
            break;
          case 'ROTATION_180':
            rx = -x;
            rz = -z;
            break;
          case 'ROTATION_270':
            rx = -z;
            rz = x;
            break;
          default:
            throw Error('Unsupported prefab rotation');
        }
        markers.push({
          mob,
          marker: anchor.marker,
          structure: structure.name,
          x: rx + 0.5 + structure.x,
          y: anchor.y + structure.y,
          z: rz + 0.5 + structure.z,
          verticalSearch: rule.maxVerticalSpawnOffset,
          maxDropHeight: rule.maxDropHeight,
          meaning:
            'Fixed horizontal spawn anchor; Y is marker height, not the final adjusted creature position.',
        });
      }
    }
    return markers;
  };
}
if (typeof module !== 'undefined') module.exports = installV1FixedSpawns;
else installV1FixedSpawns(globalThis.V1Kernel);
