'use strict';
// Three-dimensional numerical V1 port; development-time comparison required.
const OLD_GRAD3 = [
    [-11.0, 4.0, 4.0],
    [-4.0, 11.0, 4.0],
    [-4.0, 4.0, 11.0],
    [11.0, 4.0, 4.0],
    [4.0, 11.0, 4.0],
    [4.0, 4.0, 11.0],
    [-11.0, -4.0, 4.0],
    [-4.0, -11.0, 4.0],
    [-4.0, -4.0, 11.0],
    [11.0, -4.0, 4.0],
    [4.0, -11.0, 4.0],
    [4.0, -4.0, 11.0],
    [-11.0, 4.0, -4.0],
    [-4.0, 11.0, -4.0],
    [-4.0, 4.0, -11.0],
    [11.0, 4.0, -4.0],
    [4.0, 11.0, -4.0],
    [4.0, 4.0, -11.0],
    [-11.0, -4.0, -4.0],
    [-4.0, -11.0, -4.0],
    [-4.0, -4.0, -11.0],
    [11.0, -4.0, -4.0],
    [4.0, -11.0, -4.0],
    [4.0, -4.0, -11.0],
  ],
  GRAD3 = [
    [1.0, 1.0, 0.0],
    [-1.0, 1.0, 0.0],
    [1.0, -1.0, 0.0],
    [-1.0, -1.0, 0.0],
    [1.0, 0.0, 1.0],
    [-1.0, 0.0, 1.0],
    [1.0, 0.0, -1.0],
    [-1.0, 0.0, -1.0],
    [0.0, 1.0, 1.0],
    [0.0, -1.0, 1.0],
    [0.0, 1.0, -1.0],
    [0.0, -1.0, -1.0],
    [1.0, 1.0, 0.0],
    [0.0, -1.0, 1.0],
    [-1.0, 1.0, 0.0],
    [0.0, -1.0, -1.0],
  ];
