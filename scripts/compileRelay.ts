#!/usr/bin/env ts-node

import program from "commander";
import spawn from "cross-spawn";
import fs from "fs-extra";
import { loadConfigSync } from "graphql-config";

const CLIENT_ROOT = "./src/core/client";
const SCHEMA_NAME = "tenant";

// Load the configuration from the provided `graphql-config` configuration file.
const config = loadConfigSync({});

program
  .version("0.1.0")
  .usage("--bundle stream")
  .option("--bundle <name>", "Find gql recursively in the bundle")
  .option("--persist", "Use persisted queries")
  .description("Compile relay gql data")
  .parse(process.argv);

// Get the GraphQLSchema from the configuration.
const schemaConfig = config.getProject(SCHEMA_NAME).schema as
  | string[]
  | undefined;

if (!schemaConfig) {
  // eslint-disable-next-line no-console
  console.error(
    `SchemaPath for project ${program.schema} not found in graphql config`
  );
  process.exit(1);
}

if (schemaConfig.length > 1) {
  // eslint-disable-next-line no-console
  console.error(`Multiple schemas provided, but we expected only one`);
  process.exit(1);
}

if (!program.bundle) {
  // eslint-disable-next-line no-console
  console.error("bundle not provided");
  process.exit(1);
}

if (!config.projects) {
  // eslint-disable-next-line no-console
  console.error("Missing projects key in .graphqconfig");
  process.exit(1);
}

const configFileName = `relay-${program.bundle}.config.json`;
const args = ["--config", configFileName];

// Set the persisted query path.
const persist = program.persist
  ? `${CLIENT_ROOT}/${program.bundle}/persisted-queries.json`
  : null;
if (persist) {
  args.push("--persist-output", persist);
}

// Create the artifact directory if it doesn't exist
const rawConfig = fs.readFileSync(configFileName).toString();
const jsonConfig = JSON.parse(rawConfig);
if (!fs.existsSync(jsonConfig.artifactDirectory)) {
  fs.mkdirSync(jsonConfig.artifactDirectory);
}

// Run the relay compiler
spawn.sync(`npm run relay`, args, {
  stdio: "inherit",
});

// Create persisted queries directory
if (persist) {
  if (fs.existsSync(persist)) {
    // Create the new filename.
    const generated = "./src/core/server/graph/persisted/__generated__";

    // Create the generated directory if it doesn't exist.
    fs.ensureDirSync(generated);

    // Copy the file over to the destination directory.
    fs.copySync(persist, `${generated}/${program.bundle}.json`, {
      overwrite: true,
    });
  }
}
