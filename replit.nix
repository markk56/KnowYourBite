# Pins the toolchain for Replit. The `nodejs-20` + `postgresql-16` modules in
# .replit provide Node and Postgres; this file adds anything else the workspace
# needs (kept minimal for the MVP walking skeleton).
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
  ];
}