const fastFloor3 = (x) => (x >= 0 ? Math.trunc(x) : Math.trunc(x) - 1);
function noiseHash3(seed, x, y, z) {
  let h = seed ^ Math.imul(1619, x) ^ Math.imul(31337, y) ^ Math.imul(6971, z);
  h = Math.imul(Math.imul(Math.imul(h, h), h), 60493);
  return (h >> 13) ^ h;
}
function oldExtrapolate3(seed, x, y, z, dx, dy, dz) {
  const h = noiseHash3(seed, x, y, z),
    g = OLD_GRAD3[((h % 24) + 24) % 24];
  return dx * g[0] + dy * g[1] + dz * g[2];
}
function grad3(seed, x, y, z, dx, dy, dz) {
  const g = GRAD3[noiseHash3(seed, x, y, z) & 15];
  return dx * g[0] + dy * g[1] + dz * g[2];
}
function oldSimplex3(seed, offsetSeed, x, y, z) {
  var score, c;

  var attn_ext1;
  var dz_ext1;
  var dz_ext0;
  var zsv_ext1;
  var zsv_ext0;
  var dy_ext0;
  var dy_ext1;
  var ysv_ext0;
  var ysv_ext1;
  var dx_ext1;
  var dx_ext0;
  var xsv_ext1;
  var xsv_ext0;
  var stretchOffset = (x + y + z) * -0.16666666666666666;
  var xs = x + stretchOffset;
  var ys = y + stretchOffset;
  var zs = z + stretchOffset;
  var xsb = Math.floor(xs);
  var ysb = Math.floor(ys);
  var zsb = Math.floor(zs);
  var squishOffset = (xsb + ysb + zsb) * 0.3333333333333333;
  var xb = xsb + squishOffset;
  var yb = ysb + squishOffset;
  var zb = zsb + squishOffset;
  var xins = xs - xsb;
  var yins = ys - ysb;
  var zins = zs - zsb;
  var inSum = xins + yins + zins;
  var dx0 = x - xb;
  var dy0 = y - yb;
  var dz0 = z - zb;
  var value = 0.0;
  if (inSum <= 1.0) {
    var dz3;
    var dy3;
    var dx3;
    var attn3;
    var dz2;
    var dy2;
    var dx2;
    var attn2;
    var dz1;
    var dy1;
    var dx1;
    var attn1;
    var aPoint = 1;
    var aScore = xins;
    var bPoint = 2;
    var bScore = yins;
    if (aScore >= bScore && zins > bScore) {
      bScore = zins;
      bPoint = 4;
    } else if (aScore < bScore && zins > aScore) {
      aScore = zins;
      aPoint = 4;
    }
    var wins = 1.0 - inSum;
    if (wins > aScore || wins > bScore) {
      var n = (c = bScore > aScore ? bPoint : aPoint);
      if ((c & 1) == 0) {
        xsv_ext0 = xsb - 1;
        xsv_ext1 = xsb;
        dx_ext0 = dx0 + 1.0;
        dx_ext1 = dx0;
      } else {
        xsv_ext0 = xsv_ext1 = xsb + 1;
        dx_ext0 = dx_ext1 = dx0 - 1.0;
      }
      if ((c & 2) == 0) {
        ysv_ext1 = ysb;
        ysv_ext0 = ysv_ext1;
        dy_ext0 = dy_ext1 = dy0;
        if ((c & 1) == 0) {
          --ysv_ext1;
          dy_ext1 += 1.0;
        } else {
          --ysv_ext0;
          dy_ext0 += 1.0;
        }
      } else {
        ysv_ext0 = ysv_ext1 = ysb + 1;
        dy_ext0 = dy_ext1 = dy0 - 1.0;
      }
      if ((c & 4) == 0) {
        zsv_ext0 = zsb;
        zsv_ext1 = zsb - 1;
        dz_ext0 = dz0;
        dz_ext1 = dz0 + 1.0;
      } else {
        zsv_ext0 = zsv_ext1 = zsb + 1;
        dz_ext0 = dz_ext1 = dz0 - 1.0;
      }
    } else {
      c = aPoint | bPoint;
      if ((c & 1) == 0) {
        xsv_ext0 = xsb;
        xsv_ext1 = xsb - 1;
        dx_ext0 = dx0 - 0.6666666666666666;
        dx_ext1 = dx0 + 1.0 - 0.3333333333333333;
      } else {
        xsv_ext0 = xsv_ext1 = xsb + 1;
        dx_ext0 = dx0 - 1.0 - 0.6666666666666666;
        dx_ext1 = dx0 - 1.0 - 0.3333333333333333;
      }
      if ((c & 2) == 0) {
        ysv_ext0 = ysb;
        ysv_ext1 = ysb - 1;
        dy_ext0 = dy0 - 0.6666666666666666;
        dy_ext1 = dy0 + 1.0 - 0.3333333333333333;
      } else {
        ysv_ext0 = ysv_ext1 = ysb + 1;
        dy_ext0 = dy0 - 1.0 - 0.6666666666666666;
        dy_ext1 = dy0 - 1.0 - 0.3333333333333333;
      }
      if ((c & 4) == 0) {
        zsv_ext0 = zsb;
        zsv_ext1 = zsb - 1;
        dz_ext0 = dz0 - 0.6666666666666666;
        dz_ext1 = dz0 + 1.0 - 0.3333333333333333;
      } else {
        zsv_ext0 = zsv_ext1 = zsb + 1;
        dz_ext0 = dz0 - 1.0 - 0.6666666666666666;
        dz_ext1 = dz0 - 1.0 - 0.3333333333333333;
      }
    }
    var attn0 = 2.0 - dx0 * dx0 - dy0 * dy0 - dz0 * dz0;
    if (attn0 > 0.0) {
      attn0 *= attn0;
      value +=
        attn0 * attn0 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 0, zsb + 0, dx0, dy0, dz0);
    }
    if (
      (attn1 =
        2.0 -
        (dx1 = dx0 - 1.0 - 0.3333333333333333) * dx1 -
        (dy1 = dy0 - 0.0 - 0.3333333333333333) * dy1 -
        (dz1 = dz0 - 0.0 - 0.3333333333333333) * dz1) > 0.0
    ) {
      attn1 *= attn1;
      value +=
        attn1 * attn1 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 0, zsb + 0, dx1, dy1, dz1);
    }
    if (
      (attn2 =
        2.0 -
        (dx2 = dx0 - 0.0 - 0.3333333333333333) * dx2 -
        (dy2 = dy0 - 1.0 - 0.3333333333333333) * dy2 -
        (dz2 = dz1) * dz2) > 0.0
    ) {
      attn2 *= attn2;
      value +=
        attn2 * attn2 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 1, zsb + 0, dx2, dy2, dz2);
    }
    if (
      (attn3 =
        2.0 -
        (dx3 = dx2) * dx3 -
        (dy3 = dy1) * dy3 -
        (dz3 = dz0 - 1.0 - 0.3333333333333333) * dz3) > 0.0
    ) {
      attn3 *= attn3;
      value +=
        attn3 * attn3 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 0, zsb + 1, dx3, dy3, dz3);
    }
  } else if (inSum >= 2.0) {
    var attn0;
    var dz1;
    var dy1;
    var dx1;
    var attn1;
    var dz2;
    var dy2;
    var dx2;
    var attn2;
    var aPoint = 6;
    var aScore = xins;
    var bPoint = 5;
    var bScore = yins;
    if (aScore <= bScore && zins < bScore) {
      bScore = zins;
      bPoint = 3;
    } else if (aScore > bScore && zins < aScore) {
      aScore = zins;
      aPoint = 3;
    }
    var wins = 3.0 - inSum;
    if (wins < aScore || wins < bScore) {
      var n = (c = bScore < aScore ? bPoint : aPoint);
      if ((c & 1) != 0) {
        xsv_ext0 = xsb + 2;
        xsv_ext1 = xsb + 1;
        dx_ext0 = dx0 - 2.0 - 1.0;
        dx_ext1 = dx0 - 1.0 - 1.0;
      } else {
        xsv_ext0 = xsv_ext1 = xsb;
        dx_ext0 = dx_ext1 = dx0 - 1.0;
      }
      if ((c & 2) != 0) {
        ysv_ext1 = ysb + 1;
        ysv_ext0 = ysv_ext1;
        dy_ext0 = dy_ext1 = dy0 - 1.0 - 1.0;
        if ((c & 1) != 0) {
          ++ysv_ext1;
          dy_ext1 -= 1.0;
        } else {
          ++ysv_ext0;
          dy_ext0 -= 1.0;
        }
      } else {
        ysv_ext0 = ysv_ext1 = ysb;
        dy_ext0 = dy_ext1 = dy0 - 1.0;
      }
      if ((c & 4) != 0) {
        zsv_ext0 = zsb + 1;
        zsv_ext1 = zsb + 2;
        dz_ext0 = dz0 - 1.0 - 1.0;
        dz_ext1 = dz0 - 2.0 - 1.0;
      } else {
        zsv_ext0 = zsv_ext1 = zsb;
        dz_ext0 = dz_ext1 = dz0 - 1.0;
      }
    } else {
      c = aPoint & bPoint;
      if ((c & 1) != 0) {
        xsv_ext0 = xsb + 1;
        xsv_ext1 = xsb + 2;
        dx_ext0 = dx0 - 1.0 - 0.3333333333333333;
        dx_ext1 = dx0 - 2.0 - 0.6666666666666666;
      } else {
        xsv_ext0 = xsv_ext1 = xsb;
        dx_ext0 = dx0 - 0.3333333333333333;
        dx_ext1 = dx0 - 0.6666666666666666;
      }
      if ((c & 2) != 0) {
        ysv_ext0 = ysb + 1;
        ysv_ext1 = ysb + 2;
        dy_ext0 = dy0 - 1.0 - 0.3333333333333333;
        dy_ext1 = dy0 - 2.0 - 0.6666666666666666;
      } else {
        ysv_ext0 = ysv_ext1 = ysb;
        dy_ext0 = dy0 - 0.3333333333333333;
        dy_ext1 = dy0 - 0.6666666666666666;
      }
      if ((c & 4) != 0) {
        zsv_ext0 = zsb + 1;
        zsv_ext1 = zsb + 2;
        dz_ext0 = dz0 - 1.0 - 0.3333333333333333;
        dz_ext1 = dz0 - 2.0 - 0.6666666666666666;
      } else {
        zsv_ext0 = zsv_ext1 = zsb;
        dz_ext0 = dz0 - 0.3333333333333333;
        dz_ext1 = dz0 - 0.6666666666666666;
      }
    }
    var dx3 = dx0 - 1.0 - 0.6666666666666666;
    var dy3 = dy0 - 1.0 - 0.6666666666666666;
    var dz3 = dz0 - 0.0 - 0.6666666666666666;
    var attn3 = 2.0 - dx3 * dx3 - dy3 * dy3 - dz3 * dz3;
    if (attn3 > 0.0) {
      attn3 *= attn3;
      value +=
        attn3 * attn3 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 1, zsb + 0, dx3, dy3, dz3);
    }
    if (
      (attn2 =
        2.0 -
        (dx2 = dx3) * dx2 -
        (dy2 = dy0 - 0.0 - 0.6666666666666666) * dy2 -
        (dz2 = dz0 - 1.0 - 0.6666666666666666) * dz2) > 0.0
    ) {
      attn2 *= attn2;
      value +=
        attn2 * attn2 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 0, zsb + 1, dx2, dy2, dz2);
    }
    if (
      (attn1 =
        2.0 -
        (dx1 = dx0 - 0.0 - 0.6666666666666666) * dx1 -
        (dy1 = dy3) * dy1 -
        (dz1 = dz2) * dz1) > 0.0
    ) {
      attn1 *= attn1;
      value +=
        attn1 * attn1 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 1, zsb + 1, dx1, dy1, dz1);
    }
    if (
      (attn0 =
        2.0 -
        (dx0 = dx0 - 1.0 - 1.0) * dx0 -
        (dy0 = dy0 - 1.0 - 1.0) * dy0 -
        (dz0 = dz0 - 1.0 - 1.0) * dz0) > 0.0
    ) {
      attn0 *= attn0;
      value +=
        attn0 * attn0 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 1, zsb + 1, dx0, dy0, dz0);
    }
  } else {
    var dz6;
    var dy6;
    var dx6;
    var attn6;
    var dz5;
    var dy5;
    var dx5;
    var attn5;
    var dz4;
    var dy4;
    var dx4;
    var attn4;
    var dz3;
    var dy3;
    var dx3;
    var attn3;
    var dz2;
    var dy2;
    var dx2;
    var attn2;
    var bIsFurtherSide;
    var bPoint;
    var bScore;
    var aIsFurtherSide;
    var aPoint;
    var aScore;
    var p1 = xins + yins;
    if (p1 > 1.0) {
      aScore = p1 - 1.0;
      aPoint = 3;
      aIsFurtherSide = true;
    } else {
      aScore = 1.0 - p1;
      aPoint = 4;
      aIsFurtherSide = false;
    }
    var p2 = xins + zins;
    if (p2 > 1.0) {
      bScore = p2 - 1.0;
      bPoint = 5;
      bIsFurtherSide = true;
    } else {
      bScore = 1.0 - p2;
      bPoint = 2;
      bIsFurtherSide = false;
    }
    var p3 = yins + zins;
    if (p3 > 1.0) {
      score = p3 - 1.0;
      if (aScore <= bScore && aScore < score) {
        aScore = score;
        aPoint = 6;
        aIsFurtherSide = true;
      } else if (aScore > bScore && bScore < score) {
        bScore = score;
        bPoint = 6;
        bIsFurtherSide = true;
      }
    } else {
      score = 1.0 - p3;
      if (aScore <= bScore && aScore < score) {
        aScore = score;
        aPoint = 1;
        aIsFurtherSide = false;
      } else if (aScore > bScore && bScore < score) {
        bScore = score;
        bPoint = 1;
        bIsFurtherSide = false;
      }
    }
    if (aIsFurtherSide == bIsFurtherSide) {
      if (aIsFurtherSide) {
        dx_ext0 = dx0 - 1.0 - 1.0;
        dy_ext0 = dy0 - 1.0 - 1.0;
        dz_ext0 = dz0 - 1.0 - 1.0;
        xsv_ext0 = xsb + 1;
        ysv_ext0 = ysb + 1;
        zsv_ext0 = zsb + 1;
        c = aPoint & bPoint;
        if ((c & 1) != 0) {
          dx_ext1 = dx0 - 2.0 - 0.6666666666666666;
          dy_ext1 = dy0 - 0.6666666666666666;
          dz_ext1 = dz0 - 0.6666666666666666;
          xsv_ext1 = xsb + 2;
          ysv_ext1 = ysb;
          zsv_ext1 = zsb;
        } else if ((c & 2) != 0) {
          dx_ext1 = dx0 - 0.6666666666666666;
          dy_ext1 = dy0 - 2.0 - 0.6666666666666666;
          dz_ext1 = dz0 - 0.6666666666666666;
          xsv_ext1 = xsb;
          ysv_ext1 = ysb + 2;
          zsv_ext1 = zsb;
        } else {
          dx_ext1 = dx0 - 0.6666666666666666;
          dy_ext1 = dy0 - 0.6666666666666666;
          dz_ext1 = dz0 - 2.0 - 0.6666666666666666;
          xsv_ext1 = xsb;
          ysv_ext1 = ysb;
          zsv_ext1 = zsb + 2;
        }
      } else {
        dx_ext0 = dx0;
        dy_ext0 = dy0;
        dz_ext0 = dz0;
        xsv_ext0 = xsb;
        ysv_ext0 = ysb;
        zsv_ext0 = zsb;
        c = aPoint | bPoint;
        if ((c & 1) == 0) {
          dx_ext1 = dx0 + 1.0 - 0.3333333333333333;
          dy_ext1 = dy0 - 1.0 - 0.3333333333333333;
          dz_ext1 = dz0 - 1.0 - 0.3333333333333333;
          xsv_ext1 = xsb - 1;
          ysv_ext1 = ysb + 1;
          zsv_ext1 = zsb + 1;
        } else if ((c & 2) == 0) {
          dx_ext1 = dx0 - 1.0 - 0.3333333333333333;
          dy_ext1 = dy0 + 1.0 - 0.3333333333333333;
          dz_ext1 = dz0 - 1.0 - 0.3333333333333333;
          xsv_ext1 = xsb + 1;
          ysv_ext1 = ysb - 1;
          zsv_ext1 = zsb + 1;
        } else {
          dx_ext1 = dx0 - 1.0 - 0.3333333333333333;
          dy_ext1 = dy0 - 1.0 - 0.3333333333333333;
          dz_ext1 = dz0 + 1.0 - 0.3333333333333333;
          xsv_ext1 = xsb + 1;
          ysv_ext1 = ysb + 1;
          zsv_ext1 = zsb - 1;
        }
      }
    } else {
      var c2;
      var c1;
      if (aIsFurtherSide) {
        c1 = aPoint;
        c2 = bPoint;
      } else {
        c1 = bPoint;
        c2 = aPoint;
      }
      if ((c1 & 1) == 0) {
        dx_ext0 = dx0 + 1.0 - 0.3333333333333333;
        dy_ext0 = dy0 - 1.0 - 0.3333333333333333;
        dz_ext0 = dz0 - 1.0 - 0.3333333333333333;
        xsv_ext0 = xsb - 1;
        ysv_ext0 = ysb + 1;
        zsv_ext0 = zsb + 1;
      } else if ((c1 & 2) == 0) {
        dx_ext0 = dx0 - 1.0 - 0.3333333333333333;
        dy_ext0 = dy0 + 1.0 - 0.3333333333333333;
        dz_ext0 = dz0 - 1.0 - 0.3333333333333333;
        xsv_ext0 = xsb + 1;
        ysv_ext0 = ysb - 1;
        zsv_ext0 = zsb + 1;
      } else {
        dx_ext0 = dx0 - 1.0 - 0.3333333333333333;
        dy_ext0 = dy0 - 1.0 - 0.3333333333333333;
        dz_ext0 = dz0 + 1.0 - 0.3333333333333333;
        xsv_ext0 = xsb + 1;
        ysv_ext0 = ysb + 1;
        zsv_ext0 = zsb - 1;
      }
      dx_ext1 = dx0 - 0.6666666666666666;
      dy_ext1 = dy0 - 0.6666666666666666;
      dz_ext1 = dz0 - 0.6666666666666666;
      xsv_ext1 = xsb;
      ysv_ext1 = ysb;
      zsv_ext1 = zsb;
      if ((c2 & 1) != 0) {
        dx_ext1 -= 2.0;
        xsv_ext1 += 2;
      } else if ((c2 & 2) != 0) {
        dy_ext1 -= 2.0;
        ysv_ext1 += 2;
      } else {
        dz_ext1 -= 2.0;
        zsv_ext1 += 2;
      }
    }
    var dx1 = dx0 - 1.0 - 0.3333333333333333;
    var dy1 = dy0 - 0.0 - 0.3333333333333333;
    var dz1 = dz0 - 0.0 - 0.3333333333333333;
    var attn1 = 2.0 - dx1 * dx1 - dy1 * dy1 - dz1 * dz1;
    if (attn1 > 0.0) {
      attn1 *= attn1;
      value +=
        attn1 * attn1 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 0, zsb + 0, dx1, dy1, dz1);
    }
    if (
      (attn2 =
        2.0 -
        (dx2 = dx0 - 0.0 - 0.3333333333333333) * dx2 -
        (dy2 = dy0 - 1.0 - 0.3333333333333333) * dy2 -
        (dz2 = dz1) * dz2) > 0.0
    ) {
      attn2 *= attn2;
      value +=
        attn2 * attn2 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 1, zsb + 0, dx2, dy2, dz2);
    }
    if (
      (attn3 =
        2.0 -
        (dx3 = dx2) * dx3 -
        (dy3 = dy1) * dy3 -
        (dz3 = dz0 - 1.0 - 0.3333333333333333) * dz3) > 0.0
    ) {
      attn3 *= attn3;
      value +=
        attn3 * attn3 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 0, zsb + 1, dx3, dy3, dz3);
    }
    if (
      (attn4 =
        2.0 -
        (dx4 = dx0 - 1.0 - 0.6666666666666666) * dx4 -
        (dy4 = dy0 - 1.0 - 0.6666666666666666) * dy4 -
        (dz4 = dz0 - 0.0 - 0.6666666666666666) * dz4) > 0.0
    ) {
      attn4 *= attn4;
      value +=
        attn4 * attn4 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 1, zsb + 0, dx4, dy4, dz4);
    }
    if (
      (attn5 =
        2.0 -
        (dx5 = dx4) * dx5 -
        (dy5 = dy0 - 0.0 - 0.6666666666666666) * dy5 -
        (dz5 = dz0 - 1.0 - 0.6666666666666666) * dz5) > 0.0
    ) {
      attn5 *= attn5;
      value +=
        attn5 * attn5 * oldExtrapolate3(offsetSeed, xsb + 1, ysb + 0, zsb + 1, dx5, dy5, dz5);
    }
    if (
      (attn6 =
        2.0 -
        (dx6 = dx0 - 0.0 - 0.6666666666666666) * dx6 -
        (dy6 = dy4) * dy6 -
        (dz6 = dz5) * dz6) > 0.0
    ) {
      attn6 *= attn6;
      value +=
        attn6 * attn6 * oldExtrapolate3(offsetSeed, xsb + 0, ysb + 1, zsb + 1, dx6, dy6, dz6);
    }
  }
  var attn_ext0 = 2.0 - dx_ext0 * dx_ext0 - dy_ext0 * dy_ext0 - dz_ext0 * dz_ext0;
  if (attn_ext0 > 0.0) {
    attn_ext0 *= attn_ext0;
    value +=
      attn_ext0 *
      attn_ext0 *
      oldExtrapolate3(offsetSeed, xsv_ext0, ysv_ext0, zsv_ext0, dx_ext0, dy_ext0, dz_ext0);
  }
  if ((attn_ext1 = 2.0 - dx_ext1 * dx_ext1 - dy_ext1 * dy_ext1 - dz_ext1 * dz_ext1) > 0.0) {
    attn_ext1 *= attn_ext1;
    value +=
      attn_ext1 *
      attn_ext1 *
      oldExtrapolate3(offsetSeed, xsv_ext1, ysv_ext1, zsv_ext1, dx_ext1, dy_ext1, dz_ext1);
  }
  return value / 103.0;
}
function simplex3(seed, offsetSeed, x, y, z) {
  var score, c;

  var n3;
  var n2;
  var n1;
  var n0;
  var k2;
  var j2;
  var i2;
  var k1;
  var j1;
  var i1;
  var t = (x + y + z) * 0.3333333333333333;
  var i = fastFloor3(x + t);
  var j = fastFloor3(y + t);
  var k = fastFloor3(z + t);
  t = (i + j + k) * 0.16666666666666666;
  var x0 = x - (i - t);
  var y0 = y - (j - t);
  var z0 = z - (k - t);
  if (x0 >= y0) {
    if (y0 >= z0) {
      i1 = 1;
      j1 = 0;
      k1 = 0;
      i2 = 1;
      j2 = 1;
      k2 = 0;
    } else if (x0 >= z0) {
      i1 = 1;
      j1 = 0;
      k1 = 0;
      i2 = 1;
      j2 = 0;
      k2 = 1;
    } else {
      i1 = 0;
      j1 = 0;
      k1 = 1;
      i2 = 1;
      j2 = 0;
      k2 = 1;
    }
  } else if (y0 < z0) {
    i1 = 0;
    j1 = 0;
    k1 = 1;
    i2 = 0;
    j2 = 1;
    k2 = 1;
  } else if (x0 < z0) {
    i1 = 0;
    j1 = 1;
    k1 = 0;
    i2 = 0;
    j2 = 1;
    k2 = 1;
  } else {
    i1 = 0;
    j1 = 1;
    k1 = 0;
    i2 = 1;
    j2 = 1;
    k2 = 0;
  }
  var x1 = x0 - i1 + 0.16666666666666666;
  var y1 = y0 - j1 + 0.16666666666666666;
  var z1 = z0 - k1 + 0.16666666666666666;
  var x2 = x0 - i2 + 0.3333333333333333;
  var y2 = y0 - j2 + 0.3333333333333333;
  var z2 = z0 - k2 + 0.3333333333333333;
  var x3 = x0 + -0.5;
  var y3 = y0 + -0.5;
  var z3 = z0 + -0.5;
  t = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t < 0.0) {
    n0 = 0.0;
  } else {
    t *= t;
    n0 = t * t * grad3(offsetSeed, i, j, k, x0, y0, z0);
  }
  t = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t < 0.0) {
    n1 = 0.0;
  } else {
    t *= t;
    n1 = t * t * grad3(offsetSeed, i + i1, j + j1, k + k1, x1, y1, z1);
  }
  t = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t < 0.0) {
    n2 = 0.0;
  } else {
    t *= t;
    n2 = t * t * grad3(offsetSeed, i + i2, j + j2, k + k2, x2, y2, z2);
  }
  t = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t < 0.0) {
    n3 = 0.0;
  } else {
    t *= t;
    n3 = t * t * grad3(offsetSeed, i + 1, j + 1, k + 1, x3, y3, z3);
  }
  return 32.0 * (n0 + n1 + n2 + n3);
}
globalThis.V1Noise3 = { oldSimplex3, simplex3, noiseHash3 };
if (typeof module !== 'undefined') module.exports = globalThis.V1Noise3;
