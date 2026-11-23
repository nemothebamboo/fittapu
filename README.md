# Fittapu

Telefonra kitűzhető, offline működő PWA a napi listához, heti tervhez, haladáshoz és a vasárnapi heti jelentéshez.
Vite + React + TypeScript, az adatok a böngészőben (IndexedDB) vannak, nincs szerver.

## Telepítés iPhone-ra

1. Nyisd meg a linket **Safariban** (más böngészőből nem lehet kitűzni).
2. Koppints a Megosztás gombra (négyzet felfelé nyíllal).
3. Görgess le: **Főképernyőhöz adás**, majd **Hozzáadás**.
4. Innentől a kezdőképernyőről indítsd. Az első megnyitás után internet nélkül is működik.

## Mentés, gép és telefon

- Az adat eszközönként külön van. A fő eszköz a telefon.
- Fogaskerék → **Mentés fájlba** (iPhone-on a Fájlokba mentheted), vagy **Mentés vágólapra**.
- Gépen: fogaskerék → **Visszatöltés fájlból** vagy beillesztés. Az import felülírja az adott eszköz adatait.
- Hetente egyszer érdemes menteni (pl. vasárnap a jelentéssel együtt).

## Fejlesztés

```bash
npm install
npm run dev      # helyi szerver
npm run build    # éles build a dist/ mappába
```

A `main` ágra pusholva a GitHub Actions automatikusan kiteszi a GitHub Pagesre.
