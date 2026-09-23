// archiver-zip-encrypted ships no type definitions of its own. It's
// registered with archiver via `archiver.registerFormat("zip-encrypted",
// require("archiver-zip-encrypted"))` (see src/lib/backup/exportOrg.ts) --
// the value itself is never used as a typed API surface in this codebase,
// so an untyped ambient module is all that's needed to satisfy TS.
declare module "archiver-zip-encrypted";
