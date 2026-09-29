// Reading a school's own spreadsheet of children (Excel or CSV) into
// children + parents. Deliberately forgiving about headings: a school
// uploading the list it already keeps shouldn't have to rename columns.
//
// Headings are compared in a "compact" form -- lowercase letters and digits
// only -- so "Child's Name", "childs name", "CHILD NAME" and "Child_Name"
// all read the same, and "ID No." / "id number" / "ID" line up too.
// Parent columns may be numbered ("Parent 1 Name", "Parent 2 Surname", Dylan
// 28 Sept 2026) or un-numbered ("Parent First Name", the older template);
// un-numbered means parent 1.

export function compactHeader(h: string): string {
  let c = h.toLowerCase().replace(/[^a-z0-9]/g, "");
  // "childs name" / "child's name" -> "childname"
  c = c.replace(/^childs/, "child");
  // "parents name" (un-numbered) -> "parentname"; "parent one" -> parent1
  c = c.replace(/^parents(?!\d)/, "parent").replace(/^parentone/, "parent1").replace(/^parenttwo/, "parent2");
  return c;
}

const CHILD_FIELDS = {
  firstName: ["childname", "childfirstname", "firstname", "name", "childnames"],
  lastName: ["childsurname", "childlastname", "surname", "lastname", "childfamilyname"],
  idNumber: ["childid", "childidno", "childidnumber", "idno", "idnumber", "id", "childsid"],
  dateOfBirth: ["dateofbirth", "dob", "birthdate", "birthday", "childdob", "childdateofbirth"],
  gender: ["gender", "sex", "childgender"],
  className: ["class", "category", "grade", "classname", "group"],
  enrollmentDate: ["enrollmentdate", "enrolmentdate", "startdate", "datestarted", "dateofenrolment", "dateofenrollment"],
  allergies: ["allergies", "allergy", "childallergies", "knownallergies", "allergiesmedicalconditions"],
  homeAddress: ["homeaddress", "address", "residentialaddress", "physicaladdress", "streetaddress", "childaddress", "childhomeaddress", "addressline1"],
  emergencyName: ["emergencycontactname", "emergencycontact", "emergencyname", "emergencycontactfullname"],
  emergencyRelationship: ["emergencycontactrelationship", "emergencyrelationship", "emergencycontactrelation"],
  emergencyPhone: ["emergencycontactphone", "emergencyphone", "emergencycontactnumber", "emergencynumber", "emergencycell", "emergencycontactcell"],
} as const;

// Suffixes after "parent" / "parent1" / "parent2".
const PARENT_FIELDS = {
  firstName: ["firstname", "name"],
  lastName: ["surname", "lastname"],
  fullName: ["fullname"],
  idNumber: ["id", "idno", "idnumber"],
  phone: ["phone", "cell", "cellphone", "mobile", "contact", "contactnumber", "cellnumber", "number", "tel", "telephone"],
  phone2: ["phone2", "cell2", "number2", "contact2", "altphone", "alternativephone", "alternativenumber", "otherphone", "othernumber", "secondphone", "worknumber", "workphone"],
  phone3: ["phone3", "cell3", "number3", "contact3", "thirdphone"],
  email: ["email", "emailaddress"],
  occupation: ["occupation", "job", "profession"],
  relationship: ["relationship", "relation", "relationshiptochild"],
  address: ["address", "homeaddress", "residentialaddress", "physicaladdress"],
} as const;

// Un-numbered headings that only ever mean parent 1 (older template and
// common short forms).
const PARENT1_EXTRA: Partial<Record<keyof typeof PARENT_FIELDS, string[]>> = {
  phone: ["phone", "cell", "mobile", "contact", "contactnumber", "cellnumber", "parentcontactdetails"],
  email: ["email", "emailaddress"],
  occupation: ["occupation"],
};

export type ImportedParent = {
  firstName: string;
  lastName: string;
  idNumber: string;
  phone: string;
  // Up to two more numbers ("Parent 1 Phone 2", "Parent 1 Phone 3").
  extraPhones: string[];
  email: string;
  occupation: string;
  relationship: string;
  address: string;
};

