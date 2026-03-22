import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const dbPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../data/backoffice.db"
);

console.log(`Seeding database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---------------------------------------------------------------------------
// 1. DDL – drop & recreate all tables
// ---------------------------------------------------------------------------

db.exec(`
DROP TABLE IF EXISTS listing_snapshots;
DROP TABLE IF EXISTS viewings;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS clients;

CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at DATE,
  updated_at DATE
);

CREATE TABLE properties (
  id INTEGER PRIMARY KEY,
  address TEXT NOT NULL,
  city TEXT DEFAULT 'Praha',
  district TEXT,
  type TEXT,
  disposition TEXT,
  area_m2 REAL,
  price REAL,
  status TEXT,
  renovation_status TEXT,
  building_modifications TEXT,
  energy_rating TEXT,
  description TEXT,
  listed_at DATE,
  sold_at DATE,
  owner_id INTEGER REFERENCES clients(id)
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  property_id INTEGER REFERENCES properties(id),
  status TEXT,
  source TEXT,
  notes TEXT,
  created_at DATE,
  converted_at DATE
);

CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  buyer_id INTEGER REFERENCES clients(id),
  seller_id INTEGER REFERENCES clients(id),
  price REAL,
  commission REAL,
  sold_at DATE,
  notes TEXT
);

CREATE TABLE viewings (
  id INTEGER PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  client_id INTEGER REFERENCES clients(id),
  scheduled_at DATETIME,
  status TEXT,
  feedback TEXT,
  created_at DATE
);

