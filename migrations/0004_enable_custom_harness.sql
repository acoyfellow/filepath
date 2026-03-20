-- Ensure custom harness is visible and labeled as Hermes
UPDATE harness SET enabled = 1, name = 'Hermes', description = 'Hermes Agent. Choose the model it will use below.' WHERE id = 'custom';