export type ImportedRow = {
  firstName: string;
  lastName: string;
  idNumber: string;
  dateOfBirth: string;
  gender: string;
  className: string;
  enrollmentDate: string;
  allergies: string;
  homeAddress: string;
  emergencyContact: { name: string; relationship: string; phone: string };
  // Parent 1 first; only parents with at least a name are included.
  parents: ImportedParent[];
};

type Compacted = Map<string, string>;

function compactRow(raw: Record<string, string>): Compacted {
  const m: Compacted = new Map();
  for (const [k, v] of Object.entries(raw)) {
    const key = compactHeader(k);
    const val = (v ?? "").toString().trim();
    // First non-empty value wins if two headings compact to the same key.
    if (val && !m.get(key)) m.set(key, val);
    else if (!m.has(key)) m.set(key, val);
  }
  return m;
}

function first(m: Compacted, keys: readonly string[]): string {
  for (const k of keys) {
    const v = m.get(k);
    if (v) return v;
  }
  return "";
}

// Excel turns ID numbers into numbers and drops a leading 0 -- every
// South African ID for a child born from 2000 on starts with 0. A 12-digit
// all-number value is a 13-digit ID that lost it.
export function fixIdNumber(v: string): string {
  const s = v.replace(/\s/g, "");
  return /^\d{12}$/.test(s) ? `0${s}` : v.trim();
}

function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function readParent(m: Compacted, n: 1 | 2): ImportedParent | null {
  const prefixes = n === 1 ? ["parent1", "parent"] : ["parent2"];
  const get = (field: keyof typeof PARENT_FIELDS) => {
    const keys: string[] = [];
    for (const p of prefixes) for (const s of PARENT_FIELDS[field]) keys.push(p + s);
    if (n === 1) keys.push(...(PARENT1_EXTRA[field] ?? []));
    return first(m, keys);
  };

  let firstName = get("firstName");
  let lastName = get("lastName");
  const full = get("fullName");
  // "Parent 1 Name" with no surname column is taken as the full name.
  if (full && !firstName) ({ firstName, lastName } = splitFullName(full));
  else if (firstName && !lastName && /\s/.test(firstName)) ({ firstName, lastName } = splitFullName(firstName));

  if (!firstName && !lastName) return null;
  return {
    firstName,
    lastName,
    idNumber: fixIdNumber(get("idNumber")),
    phone: get("phone"),
    extraPhones: [get("phone2"), get("phone3")].filter(Boolean),
    email: get("email"),
    occupation: get("occupation"),
    relationship: get("relationship"),
    address: get("address"),
  };
}

export function readImportRow(raw: Record<string, string>): ImportedRow {
  const m = compactRow(raw);
  const parents = [readParent(m, 1), readParent(m, 2)].filter((p): p is ImportedParent => p !== null);
  return {
    firstName: first(m, CHILD_FIELDS.firstName),
    lastName: first(m, CHILD_FIELDS.lastName),
    idNumber: fixIdNumber(first(m, CHILD_FIELDS.idNumber)),
    dateOfBirth: first(m, CHILD_FIELDS.dateOfBirth),
    gender: first(m, CHILD_FIELDS.gender),
    className: first(m, CHILD_FIELDS.className),
    enrollmentDate: first(m, CHILD_FIELDS.enrollmentDate),
    allergies: first(m, CHILD_FIELDS.allergies),
    homeAddress: first(m, CHILD_FIELDS.homeAddress),
    emergencyContact: {
      name: first(m, CHILD_FIELDS.emergencyName),
      relationship: first(m, CHILD_FIELDS.emergencyRelationship),
      phone: first(m, CHILD_FIELDS.emergencyPhone),
    },
    parents,
  };
}

// True when the header row has something we can read as the child's first
// and last name -- checked on upload so a file with the wrong columns (or
// read with the wrong separator) gets one clear message instead of an error
// on every row.
export function hasRequiredColumns(headers: string[]): boolean {
  const set = new Set(headers.map(compactHeader));
  return CHILD_FIELDS.firstName.some((a) => set.has(a)) && CHILD_FIELDS.lastName.some((a) => set.has(a));
}
