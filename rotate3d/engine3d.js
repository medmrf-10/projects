/**
 * Rotate3DEngine — Zero-dependency Shepard–Metzler 3D Chiral Polycube Generator,
 * Quaternion 3D Canvas Renderer, Scoring Engine, and Shareable Result Codec.
 *
 * Pure original implementation. Exposed on `window.Rotate3DEngine`,
 * `globalThis.Rotate3DEngine`, and `module.exports`.
 */
(function (root) {
  'use strict';

  const VERSION = '1.0.0';

  const LEVELS = Object.freeze([
    Object.freeze({
      level: 1,
      minCubes: 7,
      maxCubes: 8,
      minAngle: 30,
      maxAngle: 65,
      nameAr: 'تأسيسي',
      nameEn: 'Foundation',
    }),
    Object.freeze({
      level: 2,
      minCubes: 8,
      maxCubes: 9,
      minAngle: 55,
      maxAngle: 100,
      nameAr: 'متوسط مبكر',
      nameEn: 'Early Intermediate',
    }),
    Object.freeze({
      level: 3,
      minCubes: 9,
      maxCubes: 10,
      minAngle: 85,
      maxAngle: 140,
      nameAr: 'قياسي (شيبرد–ميتزلر)',
      nameEn: 'Standard (Shepard-Metzler)',
    }),
    Object.freeze({
      level: 4,
      minCubes: 10,
      maxCubes: 11,
      minAngle: 115,
      maxAngle: 170,
      nameAr: 'متقدم',
      nameEn: 'Advanced',
    }),
    Object.freeze({
      level: 5,
      minCubes: 11,
      maxCubes: 12,
      minAngle: 45,
      maxAngle: 180,
      nameAr: 'خبير',
      nameEn: 'Expert',
    }),
  ]);

  // =========================================================================
  // 1. Deterministic PRNG (xmur3 + sfc32 — 128-bit state, zero platform drift)
  // =========================================================================

  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function nextHash() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function createRng(seedStr) {
    const seeder = xmur3(String(seedStr));
    let a = seeder();
    let b = seeder();
    let c = seeder();
    let d = seeder();
    return function nextFloat() {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  function rngInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function rngShuffle(rng, arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  // Unambiguous uppercase alphanumeric characters (excludes 0/O/1/I for phone readability)
  const SEED_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  function createSeedCode() {
    let chars = '';
    const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const buf = new Uint8Array(4);
      cryptoObj.getRandomValues(buf);
      for (let i = 0; i < 4; i++) {
        chars += SEED_ALPHABET[buf[i] % SEED_ALPHABET.length];
      }
    } else {
      for (let i = 0; i < 4; i++) {
        chars += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
      }
    }
    return 'SM-' + chars;
  }

  function normalizeSeed(seed) {
    if (seed === undefined || seed === null || String(seed).trim() === '') {
      return 'SM-4829';
    }
    return String(seed).trim().toUpperCase();
  }

  // =========================================================================
  // 2. Octahedral Proper Rotation Group SO(3) — Exact 24 Cube Rotations
  // =========================================================================

  const ROTATIONS_24 = (function buildProperRotations24() {
    const perms = [
      [0, 1, 2, 1],
      [1, 2, 0, 1],
      [2, 0, 1, 1],
      [0, 2, 1, -1],
      [2, 1, 0, -1],
      [1, 0, 2, -1],
    ];
    const signs = [-1, 1];
    const list = [];
    for (let p = 0; p < perms.length; p++) {
      const [p0, p1, p2, parity] = perms[p];
      for (let i0 = 0; i0 < 2; i0++) {
        for (let i1 = 0; i1 < 2; i1++) {
          for (let i2 = 0; i2 < 2; i2++) {
            const s0 = signs[i0];
            const s1 = signs[i1];
            const s2 = signs[i2];
            if (parity * s0 * s1 * s2 === 1) {
              list.push(Object.freeze([p0, p1, p2, s0, s1, s2]));
            }
          }
        }
      }
    }
    return Object.freeze(list);
  })();

  const DIRS_6 = Object.freeze([
    Object.freeze([1, 0, 0]),
    Object.freeze([-1, 0, 0]),
    Object.freeze([0, 1, 0]),
    Object.freeze([0, -1, 0]),
    Object.freeze([0, 0, 1]),
    Object.freeze([0, 0, -1]),
  ]);

  function cloneCubes(cubes) {
    const out = new Array(cubes.length);
    for (let i = 0; i < cubes.length; i++) {
      out[i] = [cubes[i][0], cubes[i][1], cubes[i][2]];
    }
    return out;
  }

  function translateToOrigin(cubes) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      if (c[0] < minX) minX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[2] < minZ) minZ = c[2];
    }
    const out = new Array(cubes.length);
    for (let i = 0; i < cubes.length; i++) {
      out[i] = [cubes[i][0] - minX, cubes[i][1] - minY, cubes[i][2] - minZ];
    }
    return out;
  }

  /**
   * Produces the exact mirror enantiomorph along X while preserving exact voxel
   * index ordering (so `anchorIndex` maps directly to the mirrored end-tip).
   */
  function mirrorPolycube(cubes) {
    let maxX = -Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[2] < minZ) minZ = c[2];
    }
    const out = new Array(cubes.length);
    for (let i = 0; i < cubes.length; i++) {
      out[i] = [maxX - cubes[i][0], cubes[i][1] - minY, cubes[i][2] - minZ];
    }
    return out;
  }

  /**
   * Canonical translation-normalized sorted coordinate key for a voxel set
   * transformed by rotation `rot` (or identity if null).
   */
  function canonicalStringForRotation(cubes, rot) {
    const n = cubes.length;
    const xs = new Int32Array(n);
    const ys = new Int32Array(n);
    const zs = new Int32Array(n);
    let minX = 2147483647;
    let minY = 2147483647;
    let minZ = 2147483647;

    if (rot) {
      const p0 = rot[0];
      const p1 = rot[1];
      const p2 = rot[2];
      const s0 = rot[3];
      const s1 = rot[4];
      const s2 = rot[5];
      for (let i = 0; i < n; i++) {
        const c = cubes[i];
        const x = s0 * c[p0];
        const y = s1 * c[p1];
        const z = s2 * c[p2];
        xs[i] = x;
        ys[i] = y;
        zs[i] = z;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const c = cubes[i];
        const x = c[0];
        const y = c[1];
        const z = c[2];
        xs[i] = x;
        ys[i] = y;
        zs[i] = z;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
      }
    }

    // Fast path for normal grid spans (< 64): pack into sortable 32-bit int
    let maxSpan = 0;
    for (let i = 0; i < n; i++) {
      xs[i] -= minX;
      ys[i] -= minY;
      zs[i] -= minZ;
      if (xs[i] > maxSpan) maxSpan = xs[i];
      if (ys[i] > maxSpan) maxSpan = ys[i];
      if (zs[i] > maxSpan) maxSpan = zs[i];
    }

    if (maxSpan < 1024) {
      const packed = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        packed[i] = (xs[i] << 20) | (ys[i] << 10) | zs[i];
      }
      // Insertion sort (very fast for n <= 20)
      for (let i = 1; i < n; i++) {
        const key = packed[i];
        let j = i - 1;
        while (j >= 0 && packed[j] > key) {
          packed[j + 1] = packed[j];
          j--;
        }
        packed[j + 1] = key;
      }
      let out = '';
      for (let i = 0; i < n; i++) {
        if (i > 0) out += ';';
        out += packed[i];
      }
      return out;
    }

    const tuples = new Array(n);
    for (let i = 0; i < n; i++) {
      tuples[i] = [xs[i], ys[i], zs[i]];
    }
    tuples.sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    });
    let out = '';
    for (let i = 0; i < n; i++) {
      if (i > 0) out += ';';
      out += tuples[i][0] + ',' + tuples[i][1] + ',' + tuples[i][2];
    }
    return out;
  }

  /**
   * Computes a rotation-and-mirror-invariant canonical family ID so a session
   * can avoid repeating the same polycube (or its mirror) in different poses.
   */
  function canonicalFamilySignature(cubes) {
    const mirrored = mirrorPolycube(cubes);
    let best = null;
    for (let r = 0; r < ROTATIONS_24.length; r++) {
      const k1 = canonicalStringForRotation(cubes, ROTATIONS_24[r]);
      if (best === null || k1 < best) best = k1;
      const k2 = canonicalStringForRotation(mirrored, ROTATIONS_24[r]);
      if (k2 < best) best = k2;
    }
    return best;
  }

  /**
   * Counts how many of the 24 proper rotations map `cubes` onto itself.
   * Returning 1 means completely asymmetric (trivial symmetry group C_1),
   * ensuring every 3D orientation yields a unique minimal geodesic angle.
   */
  function countProperAutomorphisms(cubes) {
    const base = canonicalStringForRotation(cubes, null);
    let count = 0;
    for (let r = 0; r < ROTATIONS_24.length; r++) {
      if (canonicalStringForRotation(cubes, ROTATIONS_24[r]) === base) {
        count++;
      }
    }
    return count;
  }

  /**
   * Exhaustive mathematical proof of strict 3D chirality + Shepard–Metzler structure:
   * 1. Valid integer 3D coords, zero duplicates.
   * 2. Connected via orthogonal adjacency (BFS).
   * 3. Strictly 3D: spans all 3 axes (`spanX >= 2, spanY >= 2, spanZ >= 2`).
   * 4. Classic Shepard–Metzler non-self-touching elbowed arm topology:
   *    simple orthogonal path (max degree 2, exactly 2 degree-1 end-tips, zero
   *    cycles or blob clusters) with >= 3 right-angle straight segments.
   * 5. Exhaustive check over ALL 24 proper cube rotations in SO(3) (det = +1)
   *    proving mirror(cubes) is NOT congruent to cubes under any proper rotation.
   */
  function isStrictlyChiral(cubes) {
    if (!Array.isArray(cubes) || cubes.length < 4) return false;
    const n = cubes.length;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    const indexMap = new Map();
    for (let i = 0; i < n; i++) {
      const c = cubes[i];
      if (!Array.isArray(c) || c.length !== 3) return false;
      const x = c[0];
      const y = c[1];
      const z = c[2];
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) {
        return false;
      }
      const key = x + ',' + y + ',' + z;
      if (indexMap.has(key)) return false; // duplicate voxel
      indexMap.set(key, i);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    // Must span all 3 axes (non-planar, >= 2 grid slices along X, Y, Z)
    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    const spanZ = maxZ - minZ + 1;
    if (spanX < 2 || spanY < 2 || spanZ < 2) return false;

    // Build orthogonal adjacency graph and check degrees
    const adj = new Array(n);
    let endpointCount = 0;
    let firstEndpoint = -1;

    for (let i = 0; i < n; i++) {
      const [x, y, z] = cubes[i];
      const neighbors = [];
      for (let d = 0; d < 6; d++) {
        const dir = DIRS_6[d];
        const nIdx = indexMap.get((x + dir[0]) + ',' + (y + dir[1]) + ',' + (z + dir[2]));
        if (nIdx !== undefined) {
          neighbors.push(nIdx);
        }
      }
      if (neighbors.length === 0 || neighbors.length > 2) {
        return false; // isolated voxel or blob/branch junction (>2 neighbors)
      }
      if (neighbors.length === 1) {
        endpointCount++;
        if (firstEndpoint === -1) firstEndpoint = i;
      }
      adj[i] = neighbors;
    }

    // Simple non-self-touching snake path has strictly 2 end-tips (zero cycles)
    if (endpointCount !== 2) return false;

    // BFS connectivity check from voxel 0
    const visited = new Uint8Array(n);
    const queue = [0];
    visited[0] = 1;
    let visitedCount = 1;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      const nbrs = adj[cur];
      for (let k = 0; k < nbrs.length; k++) {
        const next = nbrs[k];
        if (!visited[next]) {
          visited[next] = 1;
          visitedCount++;
          queue.push(next);
        }
      }
    }
    if (visitedCount !== n) return false;

    // Trace the path end-to-end and verify >= 3 right-angle segments
    let prev = -1;
    let cur = firstEndpoint;
    let lastDx = 0;
    let lastDy = 0;
    let lastDz = 0;
    let segments = 0;

    for (let step = 0; step < n - 1; step++) {
      const nbrs = adj[cur];
      const next = nbrs[0] === prev ? nbrs[1] : nbrs[0];
      const dx = cubes[next][0] - cubes[cur][0];
      const dy = cubes[next][1] - cubes[cur][1];
      const dz = cubes[next][2] - cubes[cur][2];
      if (step === 0 || dx !== lastDx || dy !== lastDy || dz !== lastDz) {
        segments++;
        lastDx = dx;
        lastDy = dy;
        lastDz = dz;
      }
      prev = cur;
      cur = next;
    }
    if (segments < 3) return false;

    // Exhaustive check over ALL 24 proper cube rotations in SO(3) (det = +1)
    const baseCanonical = canonicalStringForRotation(cubes, null);
    const mirrored = mirrorPolycube(cubes);
    for (let r = 0; r < ROTATIONS_24.length; r++) {
      if (canonicalStringForRotation(mirrored, ROTATIONS_24[r]) === baseCanonical) {
        return false; // achiral: superimposable onto mirror under a proper rotation
      }
    }

    return true;
  }

  // =========================================================================
  // 3. Quaternion Math & Geodesic Distance
  // =========================================================================

  function qNormalize(q) {
    if (!q || q.length !== 4) return [0, 0, 0, 1];
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    if (len < 1e-12) return [0, 0, 0, 1];
    const inv = 1 / len;
    return [q[0] * inv, q[1] * inv, q[2] * inv, q[3] * inv];
  }

  function qConj(q) {
    return [-q[0], -q[1], -q[2], q[3]];
  }

  function qMul(a, b) {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3];
    const bx = b[0], by = b[1], bz = b[2], bw = b[3];
    return [
      aw * bx + ax * bw + ay * bz - az * by,
      aw * by - ax * bz + ay * bw + az * bx,
      aw * bz + ax * by - ay * bx + az * bw,
      aw * bw - ax * bx - ay * by - az * bz,
    ];
  }

  function qFromAxisAngle(axis, angleRad) {
    const len = Math.hypot(axis[0], axis[1], axis[2]);
    if (len < 1e-12) return [0, 0, 0, 1];
    const half = angleRad * 0.5;
    const s = Math.sin(half) / len;
    return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)];
  }

  function qRotateVec(q, v) {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return [
      vx + qw * tx + (qy * tz - qz * ty),
      vy + qw * ty + (qz * tx - qx * tz),
      vz + qw * tz + (qx * ty - qy * tx),
    ];
  }

  function qSlerp(q1, q2, t) {
    const a = qNormalize(q1);
    let b = qNormalize(q2);
    let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (dot < 0) {
      dot = -dot;
      b = [-b[0], -b[1], -b[2], -b[3]];
    }
    if (dot > 0.9995) {
      return qNormalize([
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
        a[3] + t * (b[3] - a[3]),
      ]);
    }
    const theta0 = Math.acos(Math.min(1, Math.max(-1, dot)));
    const sinTheta0 = Math.sin(theta0);
    const theta = theta0 * t;
    const s0 = Math.sin(theta0 - theta) / sinTheta0;
    const s1 = Math.sin(theta) / sinTheta0;
    return qNormalize([
      s0 * a[0] + s1 * b[0],
      s0 * a[1] + s1 * b[1],
      s0 * a[2] + s1 * b[2],
      s0 * a[3] + s1 * b[3],
    ]);
  }

  /**
   * Exact quaternion geodesic angle 2*acos(|<q1, q2>|) in degrees,
   * using the numerically stable atan2 half-chord formulation.
   */
  function geodesicAngleDeg(q1, q2) {
    const a = qNormalize(q1);
    let b = qNormalize(q2);
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (dot < 0) {
      b = [-b[0], -b[1], -b[2], -b[3]];
    }
    const diff = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
    const sum = Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]);
    const rad = 4 * Math.atan2(diff, sum);
    return (rad * 180) / Math.PI;
  }

  function randomUnitVec3(rng) {
    const z = 2 * rng() - 1;
    const phi = 2 * Math.PI * rng();
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return [r * Math.cos(phi), r * Math.sin(phi), z];
  }

  // Shoemake's uniform random quaternion on SO(3)
  function randomUniformQuat(rng) {
    const u1 = rng();
    const u2 = 2 * Math.PI * rng();
    const u3 = 2 * Math.PI * rng();
    const s1 = Math.sqrt(1 - u1);
    const s2 = Math.sqrt(u1);
    return qNormalize([
      s1 * Math.sin(u2),
      s1 * Math.cos(u2),
      s2 * Math.sin(u3),
      s2 * Math.cos(u3),
    ]);
  }

  function getAngleBand(angleDeg) {
    if (angleDeg <= 65) return 'small';
    if (angleDeg <= 120) return 'medium';
    return 'large';
  }

  // =========================================================================
  // 4. Polycube Geometry Metrics & Non-Degenerate Camera Orientation Scoring
  // =========================================================================

  function computeCenterAndRadius(cubes) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < cubes.length; i++) {
      const c = cubes[i];
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
      if (c[2] < minZ) minZ = c[2];
      if (c[2] > maxZ) maxZ = c[2];
    }
    const cx = (minX + maxX) * 0.5;
    const cy = (minY + maxY) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    let maxR = 1;
    for (let i = 0; i < cubes.length; i++) {
      const dx = Math.abs(cubes[i][0] - cx) + 0.5;
      const dy = Math.abs(cubes[i][1] - cy) + 0.5;
      const dz = Math.abs(cubes[i][2] - cz) + 0.5;
      const r = Math.hypot(dx, dy, dz);
      if (r > maxR) maxR = r;
    }
    return { center: [cx, cy, cz], radius: maxR };
  }

  /**
   * Evaluates how clean, non-occluded, and 3/4-readable a polycube looks
   * from orientation `quat`. Higher score is better; degenerate views receive
   * steep penalties so arms never collapse end-on behind each other.
   */
  function evaluateViewQuality(cubes, quat, anchorIndex) {
    const q = qNormalize(quat);
    const { center, radius } = computeCenterAndRadius(cubes);
    const camDist = Math.max(8, radius * 6.5);

    // Check 3 orthogonal face directions — ideal 3/4 view has all 3 clearly visible
    const rx = qRotateVec(q, [1, 0, 0]);
    const ry = qRotateVec(q, [0, 1, 0]);
    const rz = qRotateVec(q, [0, 0, 1]);
    const ax = Math.abs(rx[2]);
    const ay = Math.abs(ry[2]);
    const az = Math.abs(rz[2]);
    const minAxisVis = Math.min(ax, ay, az);
    const maxAxisVis = Math.max(ax, ay, az);

    // Project cube centers in normalized perspective units (cube edge ~ 1)
    const n = cubes.length;
    const px = new Float64Array(n);
    const py = new Float64Array(n);
    const pz = new Float64Array(n);
    let minPx = Infinity, maxPx = -Infinity;
    let minPy = Infinity, maxPy = -Infinity;

    for (let i = 0; i < n; i++) {
      const rel = [
        cubes[i][0] - center[0],
        cubes[i][1] - center[1],
        cubes[i][2] - center[2],
      ];
      const v = qRotateVec(q, rel);
      const persp = camDist / (camDist - v[2]);
      const x2 = v[0] * persp;
      const y2 = v[1] * persp;
      px[i] = x2;
      py[i] = y2;
      pz[i] = v[2];
      if (x2 < minPx) minPx = x2;
      if (x2 > maxPx) maxPx = x2;
      if (y2 < minPy) minPy = y2;
      if (y2 > maxPy) maxPy = y2;
    }

    // Check pairwise 2D separation so no cube hides directly behind another
    let minPairDist = Infinity;
    let closePairs = 0;
    let anchorMinDist = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(px[i] - px[j], py[i] - py[j]);
        if (d < minPairDist) minPairDist = d;
        if (d < 0.52) closePairs++;
        if (i === anchorIndex || j === anchorIndex) {
          if (d < anchorMinDist) anchorMinDist = d;
        }
      }
    }

    const width2D = maxPx - minPx;
    const height2D = maxPy - minPy;
    const minSpread = Math.min(width2D, height2D);
    const area2D = width2D * height2D;

    let score = 0;
    // Reward strong 3/4 visibility on all 3 cube face orientations
    score += Math.min(minAxisVis, 0.56) * 140;
    if (minAxisVis < 0.24) score -= (0.24 - minAxisVis) * 500;
    if (maxAxisVis > 0.88) score -= (maxAxisVis - 0.88) * 350;

    // Reward clear separation between projected cube centers
    score += Math.min(minPairDist, 0.82) * 110;
    if (minPairDist < 0.48) score -= (0.48 - minPairDist) * 420;
    score -= closePairs * 18;

    // Reward visible anchor end-tip (not buried behind another arm)
    if (anchorIndex >= 0 && anchorIndex < n) {
      score += Math.min(anchorMinDist, 0.85) * 45;
      if (anchorMinDist < 0.50) score -= (0.50 - anchorMinDist) * 260;
      // Mild bonus if anchor is not the very deepest cube in the back
      if (pz[anchorIndex] > -radius * 0.45) score += 10;
    }

    // Reward balanced, open 2D bounding spread
    score += Math.min(minSpread, 3.0) * 24;
    if (minSpread < 1.55) score -= (1.55 - minSpread) * 160;
    score += Math.min(area2D, 16) * 2.5;

    return score;
  }

  /**
   * Selects a crisp non-occluded 3/4 reference orientation `refQuat`.
   */
  function pickRefQuat(rng, cubes, anchorIndex) {
    // Seed candidate pool with classic 3/4 isometric-like angles + random SO(3)
    const candidates = [];
    const baseYaws = [32, 48, 128, 145, 215, 232, 308, 325];
    const basePitches = [24, 34, -24, -34];
    for (let i = 0; i < 8; i++) {
      const yaw = (baseYaws[i] + (rng() - 0.5) * 18) * (Math.PI / 180);
      const pitch = (basePitches[i % basePitches.length] + (rng() - 0.5) * 12) * (Math.PI / 180);
      const roll = ((rng() - 0.5) * 28) * (Math.PI / 180);
      const qYaw = qFromAxisAngle([0, 1, 0], yaw);
      const qPitch = qFromAxisAngle([1, 0, 0], pitch);
      const qRoll = qFromAxisAngle([0, 0, 1], roll);
      candidates.push(qNormalize(qMul(qRoll, qMul(qPitch, qYaw))));
    }
    for (let i = 0; i < 28; i++) {
      candidates.push(randomUniformQuat(rng));
    }

    let bestQuat = candidates[0];
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const sc = evaluateViewQuality(cubes, candidates[i], anchorIndex);
      if (sc > bestScore) {
        bestScore = sc;
        bestQuat = candidates[i];
      }
    }
    return bestQuat;
  }

  /**
   * Selects a crisp target orientation `targetQuat` at exact geodesic angle
   * strictly within `[minAngle, maxAngle]` relative to `refQuat`, optionally
   * maintaining minimum geodesic separation from `avoidQuats`.
   */
  function pickTargetQuat(rng, refQuat, targetCubes, anchorIndex, minAngle, maxAngle, avoidQuats) {
    const targetInt = rngInt(rng, minAngle, maxAngle);
    // Tiny interior epsilon on exact bounds prevents float rounding drift outside [minAngle, maxAngle]
    let exactAngle = targetInt;
    if (minAngle < maxAngle) {
      if (exactAngle === minAngle) exactAngle = minAngle + 1e-5;
      else if (exactAngle === maxAngle) exactAngle = maxAngle - 1e-5;
    }
    const rad = (exactAngle * Math.PI) / 180;

    let bestQuat = null;
    let bestScore = -Infinity;
    const samples = 44;

    for (let i = 0; i < samples; i++) {
      const axis = randomUnitVec3(rng);
      const delta = qFromAxisAngle(axis, rad);
      const cand = qNormalize(qMul(delta, refQuat));

      // Verify exact geodesic angle falls strictly within [minAngle, maxAngle]
      const gDeg = geodesicAngleDeg(refQuat, cand);
      if (gDeg < minAngle || gDeg > maxAngle) continue;

      let sc = evaluateViewQuality(targetCubes, cand, anchorIndex);

      if (avoidQuats && avoidQuats.length > 0) {
        let minSep = Infinity;
        for (let k = 0; k < avoidQuats.length; k++) {
          const sep = geodesicAngleDeg(cand, avoidQuats[k]);
          if (sep < minSep) minSep = sep;
        }
        if (minSep < 36) {
          sc -= (36 - minSep) * 18;
        } else {
          sc += Math.min(minSep, 90) * 0.4;
        }
      }

      if (sc > bestScore) {
        bestScore = sc;
        bestQuat = cand;
      }
    }

    if (!bestQuat) {
      const axis = randomUnitVec3(rng);
      bestQuat = qNormalize(qMul(qFromAxisAngle(axis, rad), refQuat));
    }

    return {
      quat: bestQuat,
      angleDeg: Math.round(geodesicAngleDeg(refQuat, bestQuat)),
    };
  }

  // =========================================================================
  // 5. Classic Shepard–Metzler Chiral Polycube Generator (3–4 Right-Angle Arms)
  // =========================================================================

  /**
   * Partitions `totalSteps` into `segCount` arm lengths (each >= 1, <= maxLen)
   * balanced like classic Shepard–Metzler polycubes.
   */
  function sampleSegmentLengths(rng, totalSteps, segCount) {
    const lens = new Array(segCount).fill(1);
    let remaining = totalSteps - segCount;
    const maxLen = totalSteps >= 10 ? 4 : 3;

    // Prefer balanced arm lengths (avoid extreme 1,1,1,7 sticks)
    let guard = 0;
    while (remaining > 0 && guard < 100) {
      guard++;
      const idx = Math.floor(rng() * segCount);
      if (lens[idx] < maxLen) {
        lens[idx]++;
        remaining--;
      }
    }
    while (remaining > 0) {
      const idx = Math.floor(rng() * segCount);
      lens[idx]++;
      remaining--;
    }
    return lens;
  }

  /**
   * Samples `segCount` (3 or 4) consecutive orthogonal 3D directions that
   * span all 3 coordinate axes (X, Y, Z).
   */
  function sampleOrthogonalDirections(rng, segCount) {
    const axes = rngShuffle(rng, [0, 1, 2]);
    let seqAxes;
    if (segCount === 3) {
      seqAxes = axes;
    } else {
      // 4 segments spanning all 3 axes with no consecutive equal axes
      const patterns = [
        [axes[0], axes[1], axes[2], axes[0]],
        [axes[0], axes[1], axes[2], axes[1]],
        [axes[0], axes[1], axes[0], axes[2]],
      ];
      seqAxes = patterns[Math.floor(rng() * patterns.length)];
    }

    const dirs = new Array(segCount);
    for (let i = 0; i < segCount; i++) {
      const sign = rng() < 0.5 ? 1 : -1;
      const v = [0, 0, 0];
      v[seqAxes[i]] = sign;
      dirs[i] = v;
    }
    return dirs;
  }

  function buildSnakeFromSegments(lengths, dirs) {
    const cubes = [[0, 0, 0]];
    const occ = new Set(['0,0,0']);
    let x = 0, y = 0, z = 0;

    for (let s = 0; s < lengths.length; s++) {
      const len = lengths[s];
      const [dx, dy, dz] = dirs[s];
      for (let step = 0; step < len; step++) {
        x += dx;
        y += dy;
        z += dz;
        const key = x + ',' + y + ',' + z;
        if (occ.has(key)) return null;
        occ.add(key);
        cubes.push([x, y, z]);
      }
    }
    return translateToOrigin(cubes);
  }

  /**
   * Generates a mathematically verified, strictly chiral, asymmetric (C_1)
   * Shepard–Metzler polycube for a given level.
   */
  function generateChiralPolycube(rng, levelCfg, excludeFamilies) {
    const minCubes = levelCfg.minCubes;
    const maxCubes = levelCfg.maxCubes;

    for (let attempt = 0; attempt < 400; attempt++) {
      const numCubes = rngInt(rng, minCubes, maxCubes);
      const totalSteps = numCubes - 1;
      // Classic Shepard–Metzler: 3-4 segments (Level 1-2 mix 3 & 4; Level 3-5 strongly 4)
      let segCount;
      if (levelCfg.level === 1) {
        segCount = rng() < 0.45 ? 3 : 4;
      } else if (levelCfg.level === 2) {
        segCount = rng() < 0.25 ? 3 : 4;
      } else {
        segCount = 4;
      }

      const lengths = sampleSegmentLengths(rng, totalSteps, segCount);
      const dirs = sampleOrthogonalDirections(rng, segCount);
      const cubes = buildSnakeFromSegments(lengths, dirs);
      if (!cubes) continue;

      if (!isStrictlyChiral(cubes)) continue;

      // Require trivial proper symmetry group C_1 so geodesic angle is unique
      if (attempt < 300 && countProperAutomorphisms(cubes) !== 1) continue;

      // Avoid repeating the same shape family within a session
      if (excludeFamilies && attempt < 320) {
        const fam = canonicalFamilySignature(cubes);
        if (excludeFamilies.has(fam)) continue;
        excludeFamilies.add(fam);
      }

      // Anchor on the end-tip of the terminal arm (always degree-1 end-tip)
      const anchorIndex = rng() < 0.5 ? cubes.length - 1 : 0;
      return { cubes, anchorIndex };
    }

    // Deterministic verified fallback (classic 10-cube Shepard–Metzler chiral crank, trimmed to minCubes)
    const fallbackSteps = [
      [1, 0, 0], [1, 0, 0],
      [0, 1, 0], [0, 1, 0],
      [0, 0, 1], [0, 0, 1],
      [-1, 0, 0],
      [0, 1, 0], [0, 1, 0],
      [1, 0, 0], [1, 0, 0],
    ];
    const targetN = Math.max(7, Math.min(12, minCubes));
    const fb = [[0, 0, 0]];
    let fx = 0, fy = 0, fz = 0;
    for (let i = 0; i < targetN - 1; i++) {
      fx += fallbackSteps[i][0];
      fy += fallbackSteps[i][1];
      fz += fallbackSteps[i][2];
      fb.push([fx, fy, fz]);
    }
    const normFb = translateToOrigin(fb);
    return { cubes: normFb, anchorIndex: normFb.length - 1 };
  }

  // =========================================================================
  // 6. Trial & Session Generators
  // =========================================================================

  function resolveLevelConfig(levelInput, index, totalCount) {
    if (levelInput === 'adaptive') {
      let lvlNum;
      if (typeof totalCount === 'number' && totalCount > 0) {
        lvlNum = 1 + Math.min(4, Math.floor((index * 5) / totalCount));
      } else {
        lvlNum = 1 + Math.min(4, Math.floor(Math.max(0, index) / 3));
      }
      return LEVELS[lvlNum - 1];
    }
    const parsed = parseInt(levelInput, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 3;
    return LEVELS[clamped - 1];
  }

  function generateTrialInternal(opts, excludeFamilies, forcedCorrectSlot) {
    const o = opts || {};
    const seed = normalizeSeed(o.seed);
    const index = Number.isInteger(o.index) && o.index >= 0 ? o.index : 0;
    const format = o.format === 'quad' ? 'quad' : 'pair';
    const levelCfg = resolveLevelConfig(o.level, index, o._sessionCount);
    const rng = createRng(seed + '|trial|' + index + '|L' + levelCfg.level + '|' + format);

    const { cubes, anchorIndex } = generateChiralPolycube(rng, levelCfg, excludeFamilies);
    const mirrorCubes = mirrorPolycube(cubes);
    const refQuat = pickRefQuat(rng, cubes, anchorIndex);

    const id = seed + '-T' + (index + 1);

    if (format === 'pair') {
      const isSame = typeof o.forceSame === 'boolean' ? o.forceSame : rng() < 0.5;
      const targetCubes = cloneCubes(isSame ? cubes : mirrorCubes);
      const targetPick = pickTargetQuat(
        rng,
        refQuat,
        targetCubes,
        anchorIndex,
        levelCfg.minAngle,
        levelCfg.maxAngle,
        null
      );

      return {
        id,
        index,
        level: levelCfg.level,
        format: 'pair',
        cubes: cloneCubes(cubes),
        mirrorCubes: cloneCubes(mirrorCubes),
        anchorIndex,
        refQuat: refQuat.slice(),
        isSame,
        targetCubes,
        targetQuat: targetPick.quat.slice(),
        options: null,
        correctOptionIndex: null,
        angleDeg: targetPick.angleDeg,
        angleBand: getAngleBand(targetPick.angleDeg),
      };
    }

    // format === 'quad': 1 exact rotated match + 3 distinct mirror enantiomorphs
    const correctPick = pickTargetQuat(
      rng,
      refQuat,
      cubes,
      anchorIndex,
      levelCfg.minAngle,
      levelCfg.maxAngle,
      null
    );

    const usedQuats = [correctPick.quat];
    const distractors = [];
    for (let d = 0; d < 3; d++) {
      const dPick = pickTargetQuat(
        rng,
        refQuat,
        mirrorCubes,
        anchorIndex,
        levelCfg.minAngle,
        levelCfg.maxAngle,
        usedQuats
      );
      usedQuats.push(dPick.quat);
      distractors.push({
        cubes: cloneCubes(mirrorCubes),
        quat: dPick.quat.slice(),
        isCorrect: false,
        angleDeg: dPick.angleDeg,
      });
    }

    const correctOptionIndex =
      Number.isInteger(forcedCorrectSlot) && forcedCorrectSlot >= 0 && forcedCorrectSlot < 4
        ? forcedCorrectSlot
        : Math.floor(rng() * 4);

    const options = [];
    let dIdx = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (slot === correctOptionIndex) {
        options.push({
          cubes: cloneCubes(cubes),
          quat: correctPick.quat.slice(),
          isCorrect: true,
          angleDeg: correctPick.angleDeg,
        });
      } else {
        options.push(distractors[dIdx++]);
      }
    }

    return {
      id,
      index,
      level: levelCfg.level,
      format: 'quad',
      cubes: cloneCubes(cubes),
      mirrorCubes: cloneCubes(mirrorCubes),
      anchorIndex,
      refQuat: refQuat.slice(),
      isSame: null,
      targetCubes: cloneCubes(cubes),
      targetQuat: correctPick.quat.slice(),
      options,
      correctOptionIndex,
      angleDeg: correctPick.angleDeg,
      angleBand: getAngleBand(correctPick.angleDeg),
    };
  }

  function generateTrial(opts) {
    return generateTrialInternal(opts, null, null);
  }

  function hasRunExceeding(arr, maxRun) {
    let run = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === arr[i - 1]) {
        run++;
        if (run > maxRun) return true;
      } else {
        run = 1;
      }
    }
    return false;
  }

  function buildBalancedPairSchedule(rng, count) {
    if (count <= 0) return [];
    const half = Math.floor(count / 2);
    const sameCount = count % 2 === 0 ? half : half + (rng() < 0.5 ? 1 : 0);
    const diffCount = count - sameCount;

    const base = [];
    for (let i = 0; i < sameCount; i++) base.push(true);
    for (let i = 0; i < diffCount; i++) base.push(false);

    for (let attempt = 0; attempt < 250; attempt++) {
      const cand = rngShuffle(rng, base);
      if (!hasRunExceeding(cand, 3)) return cand;
    }

    // Guaranteed deterministic interleaving fallback (max run <= 2)
    const out = [];
    let s = sameCount;
    let d = diffCount;
    let nextTrue = s >= d;
    while (s > 0 || d > 0) {
      if (nextTrue && s > 0) {
        out.push(true);
        s--;
      } else if (!nextTrue && d > 0) {
        out.push(false);
        d--;
      } else if (s > 0) {
        out.push(true);
        s--;
      } else {
        out.push(false);
        d--;
      }
      nextTrue = !nextTrue;
    }
    return out;
  }

  function buildBalancedQuadSlots(rng, count) {
    const slots = [];
    while (slots.length < count) {
      const chunk = rngShuffle(rng, [0, 1, 2, 3]);
      for (let i = 0; i < chunk.length && slots.length < count; i++) {
        slots.push(chunk[i]);
      }
    }
    for (let attempt = 0; attempt < 80; attempt++) {
      const cand = rngShuffle(rng, slots);
      if (!hasRunExceeding(cand, 2)) return cand;
    }
    return slots;
  }

  function generateSession(opts) {
    const o = opts || {};
    const seed = normalizeSeed(o.seed || createSeedCode());
    const count = Math.max(1, Math.min(200, parseInt(o.count, 10) || 12));
    const format = o.format === 'quad' ? 'quad' : 'pair';
    const level = o.level === 'adaptive' ? 'adaptive' : (parseInt(o.level, 10) || 3);

    const schedRng = createRng(seed + '|session|' + count + '|' + level + '|' + format);
    const pairSchedule = format === 'pair' ? buildBalancedPairSchedule(schedRng, count) : null;
    const quadSlots = format === 'quad' ? buildBalancedQuadSlots(schedRng, count) : null;
    const excludeFamilies = new Set();

    const trials = new Array(count);
    for (let i = 0; i < count; i++) {
      trials[i] = generateTrialInternal(
        {
          seed,
          index: i,
          level,
          format,
          forceSame: pairSchedule ? pairSchedule[i] : undefined,
          _sessionCount: count,
        },
        excludeFamilies,
        quadSlots ? quadSlots[i] : null
      );
    }
    return trials;
  }

  // =========================================================================
  // 7. HiDPI Quaternion 3D Canvas Renderer (Exact Grid Painter's Algorithm)
  // =========================================================================

  // Six unit cube faces with outward normals and CCW corner indices (viewed from outside)
  const CUBE_CORNERS = Object.freeze([
    [-0.5, -0.5, -0.5], // 0
    [0.5, -0.5, -0.5],  // 1
    [0.5, 0.5, -0.5],   // 2
    [-0.5, 0.5, -0.5],  // 3
    [-0.5, -0.5, 0.5],  // 4
    [0.5, -0.5, 0.5],   // 5
    [0.5, 0.5, 0.5],    // 6
    [-0.5, 0.5, 0.5],   // 7
  ]);

  const CUBE_FACES = Object.freeze([
    { normal: [1, 0, 0],  neighbor: [1, 0, 0],  corners: [1, 2, 6, 5] },
    { normal: [-1, 0, 0], neighbor: [-1, 0, 0], corners: [0, 4, 7, 3] },
    { normal: [0, 1, 0],  neighbor: [0, 1, 0],  corners: [3, 7, 6, 2] },
    { normal: [0, -1, 0], neighbor: [0, -1, 0], corners: [0, 1, 5, 4] },
    { normal: [0, 0, 1],  neighbor: [0, 0, 1],  corners: [4, 5, 6, 7] },
    { normal: [0, 0, -1], neighbor: [0, 0, -1], corners: [0, 3, 2, 1] },
  ]);

  function normalizeVec3(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  // Camera-space 3-point lighting directions for crisp 3D edge readability
  const KEY_LIGHT = normalizeVec3([-0.42, 0.72, 0.55]);
  const FILL_LIGHT = normalizeVec3([0.58, -0.28, 0.34]);

  const THEME_PALETTES = {
    light: {
      // Crisp bright porcelain-slate textbook Shepard–Metzler cubes with dark ink outlines
      baseDark: [164, 182, 204],
      baseBright: [250, 252, 255],
      stroke: '#0f172a',
      innerHighlight: 'rgba(255, 255, 255, 0.55)',
      anchorDark: [217, 119, 6],
      anchorBright: [254, 240, 138],
      anchorStroke: '#78350f',
      shadow: 'rgba(15, 23, 42, 0.11)',
    },
    dark: {
      // Crisp luminous ice-silver cubes against dark OLED canvas with deep ink outlines
      baseDark: [71, 85, 105],
      baseBright: [232, 240, 250],
      stroke: '#020617',
      innerHighlight: 'rgba(255, 255, 255, 0.28)',
      anchorDark: [180, 83, 9],
      anchorBright: [254, 240, 138],
      anchorStroke: '#451a03',
      shadow: 'rgba(0, 0, 0, 0.42)',
    },
  };

  function lerpChannel(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function shadeFaceColor(normalCam, isAnchor, palette) {
    const keyDot = Math.max(0, normalCam[0] * KEY_LIGHT[0] + normalCam[1] * KEY_LIGHT[1] + normalCam[2] * KEY_LIGHT[2]);
    const fillDot = Math.max(0, normalCam[0] * FILL_LIGHT[0] + normalCam[1] * FILL_LIGHT[1] + normalCam[2] * FILL_LIGHT[2]);
    // Strong directional separation across top / left / right faces
    const raw = 0.14 + keyDot * 0.72 + fillDot * 0.14;
    const t = Math.max(0, Math.min(1, raw));
    const dark = isAnchor ? palette.anchorDark : palette.baseDark;
    const bright = isAnchor ? palette.anchorBright : palette.baseBright;
    return (
      'rgb(' +
      lerpChannel(dark[0], bright[0], t) + ',' +
      lerpChannel(dark[1], bright[1], t) + ',' +
      lerpChannel(dark[2], bright[2], t) + ')'
    );
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function createViewport(canvas, opts) {
    const options = opts || {};
    let destroyed = false;
    let theme = options.theme === 'dark' ? 'dark' : 'light';
    let interactive = Boolean(options.interactive);
    let showAnchor = Boolean(options.showAnchor);
    let anchorIndex = Number.isInteger(options.anchorIndex) ? options.anchorIndex : -1;
    let background = options.background || null;

    let cubes = [];
    let voxelSet = new Set();
    let center = [0, 0, 0];
    let radius = 2.5;
    let quat = qNormalize(options.quat || [0, 0, 0, 1]);
    let baseQuat = quat.slice();

    let cssW = 300;
    let cssH = 300;
    let hasMeasuredCss = false;
    let dpr = 1;
    const ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;

    let animRaf = null;
    let pendingResizeRaf = null;
    let dragging = false;
    let activePointerId = null;
    let lastX = 0;
    let lastY = 0;

    function syncInteractionStyle() {
      if (!canvas || !canvas.style) return;
      canvas.style.touchAction = interactive ? 'none' : 'pan-y';
      canvas.style.cursor = interactive ? (dragging ? 'grabbing' : 'grab') : 'default';
      canvas.style.userSelect = 'none';
      canvas.style.webkitUserSelect = 'none';
    }

    function cancelAnimation() {
      if (animRaf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animRaf);
      }
      animRaf = null;
    }

    function measureSize() {
      if (!canvas) return;
      const rect = typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : null;
      const w = (rect && rect.width > 0 ? rect.width : canvas.clientWidth) || 0;
      const h = (rect && rect.height > 0 ? rect.height : canvas.clientHeight) || 0;
      if (w > 0 && h > 0) {
        cssW = w;
        cssH = h;
        hasMeasuredCss = true;
      } else if (!hasMeasuredCss && canvas.width > 0 && canvas.height > 0) {
        cssW = canvas.width;
        cssH = canvas.height;
        hasMeasuredCss = true;
      }
      dpr = Math.min(
        (typeof window !== 'undefined' && window.devicePixelRatio) || 1,
        3
      );
      const targetW = Math.max(1, Math.round(cssW * dpr));
      const targetH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;
    }

    function render() {
      if (destroyed || !ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      const palette = THEME_PALETTES[theme] || THEME_PALETTES.light;
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      if (!cubes || cubes.length === 0) return;

      const camDist = Math.max(8, radius * 6.5);
      const minDim = Math.min(cssW, cssH);
      // Generous, crisp framing that never clips at any 3D angle
      const projMaxRad = radius / Math.sqrt(camDist * camDist - radius * radius);
      const focal = (minDim * 0.415) / projMaxRad;
      const halfW = cssW * 0.5;
      const halfH = cssH * 0.5;

      // Exact camera position in centered object space: q^-1 * (0, 0, camDist)
      const invQ = qConj(quat);
      const camObj = qRotateVec(invQ, [0, 0, camDist]);

      // Pre-rotate the 6 face normals once per frame
      const rotNormals = new Array(6);
      for (let f = 0; f < 6; f++) {
        rotNormals[f] = qRotateVec(quat, CUBE_FACES[f].normal);
      }

      // Build depth-sorted cube order using exact axis-aligned grid Manhattan distance
      // (mathematically guaranteed cycle-free hidden-surface order from any camera angle)
      const n = cubes.length;
      const order = new Array(n);
      let maxScreenY = -Infinity;
      let minScreenX = Infinity;
      let maxScreenX = -Infinity;

      for (let i = 0; i < n; i++) {
        const rx = cubes[i][0] - center[0];
        const ry = cubes[i][1] - center[1];
        const rz = cubes[i][2] - center[2];
        const dx = rx - camObj[0];
        const dy = ry - camObj[1];
        const dz = rz - camObj[2];
        const manhattan = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        const euclid2 = dx * dx + dy * dy + dz * dz;
        order[i] = { index: i, rx, ry, rz, manhattan, euclid2 };

        const vc = qRotateVec(quat, [rx, ry, rz]);
        const sc = focal / (camDist - vc[2]);
        const sx = halfW + vc[0] * sc;
        const sy = halfH - vc[1] * sc;
        if (sy > maxScreenY) maxScreenY = sy;
        if (sx < minScreenX) minScreenX = sx;
        if (sx > maxScreenX) maxScreenX = sx;
      }

      // Draw far-to-near (descending Manhattan distance, Euclidean tiebreaker)
      order.sort(function (a, b) {
        if (Math.abs(b.manhattan - a.manhattan) > 1e-9) {
          return b.manhattan - a.manhattan;
        }
        return b.euclid2 - a.euclid2;
      });

      const approxCubePx = focal / camDist;
      const strokeW = Math.max(1.05, Math.min(2.05, approxCubePx * 0.044));

      // Subtle grounding contact shadow ellipse beneath the polycube
      if (minDim >= 90) {
        const shadowCx = (minScreenX + maxScreenX) * 0.5;
        const shadowCy = Math.min(cssH - 8, maxScreenY + approxCubePx * 0.78);
        const shadowRx = Math.max(approxCubePx * 0.8, (maxScreenX - minScreenX) * 0.44);
        const shadowRy = Math.max(4, shadowRx * 0.16);
        ctx.save();
        ctx.fillStyle = palette.shadow;
        ctx.beginPath();
        ctx.ellipse(shadowCx, shadowCy, shadowRx, shadowRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = strokeW;

      // Project & render each cube in exact back-to-front order
      const projectedCorners = new Array(8);
      for (let oi = 0; oi < n; oi++) {
        const item = order[oi];
        const idx = item.index;
        const gx = cubes[idx][0];
        const gy = cubes[idx][1];
        const gz = cubes[idx][2];
        const isAnchor = showAnchor && idx === anchorIndex;

        // Compute rotated & projected 8 corners of this unit cube
        const camCorners = new Array(8);
        for (let ci = 0; ci < 8; ci++) {
          const co = CUBE_CORNERS[ci];
          const v = qRotateVec(quat, [item.rx + co[0], item.ry + co[1], item.rz + co[2]]);
          camCorners[ci] = v;
          const invZ = focal / (camDist - v[2]);
          projectedCorners[ci] = [halfW + v[0] * invZ, halfH - v[1] * invZ];
        }

        for (let f = 0; f < 6; f++) {
          const face = CUBE_FACES[f];
          // Skip internal shared face between adjacent voxels
          const nKey =
            (gx + face.neighbor[0]) + ',' +
            (gy + face.neighbor[1]) + ',' +
            (gz + face.neighbor[2]);
          if (voxelSet.has(nKey)) continue;

          // Exact perspective back-face culling using face center -> camera vector
          const c0 = camCorners[face.corners[0]];
          const c2 = camCorners[face.corners[2]];
          const fcx = (c0[0] + c2[0]) * 0.5;
          const fcy = (c0[1] + c2[1]) * 0.5;
          const fcz = (c0[2] + c2[2]) * 0.5;
          const rn = rotNormals[f];
          const viewDot = rn[0] * (-fcx) + rn[1] * (-fcy) + rn[2] * (camDist - fcz);
          if (viewDot <= 0) continue;

          const p0 = projectedCorners[face.corners[0]];
          const p1 = projectedCorners[face.corners[1]];
          const p2 = projectedCorners[face.corners[2]];
          const p3 = projectedCorners[face.corners[3]];

          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.lineTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.lineTo(p3[0], p3[1]);
          ctx.closePath();

          ctx.fillStyle = shadeFaceColor(rn, isAnchor, palette);
          ctx.fill();

          ctx.strokeStyle = isAnchor ? palette.anchorStroke : palette.stroke;
          ctx.stroke();

          // Crisp accessible anchor indicator dot on visible faces of the anchor cube
          if (isAnchor && approxCubePx >= 14) {
            const cx2 = (p0[0] + p1[0] + p2[0] + p3[0]) * 0.25;
            const cy2 = (p0[1] + p1[1] + p2[1] + p3[1]) * 0.25;
            const dotR = Math.max(1.8, Math.min(4.2, approxCubePx * 0.095));
            ctx.save();
            ctx.fillStyle = palette.anchorStroke;
            ctx.globalAlpha = 0.72;
            ctx.beginPath();
            ctx.arc(cx2, cy2, dotR, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    function animateToQuat(targetQuat, durationMs, onComplete) {
      if (destroyed) return;
      cancelAnimation();
      const target = qNormalize(targetQuat);
      const dur = typeof durationMs === 'number' ? durationMs : 700;

      if (dur <= 0 || typeof requestAnimationFrame !== 'function') {
        quat = target.slice();
        render();
        if (typeof onComplete === 'function') onComplete();
        return;
      }

      const startQuat = quat.slice();
      const nowFn =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? function () { return performance.now(); }
          : function () { return Date.now(); };
      const startTime = nowFn();

      function step() {
        if (destroyed) return;
        const elapsed = nowFn() - startTime;
        const rawT = Math.max(0, Math.min(1, elapsed / dur));
        const eased = easeInOutCubic(rawT);
        quat = qSlerp(startQuat, target, eased);
        render();
        if (rawT < 1) {
          animRaf = requestAnimationFrame(step);
        } else {
          animRaf = null;
          quat = target.slice();
          render();
          if (typeof onComplete === 'function') onComplete();
        }
      }

      animRaf = requestAnimationFrame(step);
    }

    function setFigure(nextCubes, nextQuat, figOpts) {
      if (destroyed) return;
      cancelAnimation();
      const fo = figOpts || {};
      cubes = Array.isArray(nextCubes) ? cloneCubes(nextCubes) : [];
      voxelSet = new Set();
      for (let i = 0; i < cubes.length; i++) {
        voxelSet.add(cubes[i][0] + ',' + cubes[i][1] + ',' + cubes[i][2]);
      }
      if (cubes.length > 0) {
        const metrics = computeCenterAndRadius(cubes);
        center = metrics.center;
        radius = metrics.radius;
      } else {
        center = [0, 0, 0];
        radius = 2.5;
      }

      if (typeof fo.showAnchor === 'boolean') {
        showAnchor = fo.showAnchor;
      }
      if (Number.isInteger(fo.anchorIndex)) {
        anchorIndex = fo.anchorIndex;
      }

      const targetQ = qNormalize(nextQuat || quat);
      baseQuat = targetQ.slice();

      if (fo.animateFromQuat) {
        quat = qNormalize(fo.animateFromQuat);
        render();
        animateToQuat(targetQ, typeof fo.durationMs === 'number' ? fo.durationMs : 550, fo.onComplete);
      } else {
        quat = targetQ.slice();
        render();
      }
    }

    function setTheme(nextTheme) {
      if (destroyed) return;
      theme = nextTheme === 'dark' ? 'dark' : 'light';
      render();
    }

    function setInteractive(enabled) {
      if (destroyed) return;
      interactive = Boolean(enabled);
      if (!interactive) {
        dragging = false;
        activePointerId = null;
      }
      syncInteractionStyle();
    }

    function setShowAnchor(show, nextAnchorIndex) {
      if (destroyed) return;
      showAnchor = Boolean(show);
      if (Number.isInteger(nextAnchorIndex)) {
        anchorIndex = nextAnchorIndex;
      }
      render();
    }

    function resetView(durationMs) {
      if (destroyed) return;
      const dur = typeof durationMs === 'number' ? durationMs : 360;
      animateToQuat(baseQuat, dur);
    }

    function resize() {
      if (destroyed) return;
      measureSize();
      render();
    }

    // Pointer / Touch Drag-to-Orbit Handlers (active ONLY when interactive === true)
    function onPointerDown(e) {
      if (destroyed || !interactive) return;
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      cancelAnimation();
      dragging = true;
      activePointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      syncInteractionStyle();
      if (typeof canvas.setPointerCapture === 'function') {
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (_) {
          // Ignore synthetic pointer events without capture support
        }
      }
      if (e.cancelable) e.preventDefault();
    }

    function onPointerMove(e) {
      if (destroyed || !interactive || !dragging) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (dx === 0 && dy === 0) return;

      const scale = (Math.PI * 1.45) / Math.max(140, Math.min(cssW, cssH));
      const qYaw = qFromAxisAngle([0, 1, 0], dx * scale);
      const qPitch = qFromAxisAngle([1, 0, 0], dy * scale);
      quat = qNormalize(qMul(qPitch, qMul(qYaw, quat)));
      render();
      if (e.cancelable) e.preventDefault();
    }

    function onPointerUp(e) {
      if (!dragging) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      dragging = false;
      activePointerId = null;
      syncInteractionStyle();
      if (typeof canvas.releasePointerCapture === 'function') {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch (_) {
          // Ignore
        }
      }
    }

    let resizeObserver = null;
    if (canvas && typeof canvas.addEventListener === 'function') {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(function () {
          if (!destroyed) resize();
        });
        resizeObserver.observe(canvas);
      }
    }

    syncInteractionStyle();
    measureSize();

    if (Array.isArray(options.cubes) && options.cubes.length > 0) {
      setFigure(options.cubes, options.quat || quat, {
        showAnchor,
        anchorIndex,
      });
    } else {
      render();
    }

    // Re-measure on next animation frame in case layout settled asynchronously
    if (typeof requestAnimationFrame === 'function') {
      pendingResizeRaf = requestAnimationFrame(function () {
        pendingResizeRaf = null;
        if (!destroyed) resize();
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimation();
      if (pendingResizeRaf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(pendingResizeRaf);
        pendingResizeRaf = null;
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (canvas && typeof canvas.removeEventListener === 'function') {
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
      }
    }

    return {
      setFigure,
      setTheme,
      setInteractive,
      setShowAnchor,
      animateToQuat,
      resetView,
      resize,
      destroy,
      getQuat: function () { return quat.slice(); },
    };
  }

  // =========================================================================
  // 8. AZTest-Style Scoring Engine (`computeScore`)
  // =========================================================================

  function computeMedian(nums) {
    if (!nums || nums.length === 0) return 0;
    const sorted = nums.slice().sort(function (a, b) { return a - b; });
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return Math.round(sorted[mid]);
    return Math.round((sorted[mid - 1] + sorted[mid]) * 0.5);
  }

  function round1(val) {
    return Math.round(val * 10) / 10;
  }

  function computeScore(results, startLevel) {
    const items = Array.isArray(results) ? results : [];
    const total = items.length;

    const times = [];
    let correct = 0;
    let totalMs = 0;
    let levelSum = 0;
    let levelCount = 0;

    const bandBuckets = {
      small: { correct: 0, total: 0, times: [] },
      medium: { correct: 0, total: 0, times: [] },
      large: { correct: 0, total: 0, times: [] },
    };

    for (let i = 0; i < total; i++) {
      const r = items[i] || {};
      const ok = Boolean(r.isCorrect !== undefined ? r.isCorrect : r.correct);
      const rawMs =
        r.rtMs !== undefined ? r.rtMs :
        r.timeMs !== undefined ? r.timeMs :
        r.elapsedMs !== undefined ? r.elapsedMs :
        r.durationMs !== undefined ? r.durationMs :
        r.ms !== undefined ? r.ms : 0;
      const ms = Math.max(0, Number.isFinite(Number(rawMs)) ? Math.round(Number(rawMs)) : 0);

      if (ok) correct++;
      totalMs += ms;
      times.push(ms);

      const lvlNum = parseInt(r.level, 10);
      if (Number.isFinite(lvlNum) && lvlNum >= 1 && lvlNum <= 5) {
        levelSum += lvlNum;
        levelCount++;
      }

      let band = r.angleBand;
      if (band !== 'small' && band !== 'medium' && band !== 'large') {
        const ang = Number(r.angleDeg);
        band = Number.isFinite(ang) ? getAngleBand(ang) : 'medium';
      }
      bandBuckets[band].total++;
      if (ok) bandBuckets[band].correct++;
      bandBuckets[band].times.push(ms);
    }

    const accuracy = total > 0 ? round1((correct / total) * 100) : 0;
    const meanMs = total > 0 ? Math.round(totalMs / total) : 0;
    const medianMs = computeMedian(times);

    const parsedStart = parseInt(startLevel, 10);
    const resolvedStartLevel =
      Number.isFinite(parsedStart) && parsedStart >= 1 && parsedStart <= 5
        ? parsedStart
        : levelCount > 0
          ? Math.max(1, Math.min(5, Math.round(levelSum / levelCount)))
          : 3;

    let nextLevel = resolvedStartLevel;
    if (total > 0) {
      if (accuracy >= 85 && (medianMs === 0 || medianMs <= 12000)) {
        nextLevel = Math.min(5, resolvedStartLevel + 1);
      } else if (accuracy < 55) {
        nextLevel = Math.max(1, resolvedStartLevel - 1);
      }
    }

    const avgLevel = levelCount > 0 ? levelSum / levelCount : resolvedStartLevel;
    let score = 0;
    if (total > 0) {
      const accRatio = correct / total;
      const baseAcc = accRatio * 750;
      const medianSec = Math.max(0.5, medianMs / 1000);
      const speedFactor = Math.max(0, Math.min(1, 1 - (medianSec - 2.0) / 16.0));
      const speedBonus = accRatio * speedFactor * 200;
      const diffFactor = Math.max(0, Math.min(1, (avgLevel - 1) / 4));
      const diffBonus = accRatio * diffFactor * 50;
      score = Math.round(Math.max(0, Math.min(1000, baseAcc + speedBonus + diffBonus)));
    }

    function finalizeBand(b) {
      return {
        correct: b.correct,
        total: b.total,
        accuracy: b.total > 0 ? round1((b.correct / b.total) * 100) : 0,
        medianMs: computeMedian(b.times),
      };
    }

    return {
      score,
      accuracy,
      correct,
      total,
      totalMs,
      medianMs,
      meanMs,
      startLevel: resolvedStartLevel,
      nextLevel,
      bands: {
        small: finalizeBand(bandBuckets.small),
        medium: finalizeBand(bandBuckets.medium),
        large: finalizeBand(bandBuckets.large),
      },
    };
  }

  // =========================================================================
  // 9. Compact Shareable Result Codec (`encodeResultCode` / `decodeResultCode`)
  // =========================================================================

  function utf8ToBytes(str) {
    if (typeof TextEncoder === 'function') {
      return new TextEncoder().encode(str);
    }
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let cp = str.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
        const lo = str.charCodeAt(++i);
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
      }
      if (cp < 0x80) {
        bytes.push(cp);
      } else if (cp < 0x800) {
        bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
      } else if (cp < 0x10000) {
        bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else {
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }

  function bytesToUtf8(bytes) {
    if (typeof TextDecoder === 'function') {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    let out = '';
    for (let i = 0; i < bytes.length; ) {
      const b0 = bytes[i++];
      if (b0 < 0x80) {
        out += String.fromCharCode(b0);
      } else if ((b0 & 0xe0) === 0xc0) {
        const b1 = bytes[i++];
        out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
      } else if ((b0 & 0xf0) === 0xe0) {
        const b1 = bytes[i++];
        const b2 = bytes[i++];
        out += String.fromCharCode(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
      } else {
        const b1 = bytes[i++];
        const b2 = bytes[i++];
        const b3 = bytes[i++];
        let cp = ((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f);
        cp -= 0x10000;
        out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      }
    }
    return out;
  }

  const B64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const B64URL_LOOKUP = (function () {
    const map = new Int16Array(128).fill(-1);
    for (let i = 0; i < B64URL_CHARS.length; i++) {
      map[B64URL_CHARS.charCodeAt(i)] = i;
    }
    return map;
  })();

  function bytesToBase64Url(bytes) {
    let out = '';
    const len = bytes.length;
    for (let i = 0; i < len; i += 3) {
      const a = bytes[i];
      const b = i + 1 < len ? bytes[i + 1] : 0;
      const c = i + 2 < len ? bytes[i + 2] : 0;
      const triple = (a << 16) | (b << 8) | c;
      out += B64URL_CHARS[(triple >>> 18) & 63];
      out += B64URL_CHARS[(triple >>> 12) & 63];
      if (i + 1 < len) out += B64URL_CHARS[(triple >>> 6) & 63];
      if (i + 2 < len) out += B64URL_CHARS[triple & 63];
    }
    return out;
  }

  function base64UrlToBytes(str) {
    if (!str || str.length % 4 === 1) return null;
    const out = [];
    for (let i = 0; i < str.length; i += 4) {
      const c0 = str.charCodeAt(i);
      const c1 = str.charCodeAt(i + 1);
      const c2 = i + 2 < str.length ? str.charCodeAt(i + 2) : -1;
      const c3 = i + 3 < str.length ? str.charCodeAt(i + 3) : -1;
      if (c0 >= 128 || c1 >= 128 || (c2 >= 128) || (c3 >= 128)) return null;
      const v0 = B64URL_LOOKUP[c0];
      const v1 = B64URL_LOOKUP[c1];
      const v2 = c2 === -1 ? 0 : B64URL_LOOKUP[c2];
      const v3 = c3 === -1 ? 0 : B64URL_LOOKUP[c3];
      if (v0 < 0 || v1 < 0 || (c2 !== -1 && v2 < 0) || (c3 !== -1 && v3 < 0)) return null;

      const triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
      out.push((triple >>> 16) & 255);
      if (c2 !== -1) out.push((triple >>> 8) & 255);
      if (c3 !== -1) out.push(triple & 255);
    }
    return new Uint8Array(out);
  }

  function checksum4(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  }

  function normalizeBitmaskInput(payload) {
    if (typeof payload.bitmask === 'string') {
      return payload.bitmask.replace(/[^01]/g, '');
    }
    if (Array.isArray(payload.bitmask)) {
      return payload.bitmask.map(function (v) { return v ? '1' : '0'; }).join('');
    }
    if (Array.isArray(payload.results)) {
      return payload.results
        .map(function (r) {
          const ok = typeof r === 'boolean' ? r : Boolean(r && (r.isCorrect !== undefined ? r.isCorrect : r.correct));
          return ok ? '1' : '0';
        })
        .join('');
    }
    if (Array.isArray(payload.answers)) {
      return payload.answers.map(function (v) { return v ? '1' : '0'; }).join('');
    }
    return '';
  }

  function packBitmaskHex(bits) {
    if (!bits) return '';
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      const chunk = bits.slice(i, i + 4).padEnd(4, '0');
      hex += parseInt(chunk, 2).toString(16);
    }
    return bits.length + ':' + hex;
  }

  function unpackBitmaskHex(packed) {
    if (typeof packed !== 'string' || packed === '') return '';
    const colon = packed.indexOf(':');
    if (colon === -1) return packed.replace(/[^01]/g, '');
    const len = parseInt(packed.slice(0, colon), 10);
    const hex = packed.slice(colon + 1);
    if (!Number.isInteger(len) || len < 0 || len > 500) return '';
    let bits = '';
    for (let i = 0; i < hex.length; i++) {
      const nib = parseInt(hex[i], 16);
      if (Number.isNaN(nib)) return '';
      bits += nib.toString(2).padStart(4, '0');
    }
    return bits.slice(0, len);
  }

  function extractBandTuple(bands, key) {
    const b = (bands && bands[key]) || {};
    const c = Math.max(0, parseInt(b.correct, 10) || 0);
    const t = Math.max(0, parseInt(b.total, 10) || 0);
    const m = Math.max(0, Math.round(Number(b.medianMs) || 0));
    return [c, t, m];
  }

  function hydrateBand(arr, offset) {
    const c = Math.max(0, parseInt(arr[offset], 10) || 0);
    const t = Math.max(0, parseInt(arr[offset + 1], 10) || 0);
    const m = Math.max(0, Math.round(Number(arr[offset + 2]) || 0));
    return {
      correct: c,
      total: t,
      accuracy: t > 0 ? round1((c / t) * 100) : 0,
      medianMs: m,
    };
  }

  function encodeResultCode(payload) {
    const p = payload || {};
    const total = Math.max(0, parseInt(p.total !== undefined ? p.total : p.count, 10) || 0);
    const count = Math.max(0, parseInt(p.count !== undefined ? p.count : total, 10) || 0);
    const correct = Math.max(0, Math.min(total || count || 500, parseInt(p.correct, 10) || 0));
    const accuracy =
      p.accuracy !== undefined && Number.isFinite(Number(p.accuracy))
        ? round1(Number(p.accuracy))
        : total > 0
          ? round1((correct / total) * 100)
          : 0;

    const bits = normalizeBitmaskInput(p);
    const bSmall = extractBandTuple(p.bands, 'small');
    const bMed = extractBandTuple(p.bands, 'medium');
    const bLarge = extractBandTuple(p.bands, 'large');

    const compact = {
      v: 1,
      n: String(p.name !== undefined ? p.name : (p.playerName || '')).trim().slice(0, 32),
      s: normalizeSeed(p.seed),
      f: p.format === 'quad' ? 'q' : 'p',
      l: p.level === 'adaptive' ? 'a' : Math.max(1, Math.min(5, parseInt(p.level, 10) || 3)),
      c: count,
      sc: Math.max(0, Math.round(Number(p.score) || 0)),
      ac: accuracy,
      ok: correct,
      tt: total,
      tm: Math.max(0, Math.round(Number(p.totalMs) || 0)),
      mm: Math.max(0, Math.round(Number(p.medianMs) || 0)),
      bm: packBitmaskHex(bits),
      b: [
        bSmall[0], bSmall[1], bSmall[2],
        bMed[0], bMed[1], bMed[2],
        bLarge[0], bLarge[1], bLarge[2],
      ],
    };

    const json = JSON.stringify(compact);
    const b64 = bytesToBase64Url(utf8ToBytes(json));
    const chk = checksum4(b64);
    return 'M3D-' + b64 + '-' + chk;
  }

  function decodeResultCode(code) {
    if (typeof code !== 'string') return null;
    const cleaned = code.trim().replace(/\s+/g, '');
    if (!cleaned.startsWith('M3D-')) return null;

    const lastDash = cleaned.lastIndexOf('-');
    if (lastDash <= 4 || lastDash !== cleaned.length - 5) return null;

    const b64 = cleaned.slice(4, lastDash);
    const chk = cleaned.slice(lastDash + 1).toUpperCase();
    if (!b64 || !/^[0-9A-F]{4}$/.test(chk)) return null;
    if (checksum4(b64) !== chk) return null;

    const bytes = base64UrlToBytes(b64);
    if (!bytes || bytes.length === 0) return null;

    let parsed;
    try {
      const json = bytesToUtf8(bytes);
      parsed = JSON.parse(json);
    } catch (_) {
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null;
    if (typeof parsed.s !== 'string' || !parsed.s) return null;
    if (!Array.isArray(parsed.b) || parsed.b.length !== 9) return null;

    const level =
      parsed.l === 'a'
        ? 'adaptive'
        : Math.max(1, Math.min(5, parseInt(parsed.l, 10) || 3));

    const total = Math.max(0, parseInt(parsed.tt, 10) || 0);
    const count = Math.max(0, parseInt(parsed.c, 10) || total);
    const correct = Math.max(0, Math.min(total || count || 500, parseInt(parsed.ok, 10) || 0));
    const totalMs = Math.max(0, Math.round(Number(parsed.tm) || 0));
    const medianMs = Math.max(0, Math.round(Number(parsed.mm) || 0));
    const score = Math.max(0, Math.round(Number(parsed.sc) || 0));
    const accuracy = Number.isFinite(Number(parsed.ac))
      ? round1(Number(parsed.ac))
      : total > 0
        ? round1((correct / total) * 100)
        : 0;

    return {
      version: 1,
      name: typeof parsed.n === 'string' ? parsed.n : '',
      seed: parsed.s,
      format: parsed.f === 'q' ? 'quad' : 'pair',
      level,
      count,
      score,
      accuracy,
      correct,
      total,
      totalMs,
      medianMs,
      bitmask: unpackBitmaskHex(parsed.bm),
      bands: {
        small: hydrateBand(parsed.b, 0),
        medium: hydrateBand(parsed.b, 3),
        large: hydrateBand(parsed.b, 6),
      },
    };
  }

  // =========================================================================
  // 10. Public API Export
  // =========================================================================

  const Rotate3DEngine = Object.freeze({
    VERSION,
    LEVELS,
    createSeedCode,
    generateSession,
    generateTrial,
    isStrictlyChiral,
    geodesicAngleDeg,
    createViewport,
    computeScore,
    encodeResultCode,
    decodeResultCode,
  });

  if (typeof globalThis !== 'undefined') {
    globalThis.Rotate3DEngine = Rotate3DEngine;
  }
  if (typeof window !== 'undefined') {
    window.Rotate3DEngine = Rotate3DEngine;
  }
  if (root && typeof root === 'object') {
    root.Rotate3DEngine = Rotate3DEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Rotate3DEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
