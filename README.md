# DriverStreak

Streak-spel i Trafiko-stil, övningsprov och ämnesövning för **kunskapsprovet, behörighet B** (Trafikverket). Byggd som en installerbar webbapp (PWA) för iPhone och iPad.

- **Streak** – svara på så många frågor i rad som möjligt mot klockan. 1 200 poäng max per svar, linjärt mot tiden kvar (9 s för vägmärken, 20 s för textfrågor). Ett fel eller time-out avslutar omgången. Bonus vid 5, 10, 20… rätt i rad.
- **Övningsprov** – 65 frågor, 50 minuter, 52 rätt för godkänt, med flaggning, översikt och genomgång.
- **Övning** – per ämne/delämne utan tidspress, med förklaringar och repetition av dina fel.
- **Skyltlexikon** och **statistik** (dagsstreak, träffsäkerhet, provhistorik).

## Utveckling

```bash
npm install
npm run dev          # http://localhost:5173/driverstreak/
npm test             # motor, lagring och innehållsvalidering
npm run validate -- --coverage
npm run fetch-signs  # hämtar vägmärkes-SVG:er från Wikimedia Commons
npm run build
```

Innehåll ligger i `content/` (frågor per batch i `content/questions/*.json`, vägmärken i `content/signs/signs.json`). Riktlinjer för frågor: `content/AUTHORING.md`.

## Publicering

Push till `main` bygger och publicerar till GitHub Pages via `.github/workflows/deploy.yml`.

## Källor och licens

Vägmärkesbilder: Transportstyrelsen via Wikimedia Commons (public domain). Frågorna är egenförfattade för övning och är **inofficiella** – kontrollera alltid mot Transportstyrelsen, Trafikförordningen och aktuell Körkortsbok. Spelmekaniken är inspirerad av Trafikos vägmärkesspel; inget material från Trafiko används.
