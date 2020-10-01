const COUNTRIES = [
    "Arstotzka",
    "Antegria",
    "Impor",
    "Kolechia",
    "Obristan",
    "Republia",
    "United Federation"
];
const EXPIRE_DATE = new Date("1982.11.22");
const DOCUMENTS = {
    entrants: ["passport", "certificate of vaccination"],
    native: ["ID_card"],
    foreigners: [
        "access permit",
        "work pass",
        "grant of asylum",
        "diplomatic authorization"
    ]
};
const VALID_DOC_NAMES = {
    id: "ID number",
    grant_of_asylum: "grant of asylum",
    access_permit: "access permit",
    work_pass: "work pass"
};
const MSG = {
    success: {
        native: "Glory to Arstotzka.",
        foreigner: "Cause no trouble."
    },
    fail: {
        missingDocuments: {
            msg: "Entry denied: missing required _."
        },
        expired: {
            msg: "Entry denied: _ expired."
        },
        nationDenied: {
            msg: "Entry denied: citizen of banned nation."
        },
        criminal: {
            msg: "Detainment: Entrant is a wanted criminal."
        },
        mismatch: {
            msg: "Detainment: _ mismatch."
        }
    }
};
const FAIL_REASON_WEIGHT = {
    missingDocuments: 0,
    expired: 5,
    nationDenied: 0,
    criminal: 4,
    mismatch: 3
};

