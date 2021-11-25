#
# Resync a local development instance of CouchDB with the live instance.  Assumes that:
#
# 1. The development CouchDB instance is a Docker container that's listening on port 5984.
# 2. The live CouchDB instance is available (via SSH tunnel, typically) at port 15984.
# 3. `curl` is installed.
#
# Note that this is a convenience script and does zero error checking.  Use at your own risk.
#
for db in users images ul; do
    # Delete the existing local development database.
    echo "Deleting local database '$db'..."
    curl -H "Accept: application/json" -X DELETE http://admin:admin@localhost:5984/$db

    # Schedule the sync with the remote repo.
    echo "Replicating live data (may take a while)..."
    echo "{ \"source\": \"http://admin:admin@docker.for.mac.localhost:15984/$db\", \"target\": \"http://admin:admin@localhost:5984/$db\", \"create_target\": true }" > /tmp/$db-body.json
    curl -H "Accept: application/json" -H "Content-type: application/json" -X POST http://admin:admin@localhost:5984/_replicate -d @/tmp/$db-body.json

    # Get rid of any old deleted records
    echo "Compacting database '$db' following sync..."
    curl -H "Accept: application/json" -H "Content-type: application/json" -X POST http://admin:admin@localhost:5984/$db/_compact
done

echo "Done."
