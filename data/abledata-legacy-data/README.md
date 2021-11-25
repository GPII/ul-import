# AbleData Legacy Data

The AbleData REST endpoint we use to download records cannot be reasonably run against their entire history for each
run.  Instead, we run an import of records updated in the last six months.

We were able to download their full history of "available" products previous.  This directory contains manually
constructed feeds to bring in "discontinued" records from their history.  To import this data:

1. Find out the location of the temporary directory using a command like: `node -e "console.log(require('os').tmpdir())"`
2. Copy the desired file (for example, `all-discontinued-products.xml`) to a file named `ableData.xml` in that directory.
3. Run the AbleData import without the `--noCache` option.
