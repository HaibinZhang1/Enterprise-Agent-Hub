UPDATE users
SET password_hash = 'scrypt:eagenthub20260422fixedsalt000001:ce4aff5d54fc609824b9fedf7a1a5019f69f13c280c1e1216c628715d6a119f7a2f73c80e400f8003b08bfe296f0a4a86c6c1c5baf5e5611524685e7ba848f82'
WHERE status <> 'deleted';

UPDATE auth_sessions
SET revoked_at = now()
WHERE revoked_at IS NULL;