CREATE TABLE listing_snapshots (
  id INTEGER PRIMARY KEY,
  source TEXT,
  external_id TEXT,
  url TEXT,
  title TEXT,
  price REAL,
  area_m2 REAL,
  district TEXT,
  first_seen DATE,
  last_seen DATE,
  is_new BOOLEAN DEFAULT 1
);
`);

console.log("Tables created.");

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 0): number {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(decimals));
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function datetimeStr(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function randomDate(from: Date, to: Date): Date {
  const f = from.getTime();
  const t = to.getTime();
  return new Date(f + Math.random() * (t - f));
}

function czechPhone(): string {
  const prefixes = ["601", "602", "603", "604", "605", "606", "607", "608", "702", "720", "721", "722", "723", "724", "725", "730", "731", "732", "733", "734", "736", "737", "739", "770", "771", "773", "774", "775", "776", "777", "778"];
  const prefix = pick(prefixes);
  const rest = String(randInt(100000, 999999));
  return `+420 ${prefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

function emailFromName(name: string): string {
  const domains = ["seznam.cz", "email.cz", "centrum.cz", "gmail.com", "outlook.cz", "post.cz", "volny.cz"];
  const clean = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
  return `${clean}@${pick(domains)}`;
}

// ---------------------------------------------------------------------------
// 3. Seed data constants
// ---------------------------------------------------------------------------

const firstNamesMale = [
  "Jan", "Petr", "Tomáš", "Martin", "Pavel", "Jiří", "Jakub", "David",
  "Lukáš", "Michal", "Ondřej", "Filip", "Adam", "Vojtěch", "Marek",
  "Daniel", "Radek", "Vladimír", "Karel", "Josef", "Zdeněk", "Milan",
  "Roman", "Stanislav", "František",
];

const firstNamesFemale = [
  "Marie", "Jana", "Eva", "Anna", "Lucie", "Kateřina", "Petra", "Lenka",
  "Tereza", "Veronika", "Hana", "Martina", "Alena", "Monika", "Ivana",
  "Barbora", "Markéta", "Michaela", "Simona", "Kristýna", "Věra",
  "Dagmar", "Jiřina", "Zuzana", "Nikola",
];

const lastNamesMale = [
  "Novák", "Svoboda", "Novotný", "Dvořák", "Černý", "Procházka", "Kučera",
  "Veselý", "Horák", "Němec", "Pospíšil", "Marek", "Pokorný", "Hájek",
  "Jelínek", "Král", "Růžička", "Beneš", "Fiala", "Sedláček", "Doležal",
  "Zeman", "Kolář", "Navrátil", "Čermák",
];

const lastNamesFemale = [
  "Nováková", "Svobodová", "Novotná", "Dvořáková", "Černá", "Procházková",
  "Kučerová", "Veselá", "Horáková", "Němcová", "Pospíšilová", "Marková",
  "Pokorná", "Hájková", "Jelínková", "Králová", "Růžičková", "Benešová",
  "Fialová", "Sedláčková", "Doležalová", "Zemanová", "Kolářová",
  "Navrátilová", "Čermáková",
];

const clientSources = ["web", "doporuceni", "sreality", "bezrealitky", "telefon"];
const clientStatuses = ["active", "active", "active", "inactive", "vip"];

const districts = [
  "Holešovice", "Vinohrady", "Karlín", "Dejvice", "Smíchov",
  "Žižkov", "Letná", "Nusle", "Vršovice", "Bubeneč",
];

const streetsByDistrict: Record<string, string[]> = {
  "Holešovice": ["Tusarova", "Komunardů", "Bubenská", "Janovského", "Heřmanova", "Osadní", "Dělnická", "Dukelských hrdinů", "Argentinská", "U Průhonu"],
  "Vinohrady": ["Vinohradská", "Mánesova", "Slavíkova", "Budečská", "Blanická", "Korunní", "Americká", "Londýnská", "Italská", "Chodská"],
  "Karlín": ["Sokolovská", "Křižíkova", "Thámova", "Vítkova", "Pernerova", "Rohanské nábřeží", "Pobřežní", "Šaldova"],
  "Dejvice": ["Evropská", "Jugoslávských partyzánů", "Národní obrany", "Wuchterlova", "Terronská", "Českomalínská", "Buzulucká"],
  "Smíchov": ["Štefánikova", "Plzeňská", "Nádražní", "Lidická", "Kartouzská", "Preslova", "Holečkova", "Na Bělidle"],
  "Žižkov": ["Seifertova", "Husitská", "Bořivojova", "Chlumova", "Koněvova", "Prokopova", "Táboritská", "Ondříčkova"],
  "Letná": ["Milady Horákové", "Čechova", "Kostelní", "Badeniho", "Nad Štolou", "Ovenecká", "U Letenského sadu"],
  "Nusle": ["Táborská", "Nuselská", "Na Pankráci", "Jaromírova", "Křesomyslova", "Bělehradská", "Vyšehradská"],
  "Vršovice": ["Vršovická", "Kodaňská", "Finská", "Moskevská", "Krymská", "Ruská", "Francouzská"],
  "Bubeneč": ["Čs. armády", "Terronská", "Rooseveltova", "Pod Kaštany", "Gotthardská", "Pelléova", "Šolínova"],
};

const propertyTypes = ["byt", "byt", "byt", "komercni", "dum", "pozemek"];
const dispositions = ["1+kk", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "kancelar"];
const propertyStatuses = ["v_nabidce", "v_nabidce", "v_nabidce", "rezervovano", "prodano", "stazeno"];
const renovationStatuses: (string | null)[] = ["po_rekonstrukci", "pred_rekonstrukci", "castecna", null, null, null];
const energyRatings: (string | null)[] = ["A", "B", "B", "C", "C", "D", "E", "F", "G", null, null];

const leadStatuses = ["novy", "novy", "novy", "kontaktovan", "kontaktovan", "kontaktovan", "prohlidka", "prohlidka", "nabidka", "uzavreno", "ztracen", "ztracen"];
const viewingStatuses = ["planovana", "probehnuta", "probehnuta", "probehnuta", "zrusena"];

const viewingFeedbacks = [
  "Klient má zájem, chce vidět znovu s partnerkou.",
  "Byt se líbil, ale cena je příliš vysoká.",
  "Skvělá lokace, ale malá kuchyň.",
  "Klient hledá něco většího.",
  "Nadšení z výhledu, zvažují nabídku.",
  "Nelíbil se stav koupelny, potřebuje rekonstrukci.",
  "Ideální pro investici, klient chce jednat o ceně.",
  "Příliš hlučná ulice, nezájem.",
  "Klient se vrátí příští týden s rodinou.",
  "Velmi pozitivní reakce, další krok je nabídka.",
  "Nesplňuje požadavky na parkování.",
  "Byt odpovídá popisu, klient si to rozmyslí.",
  "Potřebuje novou kuchyňskou linku, jinak ok.",
  "Klient chce slevu kvůli stavu podlah.",
  "Prohlídka zrušena klientem na poslední chvíli.",
  "Klient má předschválenou hypotéku, vážný zájemce.",
  null,
  null,
  null,
];

const clientNotes = [
  "Hledá investiční byt v Praze 7.",
  "Preferuje novostavby.",
  "Má předschválenou hypotéku do 8 mil.",
  "Prodává byt ve Vršovicích, hledá větší.",
  "Doporučen od Petra Nováka.",
  "Zajímá se o komerční prostory.",
  "Investor, vlastní 3 byty v Praze.",
  "Stěhuje se z Brna, potřebuje rychle.",
  "Hledá byt pro dceru, studentku.",
  "VIP klient, dlouhodobá spolupráce.",
  null,
  null,
  null,
  null,
  null,
];

const buildingMods: (string | null)[] = [
  "Nová kuchyňská linka 2024",
  "Rekonstrukce koupelny 2023",
  "Nová elektroinstalace",
  "Zateplení fasády 2024",
  "Nové rozvody vody",
  "Výměna oken za plastová",
  "Nové podlahy v celém bytě",
  null, null, null, null, null, null,
];

// ---------------------------------------------------------------------------
// 4. Generate data
// ---------------------------------------------------------------------------

const now = new Date("2026-03-22");
const twelveMonthsAgo = new Date("2025-04-01");
const sixMonthsAgo = new Date("2025-10-01");
const q1Start = new Date("2026-01-01");

// -- CLIENTS (55 total) --
interface ClientRow {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const clients: ClientRow[] = [];

function makeClient(createdAt: Date): ClientRow {
  const isMale = Math.random() > 0.5;
  const first = pick(isMale ? firstNamesMale : firstNamesFemale);
  const last = pick(isMale ? lastNamesMale : lastNamesFemale);
  const name = `${first} ${last}`;
  const updated = randomDate(createdAt, now);
  return {
    name,
    email: emailFromName(name),
    phone: czechPhone(),
    source: pick(clientSources),
    status: pick(clientStatuses),
    notes: pick(clientNotes),
    created_at: dateStr(createdAt),
    updated_at: dateStr(updated),
  };
}

// 40 clients spread over the full 12 months (before Q1 2026)
for (let i = 0; i < 40; i++) {
  clients.push(makeClient(randomDate(twelveMonthsAgo, new Date("2025-12-31"))));
}

// 15 clients in Q1 2026 (Jan-Mar) – ensures use case 1 has 10-15 results
const q1Sources = ["web", "doporuceni", "sreality", "bezrealitky", "telefon", "web", "sreality", "doporuceni", "web", "bezrealitky", "telefon", "doporuceni", "web", "sreality", "bezrealitky"];
for (let i = 0; i < 15; i++) {
  const c = makeClient(randomDate(q1Start, now));
  c.source = q1Sources[i];
  clients.push(c);
}

// -- PROPERTIES (35 total) --
interface PropertyRow {
  address: string;
  city: string;
  district: string;
  type: string;
  disposition: string;
  area_m2: number;
  price: number;
  status: string;
  renovation_status: string | null;
  building_modifications: string | null;
  energy_rating: string | null;
  description: string;
  listed_at: string;
  sold_at: string | null;
  owner_id: number;
}

const properties: PropertyRow[] = [];

function priceForType(type: string, area: number): number {
  switch (type) {
    case "komercni":
      return randFloat(10_000_000, 30_000_000, 0);
    case "dum":
      return randFloat(8_000_000, 25_000_000, 0);
    case "pozemek":
      return randFloat(3_000_000, 15_000_000, 0);
    default: // byt
      return randFloat(2_000_000, 15_000_000, 0);
  }
}

function areaForType(type: string, disp: string): number {
  if (type === "komercni") return randFloat(50, 300, 1);
  if (type === "dum") return randFloat(100, 250, 1);
  if (type === "pozemek") return randFloat(200, 1200, 1);
  // byt
  switch (disp) {
    case "1+kk": return randFloat(25, 45, 1);
    case "2+kk": return randFloat(40, 65, 1);
    case "2+1": return randFloat(50, 70, 1);
    case "3+kk": return randFloat(60, 90, 1);
    case "3+1": return randFloat(70, 100, 1);
    case "4+kk": return randFloat(85, 130, 1);
    default: return randFloat(30, 80, 1);
  }
}

// Ensure at least 8 properties explicitly have NULL renovation_status
const forceNullRenovation = new Set<number>();
while (forceNullRenovation.size < 8) {
  forceNullRenovation.add(randInt(0, 34));
}

for (let i = 0; i < 35; i++) {
  const district = pick(districts);
  const streets = streetsByDistrict[district];
  const street = pick(streets);
  const houseNum = randInt(1, 80);
  const type = pick(propertyTypes);
  const disp = type === "komercni" ? "kancelar" : type === "pozemek" ? "1+kk" : pick(dispositions.filter((d) => d !== "kancelar"));
  const area = areaForType(type, disp);
  const price = priceForType(type, area);
  const status = pick(propertyStatuses);
  const listedAt = randomDate(twelveMonthsAgo, now);

  let renovation = pick(renovationStatuses);
  let bMods = pick(buildingMods);
  if (forceNullRenovation.has(i)) {
    renovation = null;
    bMods = null;
  }

  const descriptions: Record<string, string[]> = {
    byt: [
      `Světlý byt ${disp} v žádané lokalitě ${district}.`,
      `Prostorný byt s balkónem v klidné části ${district}.`,
      `Moderní byt po rekonstrukci, ${district}.`,
      `Cihlový byt s výhledem, ${district}.`,
      `Útulný byt v centru ${district}, ihned volný.`,
    ],
    komercni: [
      `Komerční prostor vhodný pro kanceláře, ${district}.`,
      `Obchodní prostor s výlohou v ${district}.`,
      `Reprezentativní kancelář v centru ${district}.`,
    ],
    dum: [
      `Rodinný dům se zahradou, ${district}.`,
      `Řadový dům v klidné ulici, ${district}.`,
    ],
    pozemek: [
      `Stavební pozemek v ${district}, IS na hranici.`,
      `Pozemek s územním rozhodnutím, ${district}.`,
    ],
  };

  properties.push({
    address: `${street} ${houseNum}`,
    city: "Praha",
    district,
    type,
    disposition: type === "pozemek" ? null! : disp,
    area_m2: area,
    price,
    status,
    renovation_status: renovation,
    building_modifications: bMods,
    energy_rating: pick(energyRatings),
    description: pick(descriptions[type] || descriptions.byt),
    listed_at: dateStr(listedAt),
    sold_at: status === "prodano" ? dateStr(randomDate(listedAt, now)) : null,
    owner_id: randInt(1, clients.length),
  });
}

// -- LEADS (120 total) --
// Distribute with growing trend: earlier months fewer, later months more
interface LeadRow {
  client_id: number;
  property_id: number;
  status: string;
  source: string;
  notes: string | null;
  created_at: string;
  converted_at: string | null;
}

const leads: LeadRow[] = [];

// Monthly distribution (Oct 2025 – Mar 2026): 10, 12, 15, 18, 22, 25 = 102
// Plus 18 older ones for history
const monthlyLeadCounts = [
  { from: new Date("2025-04-01"), to: new Date("2025-09-30"), count: 18 },
  { from: new Date("2025-10-01"), to: new Date("2025-10-31"), count: 10 },
  { from: new Date("2025-11-01"), to: new Date("2025-11-30"), count: 12 },
  { from: new Date("2025-12-01"), to: new Date("2025-12-31"), count: 15 },
  { from: new Date("2026-01-01"), to: new Date("2026-01-31"), count: 18 },
  { from: new Date("2026-02-01"), to: new Date("2026-02-28"), count: 22 },
  { from: new Date("2026-03-01"), to: new Date("2026-03-22"), count: 25 },
];

const leadNotes = [
  "Klient reagoval na inzerát na Sreality.",
  "Telefonický dotaz na cenu.",
  "Poptávka přes webový formulář.",
  "Doporučení od stávajícího klienta.",
  "Klient viděl nemovitost na Bezrealitky.",
  "Zájem o prohlídku o víkendu.",
  "Urgentní poptávka, stěhuje se do měsíce.",
  "Investor hledá výnos nad 4 %.",
  null,
  null,
];

for (const bucket of monthlyLeadCounts) {
  for (let i = 0; i < bucket.count; i++) {
    const createdAt = randomDate(bucket.from, bucket.to);
    const status = pick(leadStatuses);
    const convertedAt = status === "uzavreno" ? dateStr(randomDate(createdAt, now)) : null;
    leads.push({
      client_id: randInt(1, clients.length),
      property_id: randInt(1, properties.length),
      status,
      source: pick(clientSources),
      notes: pick(leadNotes),
      created_at: dateStr(createdAt),
      converted_at: convertedAt,
    });
  }
}

// -- SALES (25 total) --
// Growing trend: earlier months fewer, later months more
interface SaleRow {
  property_id: number;
  buyer_id: number;
  seller_id: number;
  price: number;
  commission: number;
  sold_at: string;
  notes: string | null;
}

const sales: SaleRow[] = [];
const saleMonthlyCounts = [
  { from: new Date("2025-10-01"), to: new Date("2025-10-31"), count: 2 },
  { from: new Date("2025-11-01"), to: new Date("2025-11-30"), count: 3 },
  { from: new Date("2025-12-01"), to: new Date("2025-12-31"), count: 3 },
  { from: new Date("2026-01-01"), to: new Date("2026-01-31"), count: 5 },
  { from: new Date("2026-02-01"), to: new Date("2026-02-28"), count: 6 },
  { from: new Date("2026-03-01"), to: new Date("2026-03-22"), count: 6 },
];

const saleNotes = [
  "Hladký průběh, klient spokojený.",
  "Prodej po druhé prohlídce.",
  "Složitější jednání o ceně, sleva 200 tis.",
  "Rychlý prodej, do týdne od inzerátu.",
  "Hypotéka schválena bez problémů.",
  "Klient zaplatil hotově.",
  "Prodej investičního bytu.",
  null,
  null,
];

for (const bucket of saleMonthlyCounts) {
  for (let i = 0; i < bucket.count; i++) {
    const propIdx = randInt(0, properties.length - 1);
    const price = properties[propIdx].price * randFloat(0.92, 1.05, 2);
    const commissionRate = randFloat(0.02, 0.04, 3);
    const buyer = randInt(1, clients.length);
    let seller = randInt(1, clients.length);
    while (seller === buyer) seller = randInt(1, clients.length);

    sales.push({
      property_id: propIdx + 1,
      buyer_id: buyer,
      seller_id: seller,
      price: Math.round(price),
      commission: Math.round(price * commissionRate),
      sold_at: dateStr(randomDate(bucket.from, bucket.to)),
      notes: pick(saleNotes),
    });
  }
}

// -- VIEWINGS (45 total) --
interface ViewingRow {
  property_id: number;
  client_id: number;
  scheduled_at: string;
  status: string;
  feedback: string | null;
  created_at: string;
}

const viewings: ViewingRow[] = [];

// 30 past viewings (probehnuta / zrusena)
for (let i = 0; i < 30; i++) {
  const createdAt = randomDate(sixMonthsAgo, new Date("2026-03-15"));
  const scheduledAt = randomDate(createdAt, new Date(createdAt.getTime() + 14 * 86400000));
  const status = Math.random() < 0.15 ? "zrusena" : "probehnuta";
  viewings.push({
    property_id: randInt(1, properties.length),
    client_id: randInt(1, clients.length),
    scheduled_at: datetimeStr(scheduledAt),
    status,
    feedback: status === "probehnuta" ? pick(viewingFeedbacks) : pick(["Klient zrušil z osobních důvodů.", "Přesunuto na jiný termín.", null]),
    created_at: dateStr(createdAt),
  });
}

// 15 future viewings (planovana)
for (let i = 0; i < 15; i++) {
  const createdAt = randomDate(new Date("2026-03-10"), now);
  const scheduledAt = randomDate(new Date("2026-03-23"), new Date("2026-04-15"));
  // Set time between 9:00-17:00
  scheduledAt.setHours(randInt(9, 17), pick([0, 0, 30]), 0, 0);
  viewings.push({
    property_id: randInt(1, properties.length),
    client_id: randInt(1, clients.length),
    scheduled_at: datetimeStr(scheduledAt),
    status: "planovana",
    feedback: null,
    created_at: dateStr(createdAt),
  });
}

// -- LISTING SNAPSHOTS (18 total, focused on Holešovice) --
interface SnapshotRow {
  source: string;
  external_id: string;
  url: string;
  title: string;
  price: number;
  area_m2: number;
  district: string;
  first_seen: string;
  last_seen: string;
  is_new: number;
}

const snapshots: SnapshotRow[] = [];

const snapshotTitles = [
  "Prodej bytu 2+kk, Holešovice, Praha 7",
  "Byt 3+1, Tusarova, Holešovice",
  "Moderní 1+kk, Komunardů, Praha 7",
  "Prostorný 2+1, Bubenská, Holešovice",
  "Byt 3+kk s balkonem, Janovského",
  "Investiční byt 1+kk, Holešovice",
  "Cihlový 2+kk, Dělnická, Praha 7",
  "Byt 4+kk, Heřmanova, Holešovice",
  "Novostavba 2+kk, Argentinská",
  "Světlý byt 2+1, Osadní, Praha 7",
  "Byt po rekonstrukci 3+kk, Holešovice",
  "Podkrovní 2+kk, U Průhonu",
  "Byt 1+kk, Dukelských hrdinů",
  "Mezonet 3+kk, Holešovice, Praha 7",
  "Garsonka, Komunardů, Praha 7",
  "Byt 2+kk s terasou, Bubenská",
  "Prodej 3+1, Letná / Holešovice",
  "Byt 2+kk, novostavba, Holešovice",
];

for (let i = 0; i < 18; i++) {
  const source = i % 2 === 0 ? "sreality" : "bezrealitky";
  const extId = source === "sreality" ? `SR-${randInt(100000, 999999)}` : `BR-${randInt(10000, 99999)}`;
  const baseUrl = source === "sreality" ? "https://www.sreality.cz/detail/prodej/byt/" : "https://www.bezrealitky.cz/nemovitosti-byty-domy/";
  const firstSeen = randomDate(new Date("2026-02-01"), new Date("2026-03-20"));
  const lastSeen = randomDate(firstSeen, now);
  const isNew = i < 10 ? 1 : 0; // 10 new, 8 old

  snapshots.push({
    source,
    external_id: extId,
    url: `${baseUrl}${extId.toLowerCase()}`,
    title: snapshotTitles[i],
    price: randFloat(2_500_000, 12_000_000, 0),
    area_m2: randFloat(25, 110, 1),
    district: i < 15 ? "Holešovice" : pick(["Letná", "Bubeneč", "Dejvice"]),
    first_seen: dateStr(firstSeen),
    last_seen: dateStr(lastSeen),
    is_new: isNew,
  });
}

// ---------------------------------------------------------------------------
// 5. Insert everything inside a transaction
// ---------------------------------------------------------------------------

const insertClient = db.prepare(`
  INSERT INTO clients (name, email, phone, source, status, notes, created_at, updated_at)
  VALUES (@name, @email, @phone, @source, @status, @notes, @created_at, @updated_at)
`);

const insertProperty = db.prepare(`
  INSERT INTO properties (address, city, district, type, disposition, area_m2, price, status, renovation_status, building_modifications, energy_rating, description, listed_at, sold_at, owner_id)
  VALUES (@address, @city, @district, @type, @disposition, @area_m2, @price, @status, @renovation_status, @building_modifications, @energy_rating, @description, @listed_at, @sold_at, @owner_id)
`);

const insertLead = db.prepare(`
  INSERT INTO leads (client_id, property_id, status, source, notes, created_at, converted_at)
  VALUES (@client_id, @property_id, @status, @source, @notes, @created_at, @converted_at)
`);

const insertSale = db.prepare(`
  INSERT INTO sales (property_id, buyer_id, seller_id, price, commission, sold_at, notes)
  VALUES (@property_id, @buyer_id, @seller_id, @price, @commission, @sold_at, @notes)
`);

const insertViewing = db.prepare(`
  INSERT INTO viewings (property_id, client_id, scheduled_at, status, feedback, created_at)
  VALUES (@property_id, @client_id, @scheduled_at, @status, @feedback, @created_at)
`);

const insertSnapshot = db.prepare(`
  INSERT INTO listing_snapshots (source, external_id, url, title, price, area_m2, district, first_seen, last_seen, is_new)
  VALUES (@source, @external_id, @url, @title, @price, @area_m2, @district, @first_seen, @last_seen, @is_new)
`);

const seed = db.transaction(() => {
  for (const c of clients) insertClient.run(c);
  for (const p of properties) insertProperty.run(p);
  for (const l of leads) insertLead.run(l);
  for (const s of sales) insertSale.run(s);
  for (const v of viewings) insertViewing.run(v);
  for (const sn of snapshots) insertSnapshot.run(sn);
});

seed();

// ---------------------------------------------------------------------------
// 6. Summary
// ---------------------------------------------------------------------------

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n;

console.log("\n--- Seed complete ---");
console.log(`  clients:            ${count("clients")}`);
console.log(`  properties:         ${count("properties")}`);
console.log(`  leads:              ${count("leads")}`);
console.log(`  sales:              ${count("sales")}`);
console.log(`  viewings:           ${count("viewings")}`);
console.log(`  listing_snapshots:  ${count("listing_snapshots")}`);

// Quick validation queries
const q1Clients = (db.prepare(`SELECT COUNT(*) as n FROM clients WHERE created_at >= '2026-01-01'`).get() as { n: number }).n;
console.log(`\n  Q1 2026 new clients: ${q1Clients}`);

const nullRenovation = (db.prepare(`SELECT COUNT(*) as n FROM properties WHERE renovation_status IS NULL`).get() as { n: number }).n;
console.log(`  Properties with NULL renovation_status: ${nullRenovation}`);

const leadsPerMonth = db.prepare(`
  SELECT substr(created_at, 1, 7) as month, COUNT(*) as n
  FROM leads
  WHERE created_at >= '2025-10-01'
  GROUP BY month
  ORDER BY month
`).all() as { month: string; n: number }[];
console.log(`\n  Leads trend (monthly):`);
for (const row of leadsPerMonth) {
  console.log(`    ${row.month}: ${row.n}`);
}

db.close();
console.log("\nDone.");
