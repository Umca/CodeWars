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
	foreigners: ["access permit", "work pass", "grant of asylum", "diplomatic authorization"]
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
		missingVaccinations: {
			msg: "Entry denied: missing required vaccination."
		},
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
		},
		diplomaticAuthorization: {
			msg: "Entry denied: invalid diplomatic authorization."
		}
	}
};
const FAIL_REASON_WEIGHT = {
	missingDocuments: 0,
	expired: 3,
	nationDenied: 0,
	criminal: 6,
	mismatch: 5,
	missingVaccinations: 0,
	diplomaticAuthorization: 0
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
	get vaccinations() {
		let vaccines = this.getValue("VACCINES");
		if (vaccines) return vaccines.split(", ");
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
		this.parseDocuments();
	}
	get particularEntrantTypeDocuments() {
		let general = ["passport"];
		if (!this.isForeigner) return [...general, "ID_card"];
		return [
			...general,
			"access_permit",
			"work_pass",
			"grant_of_asylum",
			"diplomatic_authorization"
		];
	}
	parseDocuments() {
		Object.entries(this.data).forEach(([key, val]) => {
			this.documents.push(new Document({ type: key, data: val }));
		});
	}
	compareDocuments() {
		let fields = ["name", "nationality", "id"];
		return fields.reduce((acc, field) => {
			let arr = this.documents.map((doc) => doc[field]).filter((field) => field);
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
	get isAccessibleDiplomat() {
		return (
			this.isDiplomat && this.getDocument("diplomatic_authorization").access.includes("Arstotzka")
		);
	}
	get vaccinations() {
		if (this.docs.includes("certificate_of_vaccination"))
			return this.getDocument("certificate_of_vaccination").vaccinations;
		return [];
	}
	checkDocumentsDateValidity() {
		let result = [];
		this.documents.forEach((doc) => {
			if (doc.isExpired && doc.type !== "diplomatic_authorization") result.push(doc.type);
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
		this.entrant = entrant;
		let result = new Map();

		this.checkRequiredDocuments(result);
		this.checkDates(result);
		this.checkDocumentsValidity(result);
		this.checkAllowedCountries(result);
		this.checkCriminality(result);
		this.checkVaccinations(result);
		this.checkDiplomats(result);

		return result;
	}
	makeVerdict(result) {
		if (this.isSuccess(result))
			return {
				status: "SUCCESS",
				type: this.entrant.isForeigner ? "foreigner" : "native"
			};
		let { reason, document } = this.getFailDetails(result);
		return {
			status: "FAIL",
			reason,
			document
		};
	}
	checkDiplomats(result) {
		result.set("diplomaticAuthorization", []);
		if (!this.entrant.isDiplomat) return;
		if (!this.entrant.isAccessibleDiplomat) result.get("diplomaticAuthorization").push("fail");
	}
	checkVaccinations(result) {
		result.set("missingVaccinations", []);
		this.entryRules.requiredVaccinations.forEach((vac) => {
			if (!this.entrant.vaccinations.includes(vac)) result.get("missingVaccinations").push(vac);
		});
	}
	checkCriminality(result) {
		result.set(
			"criminal",
			this.entryRules.wantedCriminals.includes(this.entrant.getNameForCriminalityCheck())
				? [this.entrant.name]
				: []
		);
	}
	getFailDetails(result) {
		let res = { reason: "", document: "" };
		let failure = Array.from(result.entries())
			.filter(([key, arr]) => arr.length)
			.sort((a, b) => {
				console.log(FAIL_REASON_WEIGHT[b[0]] - FAIL_REASON_WEIGHT[a[0]]);
				return FAIL_REASON_WEIGHT[b[0]] - FAIL_REASON_WEIGHT[a[0]];
			})[0];

		res.reason = failure[0];
		let lastDoc = failure[1][failure[1].length - 1];
		res.document = VALID_DOC_NAMES[lastDoc] || lastDoc;

		return res;
	}
	checkRequiredDocuments(result) {
		result.set("missingDocuments", []);
		this.entryRules.requiredDocuments.forEach((doc) => {
			if (!this.entrant.isForeigner && DOCUMENTS.foreigners.includes(doc.replace(/_/, " "))) return;
			if (this.entrant.isDiplomat && DOCUMENTS.foreigners.includes(doc.replace(/_/, " "))) return;
			if (
				this.entrant.isForeigner &&
				DOCUMENTS.foreigners.includes(doc.replace(/_/, " ")) &&
				this.entrant.docs.includes("grant_of_asylum")
			)
				return;
			if (!this.entrant.docs.length) result.get("missingDocuments").push("passport");
			if (!this.entrant.docs.includes(doc)) result.get("missingDocuments").push(doc);
		});
	}
	checkDocumentsValidity(result) {
		result.set("mismatch", this.entrant.compareDocuments());
	}
	checkDates(result) {
		result.set("expired", this.entrant.checkDocumentsDateValidity());
	}
	checkAllowedCountries(result) {
		result.set("nationDenied", []);
		if (!this.entrant.isForeigner) return;
		if (this.entrant.isAccessibleDiplomat) return;
		if (!this.entryRules.nationsEnter.length || !this.entryRules.nationsDeny.length) return;
		if (!this.entryRules.nationsEnter.includes(this.entrant.nationality))
			result.get("nationDenied").push(this.entrant.nationality);
	}
	getPieceOfData(prop) {
		return this.entryRules[prop];
	}
	isSuccess(result) {
		return Array.from(result.values()).every((arr) => arr.length == 0);
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
		// console.log("----", bulletin);
		this.getBulletinPieceOfData = this.handleBulletin(bulletin);
		this.parseDocuments(this.getBulletinPieceOfData("documents"));
		this.parseCounteris(this.getBulletinPieceOfData("nations"));
		this.parseCriminals(this.getBulletinPieceOfData("criminals"));
		this.parseVaccinations(this.getBulletinPieceOfData("vaccination"));
		this.validator.addRules(this.dataFromBulletin);
	}
	handleBulletin(bulletin) {
		let splittedBulletin = bulletin.split("\n");

		let keyPropMap = {
			documents: ["require"],
			nations: ["Allow", "Deny"],
			criminals: ["Wanted"],
			vaccination: ["vaccination"]
		};
		return function (key) {
			return splittedBulletin.filter((str) =>
				keyPropMap[key].some((word) => str.includes(word))
			)[0];
		};
	}
	parseDocuments(bulletin) {
		if (!bulletin) return;
		let requireddDocs = this.getPieceOfData("requiredDocuments");
		Object.values(DOCUMENTS)
			.reduce((acc, cur) => [...acc, ...cur])
			.forEach((doc) => {
				if (bulletin.includes(doc)) requireddDocs.push(doc.replace(/ /, "_"));
			});
	}
	parseCounteris(bulletin) {
		if (!bulletin) return;
		let resultArr = bulletin.includes("Allow")
			? this.getPieceOfData("nationsEnter")
			: this.getPieceOfData("nationsDeny");

		COUNTRIES.forEach((c) => {
			if (bulletin.includes(c)) resultArr.push(c);
		});
	}
	parseVaccinations(bulletin) {
		if (!bulletin) return;
		let vaccinations = this.getPieceOfData("requiredVaccinations");
		bulletin
			.match(/(?<=require ).+/)[0]
			.replace(/vaccination/g, "")
			.split(",")
			.forEach((vac) => vaccinations.push(vac.trim()));
	}
	parseCriminals(bulletin) {
		if (!bulletin) return;
		let criminals = this.getPieceOfData("wantedCriminals");
		let wantedStr = bulletin.split("\n").filter((arr) => arr.includes("Wanted"))[0];
		if (wantedStr) criminals.push(wantedStr.slice(wantedStr.indexOf(":") + 1).trim());
	}
	inspect(entrant) {
		// console.log("++++++ ", entrant);
		this.entrant = new Entrant(entrant);
		let checkResult = this.validator.check(this.entrant);
		let messageData = this.validator.makeVerdict(checkResult);
		return this.createMessage(messageData);
	}
	createMessage(data) {
		return data.status == "SUCCESS" ? this.createSuccessMsg(data) : this.createFailMessage(data);
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
const bulletin = `Citizens of Arstotzka require ID card
Deny citizens of Kolechia
Wanted by the State: Hubert Romanowski`;
inspector.receiveBulletin(bulletin);

let entrant0 = {
	passport:
		"ID#: QK04D-PGYN9\nNATION: Kolechia\nNAME: Newman, Bernard\nDOB: 1952.07.01\nSEX: M\nISS: Vedor\nEXP: 1982.12.28",
	access_permit:
		"NAME: Newman, Bernard\nNATION: Kolechia\nID#: QK04D-PGYN9\nPURPOSE: TRANSIT\nDURATION: 14 DAYS\nHEIGHT: 186cm\nWEIGHT: 99kg\nEXP: 1984.12.05"
};

let entrants = [entrant0];
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
