#!/bin/bash
# Gate: Fresh schema (agentSession + agentNode) generates correctly
cd "$(dirname "$0")/.." || exit 1

# Check migration file exists
if ! ls migrations/0000_*.sql 1>/dev/null 2>&1; then
  echo "No migration file found"
  exit 1
fi

# Check migration has the new tables
MIGRATION=$(ls migrations/0000_*.sql | head -1)

grep -q "CREATE TABLE \`agent_session\`" "$MIGRATION" || { echo "Missing agent_session table"; exit 1; }
grep -q "CREATE TABLE \`agent_node\`" "$MIGRATION" || { echo "Missing agent_node table"; exit 1; }
grep -q "\`parent_id\` text" "$MIGRATION" || { echo "Missing parent_id column"; exit 1; }
grep -q "\`root_node_id\` text" "$MIGRATION" || { echo "Missing root_node_id column"; exit 1; }
grep -q "\`model\` text NOT NULL" "$MIGRATION" || { echo "Missing model column on agent_node"; exit 1; }
grep -q "\`sort_order\` integer" "$MIGRATION" || { echo "Missing sort_order column"; exit 1; }
grep -q "\`tokens\` integer" "$MIGRATION" || { echo "Missing tokens column"; exit 1; }

# Verify old tables are gone
if grep -q "CREATE TABLE \`multi_agent_session\`" "$MIGRATION"; then
  echo "Old multi_agent_session table still present"
  exit 1
fi
if grep -q "CREATE TABLE \`agent_slot\`" "$MIGRATION"; then
  echo "Old agent_slot table still present"
  exit 1
fi

echo "Schema: agentSession + agentNode correct"