class Document {
    constructor({ type, data }) {
        this.type = type;
        this.fields = data.split("\n");
    }
    get id() {
        return this.getValue("ID");
    }
    get name() {
        return this.getValue("NAME");
    }
    get nationality() {
        return this.getValue("NATION");
    }
    get dob() {
        return this.getValue("DOB");
    }
    get purpose() {
        return this.getValue("PURPOSE");
    }
    get expDate() {
        return new Date(this.getValue("EXP"));
    }
    get isExpired() {
        return this.expDate <= EXPIRE_DATE;
    }
    get access() {
        let accessInDoc = this.getValue("ACCESS");
        if (accessInDoc) return accessInDoc.split(", ");
        return;
    }
    getValue(prop) {
        let val = this.fields.filter((str) => str.includes(prop))[0];
        if (!val) return;
        if (this.isDate(val)) return val;
        else return val.split(":")[1].trim();
    }
    isDate(str) {
        return !!str.match(/\d\d\d\d\.\d\d\.\d\d/);
    }
}
class Entrant {
    constructor(data) {
        this.data = data;
        this.documents = [];
        this.vaccinations = [];
        this.parseDocuments();
    }
    parseDocuments() {
        Object.entries(this.data).forEach(([key, val]) => {
            this.documents.push(new Document({ type: key, data: val }));
        });
    }
    compareDocuments() {
        let fields = ["name", "nationality", "id"];
        return fields.reduce((acc, field) => {
            let arr = this.documents.map((doc) => doc[field]);
            if (this.check(field, arr)) return [...acc, field];
            return acc;
        }, []);
    }
    check(label, arr) {
        let isValid = arr.every((it, i, array) => it == array[0]);
        if (!isValid) return label;
    }
    get name() {
        if (this.docs.length == 0) return "";
        return this.documents[0].name;
    }
    get nationality() {
        return this.documents[0] ? this.documents[0].nationality : "";
    }
    get isForeigner() {
        return this.nationality != "Arstotzka";
    }
    get isWorker() {
        return this.isForeigner && this.purpose == "WORK";
    }
    get purpose() {
        let access = this.getDocument("access_permit");
        if (access) return access.purpose;
    }
    get docs() {
        return this.documents.map((d) => d.type);
    }
    get isDiplomat() {
        return this.docs.includes("diplomatic_authorization");
    }
    checkDocumentsDateValidity() {
        let result = [];
        this.documents.forEach((doc) => {
            if (doc.isExpired && doc.type !== "diplomatic_authorization")
                result.push(doc.type);
        });
        return result;
    }
    getDocument(type) {
        let doc = this.documents.filter((d) => d.type == type)[0];
        if (doc) return doc;
        else console.warn(`There is no ${type} document`);
    }
    getNameForCriminalityCheck() {
        if (this.name) {
            let [last, first] = this.name.split(",");
            return `${first.trim()} ${last.trim()}`;
        } else return "";
    }
}
class Validator {
    addRules(rules) {
        this.entryRules = rules;
    }
    check(entrant) {
        let verdict = new Map();

        this.checkRequiredDocuments(entrant.docs, verdict);
        this.checkDates(entrant, verdict);
        this.checkDocumentsValidity(entrant, verdict);
        this.checkAllowedCountries(entrant, verdict);
        this.checkCriminality(entrant, verdict);
        if (this.isSuccess(verdict))
            return {
                status: "SUCCESS",
                type: entrant.isForeigner ? "foreigner" : "native"
            };
        let { reason, document } = this.getFailDetails(verdict);
        return {
            status: "FAIL",
            reason,
            document
        };
    }
    checkCriminality(entrant, verdict) {
        verdict.set(
            "criminal",
            this.entryRules.wantedCriminals.includes(
                entrant.getNameForCriminalityCheck()
            )
                ? [entrant.name]
                : []
        );
    }
    getFailDetails(verdict) {
        let res = { reason: "", document: "" };
        let failure = Array.from(verdict.entries())
            .filter(([key, arr]) => arr.length)
            .sort(
                (a, b) =>
                    FAIL_REASON_WEIGHT[MSG.fail[b[0]]] -
                    FAIL_REASON_WEIGHT[MSG.fail[a[0]]]
            )[0];

        res.reason = failure[0];
        let lastDoc = failure[1][failure[1].length - 1];
        res.document = VALID_DOC_NAMES[lastDoc] || lastDoc;

        return res;
    }
    checkRequiredDocuments(entrantDocs, verdict) {
        verdict.set("missingDocuments", []);
        this.entryRules.requiredDocuments.forEach((doc) => {
            if (!entrantDocs.includes(doc))
                verdict.get("missingDocuments").push(doc);
        });
    }
    checkDocumentsValidity(entrant, verdict) {
        verdict.set("mismatch", entrant.compareDocuments());
    }
    checkDates(entrant, verdict) {
        verdict.set("expired", entrant.checkDocumentsDateValidity());
    }
    checkAllowedCountries(entrant, verdict) {
        verdict.set("nationDenied", []);
        if (
            entrant.isDiplomat &&
            entrant
                .getDocument("diplomatic_authorization")
                .access.includes("Arstotzka")
        )
            return;
        if (!this.entryRules.nationsEnter.includes(entrant.nationality))
            verdict.get("nationDenied").push(entrant.nationality);
    }
    getPieceOfData(prop) {
        return this.entryRules[prop];
    }
    isSuccess(verdict) {
        return Array.from(verdict.values()).every((arr) => arr.length == 0);
    }
}
class Inspector {
    constructor() {
        this.dataFromBulletin = {
            nationsEnter: [],
            nationsDeny: [],
            requiredDocuments: [],
            requiredVaccinations: [],
            wantedCriminals: []
        };
        this.validator = new Validator();
    }
    receiveBulletin(bulletin) {
        console.log("----", bulletin);
        this.splitBulletinString(bulletin);
        this.getBulletinPieceOfData("criminals");
        this.parseDocuments(bulletin);
        this.parseCounteris(bulletin);
        this.parseCrimrinals(bulletin);
        this.parseCounteris(bulletin);
        this.validator.addRules(this.dataFromBulletin);
    }
    splitBulletinString(bulletin) {
        this.bulletinArr = bulletin.split("\n");
    }
    getBulletinPieceOfData(key) {
        let keyPropMap = {
            documents: ["require"],
            nations: ["Allow", "Deny"],
            criminals: ["Wanted"]
        };
        return function () {
            return this.bulletinArr.filter((str) =>
                keyPropMap[key].some((word) => str.includes(word))
            )[0];
        };
    }
    parseDocuments(bulletin) {
        let requireddDocs = this.getPieceOfData("requiredDocuments");
        Object.values(DOCUMENTS)
            .reduce((acc, cur) => [...acc, ...cur])
            .forEach((doc) => {
                if (bulletin.includes(doc)) requireddDocs.push(doc);
            });
    }
    parseCounteris(bulletin) {
        let resultArr = bulletin.includes("Allow")
            ? this.getPieceOfData("nationsEnter")
            : this.getPieceOfData("nationsDeny");

        COUNTRIES.forEach((c) => {
            if (bulletin.includes(c)) resultArr.push(c);
        });
    }
    parseCrimrinals(bulletin) {
        let criminals = this.getPieceOfData("wantedCriminals");
        let wantedStr = bulletin
            .split("\n")
            .filter((arr) => arr.includes("Wanted"))[0];
        if (wantedStr)
            criminals.push(wantedStr.slice(wantedStr.indexOf(":") + 1).trim());
    }
    inspect(entrant) {
        console.log("++++++ ", entrant);
        this.entrant = new Entrant(entrant);
        let data = this.validator.check(this.entrant);
        return this.createMessage(data);
    }
    createMessage(data) {
        return data.status == "SUCCESS"
            ? this.createSuccessMsg(data)
            : this.createFailMessage(data);
    }
    createSuccessMsg(data) {
        console.log(MSG.success[data.type]);
        return MSG.success[data.type];
    }
    createFailMessage(data) {
        console.log(MSG.fail[data.reason].msg.replace("_", data.document));
        return MSG.fail[data.reason].msg.replace("_", data.document);
    }
    getPieceOfData(prop) {
        return this.dataFromBulletin[prop];
    }
}

