# Edge Function: `delete-account`

Löscht das Konto des aufrufenden Users (DSGVO + Apple-Pflicht). Der
`service_role`-Key bleibt serverseitig — der Client schickt nur sein JWT,
die Function leitet die `user.id` daraus ab.

## Einmalig deployen

Voraussetzung: [Supabase CLI](https://supabase.com/docs/guides/cli) installiert
und eingeloggt (`supabase login`).

```bash
# Projekt-Root, einmalig mit dem Projekt verknüpfen:
supabase link --project-ref <DEIN_PROJECT_REF>

# Function deployen:
supabase functions deploy delete-account
```

`<DEIN_PROJECT_REF>` steht im Supabase-Dashboard unter
*Project Settings → General → Reference ID*.

## Secrets

Werden von Supabase **automatisch** in jede Edge Function injiziert — nichts
zu tun:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testen

1. In der App eingeloggt → Klick auf den User-Chip (oben rechts) → „Konto".
2. In der Gefahrenzone `LÖSCHEN` eintippen → „Konto endgültig löschen".
3. Erwartung: Toast „Konto gelöscht", Rückkehr zum Login. In Supabase
   (*Authentication → Users*) ist der User weg; alle `public`-Zeilen sind
   per `ON DELETE CASCADE` mitgelöscht.

## Lokal (optional)

```bash
supabase functions serve delete-account --env-file ./supabase/.env.local
```

Eine lokale `.env.local` mit den drei Secrets ist dafür nötig (gitignored).
