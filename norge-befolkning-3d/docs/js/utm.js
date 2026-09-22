// UTM sone 33 (ETRS89/EUREF89, EPSG:25833) → lengde/bredde i grader.
// Krüger-serie til tredje orden; avvik mot pyproj er under en millimeter i Norge.
const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, L0 = 15 * Math.PI / 180;
const n = f / (2 - f), n2 = n * n, n3 = n2 * n;
const A = a / (1 + n) * (1 + n2 / 4 + n2 * n2 / 64);
const b = [n / 2 - 2 / 3 * n2 + 37 / 96 * n3, n2 / 48 + n3 / 15, 17 / 480 * n3];
const d = [2 * n - 2 / 3 * n2 - 2 * n3, 7 / 3 * n2 - 8 / 5 * n3, 56 / 15 * n3];

export function utmToLonLat(E, N) {
  const xi = N / (k0 * A), eta = (E - 5e5) / (k0 * A);
  let x = xi, e = eta;
  for (let j = 1; j <= 3; j++) {
    x -= b[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    e -= b[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(x) / Math.cosh(e));
  let lat = chi;
  for (let j = 1; j <= 3; j++) lat += d[j - 1] * Math.sin(2 * j * chi);
  return [(L0 + Math.atan2(Math.sinh(e), Math.cos(x))) * 180 / Math.PI, lat * 180 / Math.PI];
}