const inspector = new Inspector();
const bulletin = `Foreigners require access permit
Wanted by the State: Antonia Henriksson`;
inspector.receiveBulletin(bulletin);

let entrant0 = {
    passport: `ID#: S0Z6L-NT2MC
NATION: Arstotzka
NAME: Larsen, Alberta
DOB: 1935.05.01
SEX: F
ISS: Paradizna
EXP: 1982.12.31`
};
let entrant1 = {
    passport: `ID#: EET93-P7RN5
NATION: Obristan
NAME: Kierkgaard, Petr
DOB: 1959.11.03
SEX: M
ISS: Skal
EXP: 1984.10.03`,
    access_permit: `NAME: Kierkgaard, Petr
NATION: Obristan
ID#: EET93-P7RN5
PURPOSE: TRANSIT
DURATION: 2 DAYS
HEIGHT: 163cm
WEIGHT: 66kg
EXP: 1985.03.26`
};
let entrant2 = {
    passport: `ID#: TN265-FJ2PP
NATION: Impor
NAME: Babayev, Ekaterina
DOB: 1928.02.20
SEX: F
ISS: Enkyo
EXP: 1983.05.22`,
    access_permit: `NAME: Babayev, Ekaterina
NATION: Impor
ID#: TXWB6-AP80D
PURPOSE: WORK
DURATION: 1 YEAR
HEIGHT: 156cm
WEIGHT: 56kg
EXP: 1983.12.26`,
    work_pass: `NAME: Babayev, Ekaterina
FIELD: Surveying
EXP: 1981.02.09`
};
let entrants = [entrant0, entrant1, entrant2];
entrants.forEach((e) => inspector.inspect(e));

// Foreigners require access permit
// '{passporty: ID#: S0Z6L-NT2MC\nNATION: Arstotzka\nNAME: Larsen, Alberta\nDOB: 1935.05.01\nSEX: F\nISS: Paradizna\nEXP: 1982.12.31' }
// expected glory

// { passport: 'ID#: EET93-P7RN5\nNATION: Obristan\nNAME: Kierkgaard, Petr\nDOB: 1959.11.03\nSEX: M\nISS: Skal\nEXP: 1984.10.03',access_permit: 'NAME: Kierkgaard, Petr\nNATION: Obristan\nID#: EET93-P7RN5\nPURPOSE: TRANSIT\nDURATION: 2 DAYS\nHEIGHT: 163cm\nWEIGHT: 66kg\nEXP: 1985.03.26' }'
// expected no trouble

// { passport:'ID#: TN265-FJ2PP\nNATION: Impor\nNAME: Babayev, Ekaterina\nDOB: 1928.02.20\nSEX: F\nISS: Enkyo\nEXP: 1983.05.22',access_permit: 'NAME: Babayev, Ekaterina\nNATION: Impor\nID#: TXWB6-AP80D\nPURPOSE: WORK\nDURATION: 1 YEAR\nHEIGHT: 156cm\nWEIGHT: 56kg\nEXP: 1983.12.26',work_pass:'NAME: Babayev, Ekaterina\nFIELD: Surveying\nEXP: 1981.02.09' }
// expected Detainment: ID number mismatch.

//  { passport:'ID#: DNT06-TK134\nNATION: United Federation\nNAME: Rosebrova, Petra\nDOB: 1937.10.05\nSEX: F\nISS: Great Rapid\nEXP: 1984.07.07' }
// expected Entry denied: missing required access permit.
