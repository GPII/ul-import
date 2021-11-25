# Unified Listing Imports

This package contains scripts that are used to import data from vendor databases, and to curate imported data.

## "Core" Imports

The general process of importing data from a vendor is as follows:

1. Check for a local cache of vendor records (to avoid downloading data too frequently).
2. If the cache is found, load the records.  If not, download all vendor data in batches, making no more than 100
   requests simultaneously.
3. Transform the vendor records into "source" records.
4. Retrieve the list of records for the vendor source(s) and compare them to the newly-retrieved records.  If there are
   new records, create them.  If there are updated versions of existing records, update them.

## The "Unifier"

Through the web interface and various API endpoints, by default only "unified" records are displayed.  The "unifier"
is a script that looks for any "source" records that are not already associated with a "unified" record.  For each of
these "orphaned" records it finds, the "unifier":

1. Creates a new "unified" record using the same "title", "description", "manufacturer", etc. data from the "source"
   record.
2. Updates the "source" record to indicate that it is associated with the new "unified" record.

## "Image" Imports

There is a secondary set of scripts that:

1. Extract image data from "source" records.
2. Download the original images and cache them locally as needed.
3. Update the associated "unified" record to indicate that it has image data.

For this script to work properly, it should be run after the "unifier" has completed its work (see below).

## Performing a Full Sync

The basic process for performing a full sync is as follows:

1. Run each of the "core" imports.
2. Run the "unifier".
3. Run each of the "image" imports.

## Syncing Using NPM

This package has a few `npm` scripts defined to cover each part of the above.  To run a "full" sync, use a command like:

`npm run full-sync`

For individual commands, see the `package.json` file.  Note that all of the npm scripts are hard-coded to use the
"production" configuration settings.  To run in a dev environment, you will need to run the direct commands (see below).

__NOTE:__ The GARI imports are no longer included in a "full" sync.

## Syncing Using Direct Commands

This package provides a range of scripts that use [`fluid-launcher`](https://www.npmjs.com/package/fluid-launcher) to
run various commands, and to change the effective options used when running the command using options files,
command-line switches, and environment variables.  The `configs` directory contains a range of configuration files.
Usually, you will want to work with one of the "merged" config files that combines:

1. Options common to all scripts.
2. Options common to the operating environment (production, development).
3. Options common to all scripts that work with a particular vendor's data (EASTIN, GARI, et cetera).
4. Options specific to a particular script.

All commands provided below are intended to be run from root of the directory in which the repository has been checked
out.

### EASTIN

The Unified Listing pulls "source" records from [EASTIN](http://www.eastin.eu/en/searches/products/index), which is
itself a federation of various partner databases ([see their website for details](http://www.eastin.eu/en/partners/index)).

To import "core" data from EASTIN:

1. In production: `npm run eastin-import`
2. In a development environment: `npm run eastin-import -- --optionsFile %ul-imports/configs/eastin-dev.json`

To import "image" data from EASTIN:

1. In production: `npm run eastin-image-import`
2. In a development environment: `npm run eastin-image-import -- --optionsFile %ul-imports/configs/eastin-image-sync-dev.json`

### GARI

The Unified Listing pulls "source" records from [GARI](http://www.gari.info).  To import "core" data from GARI:

1. In a production environment:  `npm run gari-import`
2. In a development environment: `npm run gari-import -- --optionsFile %ul-imports/configs/gari-dev.json`

To import "image" data from GARI:

1. In production: `npm run gari-image-import`
2. In a development environment: `npm run gari-image-import -- --optionsFile %ul-imports/configs/gari-image-sync-dev.json`

### The SAI

The Shopping and Alerting Aid is a front-end to the Unified Listing to assist users in finding products that meet their
needs.  To import "core" data from the SAI:

1. In production: `npm run sai-import`
2. In a development environment: `npm run sai-import -- --optionsFile %ul-imports/configs/sai-dev.json`

To import "image" data from the SAI:

1. In production: `npm run sai-image-import`
2. In a development environment: `npm run sai-image-import -- --optionsFile %ul-imports/configs/sai-image-sync-dev.json`

### "Unifier"

See above for details regarding the "unifier".  To create a "unified" record for each "source" record that is not
already associated with a "unified" record:

1. In production: ```npm run unifier```
2. In a development environment: ```npm run unifier -- --optionsFile %ul-imports/configs/unifier-dev.json```

## Curation Scripts

This package includes scripts that can be used to detect and where possible clean up particular problems with imported
data.  For details, look at the contents of the `src/js/curation` directory.

## SAI

This package includes scripts that make key updates to "unified" records based on data coming from the SAI:

1. For each SAI record that has been flagged as `deleted` in the SAI, the unified record is updated to indicate that it
   has been deleted.
2. For each SAI record that has been flagged as a "duplicate" of another ("original") record:
    1. The associated unified record is updated to indicate that it has been deleted, and to redirect future requests to
       the "original" record.
    2. All "child" records associated with a "duplicate" record are updated to be associated with the "original" record
       instead.
3. For each SAI record that has an updated `name` or `description`, the associated unified record will have its `name`
   and `description` updated.

Note that image data associated with "duplicate" records is not migrated.

To run these scripts in production, use the command: ```npm run sai-curation```

Please note, the curation script does not directly reload the data from the SAI API.  Instead, it compares the SAI
"source" records that have already been imported into the UL with their associated unified records.  To pick up new
data, you will need to first run the SAI import or a full sync (see above for details on both).

## Running Scripts with Custom Options

The scripts in this package use the [`fluid-launcher`](https://github.com/the-t-in-rtf/fluid-launcher) package to allow
you set options from the command-line or environment variable.  For example, let's say you want to run a "full sync"
with a custom password.  You can do this using an argument, or an environment variable.  With an argument, you might
use a command like:

```npm run full-sync -- --password myPasswordValue```

Note the `--` characters are required to help npm understand where its arguments end and where the script's arguments
begin.

Using an environment variable to set the same password, you might use a command like:

```PASSWORD=myPasswordValue npm run full-sync```

For more details about supported options, run any of the scripts in this package with the `--help` argument.  You can
also create your own custom options files and use those instead of the included files.  For more details, see the
`fluid-launcher` documentation.

## Generating "Updates" Reports

Each import that is run saves data on updated records to a file.  These files can be used to generate emails describing
each updated record, and also a rollup HTML report that summarises all the changes for a given import.   This process
involves two steps:

1. Look for unprocessed import output.  Compare the raw updates for a given source to the original records and produce a
   "diff" data file.  Import output is gzipped and archived at the end of this process.
2. Look for unprocessed "diff" data files.  Generate emails and an HTML report for each file.  Incoming "diff" data
   files are then gzipped and archive the file.

There are npm scripts provided in this package to handle both steps.  There is a rollup script to run these in order,
which is run using a command like `npm run updates-report`.  You can also run the steps individually, see the
`package.json` file for details.
