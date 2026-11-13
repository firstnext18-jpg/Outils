/**
 * Planificateur des tâches automatiques (conteneur « cron »).
 *
 * - Chaque jour à CRON_TIME (heure de Zurich) : route
 *   POST /api/taches/quotidiennes de l'application, avec le secret CRON_SECRET.
 *   Aussi au démarrage du conteneur (rattrapage après une coupure du serveur) :
 *   les tâches ne font jamais deux fois la même chose.
 * - Toutes les MONITOR_MINUTES minutes (5 par défaut, 0 pour arrêter) :
 *   POST /api/taches/surveillance (vérification des sites des clients).
 * Sans dépendance : Node seul, dans l'image de l'application.
 */
const url = process.env.CRON_URL ?? "http://app:3000/api/taches/quotidiennes";
const monitorUrl = process.env.MONITOR_URL ?? url.replace(/quotidiennes\/?$/, "surveillance");
const monitorMinutes = Number(process.env.MONITOR_MINUTES ?? "5");
const secret = process.env.CRON_SECRET ?? "";
const time = process.env.CRON_TIME ?? "06:00";
const runOnStart = process.env.CRON_RUN_ON_START !== "false";

if (secret.length < 32) {
  console.error("CRON_SECRET manquant ou trop court (32 caractères minimum).");
  process.exit(1);
}
const match = time.match(/^(\d{1,2}):(\d{2})$/);
if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
  console.error(`CRON_TIME invalide : ${time} (format HH:MM attendu).`);
  process.exit(1);
}
const target = Number(match[1]) * 3600 + Number(match[2]) * 60;

/** Secondes écoulées depuis minuit, à Zurich. */
function zurichSecondsOfDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

function msUntilNextRun() {
  let seconds = target - zurichSecondsOfDay();
  if (seconds <= 0) seconds += 24 * 3600;
  return seconds * 1000;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Un appel, avec quelques nouvelles tentatives si l'application n'est pas encore prête. */
async function run() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body = await response.text();
      console.log(`${new Date().toISOString()} tâches quotidiennes : ${response.status} ${body}`);
      // 409 : une exécution est déjà en cours ; 401/503 : configuration à corriger.
      if (response.ok || [401, 409, 503].includes(response.status)) return;
    } catch (error) {
      console.error(
        `${new Date().toISOString()} application injoignable (essai ${attempt})`,
        error.message,
      );
    }
    await sleep(60_000);
  }
}

/** Surveillance des sites : un passage, puis attente (jamais deux en même temps). */
async function monitorLoop() {
  if (!Number.isFinite(monitorMinutes) || monitorMinutes <= 0) {
    console.log("Surveillance des sites désactivée (MONITOR_MINUTES=0).");
    return;
  }
  const every = Math.max(1, monitorMinutes) * 60_000;
  await sleep(60_000); // laisse l'application démarrer
  for (;;) {
    const started = Date.now();
    try {
      const response = await fetch(monitorUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(10 * 60_000),
      });
      if (!response.ok && response.status !== 409) {
        console.error(
          `${new Date().toISOString()} surveillance des sites : ${response.status} ${await response.text()}`,
        );
      }
    } catch (error) {
      console.error(`${new Date().toISOString()} surveillance des sites impossible`, error.message);
    }
    await sleep(Math.max(30_000, every - (Date.now() - started)));
  }
}

async function dailyLoop() {
  if (runOnStart) {
    await sleep(30_000); // laisse l'application démarrer
    await run();
  }
  for (;;) {
    let wait = msUntilNextRun();
    console.log(
      `Prochaine exécution dans ${Math.round(wait / 60_000)} minutes (${time}, heure de Zurich).`,
    );
    // Attente par tranches d'une heure au plus : l'heure reste juste lors des
    // passages à l'heure d'été ou d'hiver.
    while (wait > 3_600_000) {
      await sleep(3_600_000);
      wait = msUntilNextRun();
    }
    await sleep(wait);
    await run();
  }
}

await Promise.all([dailyLoop(), monitorLoop()]);
