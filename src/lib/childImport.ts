// Every possible header spelling this accepts for a given field, matched
// case-insensitively (csvRowsToRecords on the client already lowercases
// and trims headers before this ever sees them). Deliberately generous —
// a school pasting from whatever spreadsheet they already had shouldn't
// have to rename their columns to match this app exactly.
export const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ["child first name", "childfirstname", "first name", "firstname", "child name"],
  lastName: ["child last name", "childlastname", "last name", "lastname", "surname", "child surname"],
  parentName: ["parent name", "parentname", "parent full name"],
  parentFirstName: ["parent first name", "parentfirstname"],
  parentLastName: ["parent last name", "parentlastname", "parent surname"],
  parentPhone: ["parent phone", "phone", "parent contact", "contact", "parent contact details", "cell", "mobile"],
  parentEmail: ["parent email", "email"],
  categoryName: ["category", "class", "grade"],
  enrollmentDate: ["enrollment date", "enrollmentdate", "start date"],
  childIdNumber: ["child id", "childid", "child id number", "child's id"],
  parentIdNumber: ["parent id", "parentid", "parent id number", "parent's id"],
  dateOfBirth: ["date of birth", "dateofbirth", "dob", "birth date", "birthdate", "birthday"],
  gender: ["gender", "sex"],
};

// True when the header row has something we can read as the child's first
// and last name -- checked on upload so a file with the wrong columns (or
// read with the wrong separator) gets one clear message instead of an error
// on every row.
export function hasRequiredColumns(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()));
  return (
    FIELD_ALIASES.firstName.some((a) => set.has(a)) && FIELD_ALIASES.lastName.some((a) => set.has(a))
  );
}
