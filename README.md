# Huis 3D card

Lichte Lovelace-kaart die een 3D-model van je huis (GLB) toont, met:

- verdiepingen aan/uit en muren volledig, laag of doorzichtig
- lampen die live oplichten (kleur en helderheid uit Home Assistant), tik op een lamp of op het 💡-knopje om te schakelen
- labels voor zonnepanelen (kW) en batterij (%)
- nachtstand, dubbelklik = draaipunt

three.js r160 is in het bestand meegebundeld; de kaart heeft geen internet nodig.

## Installatie (HACS)

1. HACS → ⋮ → *Custom repositories* → deze repository toevoegen, type **Dashboard**.
2. *Huis 3D card* downloaden.
3. Model in `/config/www/huis3d/huis-3d.glb` zetten.

## Gebruik

```yaml
type: custom:huis3d-card
model: /local/huis3d/huis-3d.glb
```

Objectnamen in het model zijn de entity_id met de eerste punt vervangen door `_` (bijv. `light_lamp_bank`), lagen heten `laag_bg`, `laag_v1`, `laag_vl`, `laag_dak` enz.

Testen zonder te schakelen: in de browserconsole `localStorage.huis3d_dryrun = '1'`.
