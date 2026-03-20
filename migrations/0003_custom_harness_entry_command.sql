-- Wire custom harness to its adapter entrypoint
UPDATE harness SET entry_command = 'node /opt/filepath/adapters/custom/index.mjs' WHERE id = 'custom';
