"""Report tile sizes per zoom for a PMTiles file (the performance budget check).

usage: python3 scripts/audit_tiles.py public/data/osm.pmtiles [budget_kb]
"""
import gzip, sys, collections
from pmtiles.reader import Reader, MmapSource, all_tiles

path = sys.argv[1]
budget = float(sys.argv[2]) * 1024 if len(sys.argv) > 2 else 300 * 1024
with open(path, 'rb') as f:
    r = Reader(MmapSource(f))
    h = r.header()
    compressed = h['tile_compression'].value == 2  # gzip
    by_z = collections.defaultdict(list)
    for (z, x, y), data in all_tiles(r.get_bytes):
        size = len(data) if compressed else len(gzip.compress(data))
        by_z[z].append((size, x, y))
print(f'{"z":>2} {"tiles":>7} {"median KB":>9} {"p95 KB":>7} {"max KB":>7}  over-budget  worst tile')
for z in sorted(by_z):
    s = sorted(by_z[z])
    n = len(s)
    over = sum(1 for t in s if t[0] > budget)
    worst = s[-1]
    print(f'{z:>2} {n:>7} {s[n // 2][0] / 1024:>9.0f} {s[int(n * 0.95)][0] / 1024:>7.0f} {worst[0] / 1024:>7.0f}  {over:>11}  {z}/{worst[1]}/{worst[2]}')
