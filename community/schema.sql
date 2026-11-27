PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, nickname TEXT UNIQUE COLLATE NOCASE, created INTEGER NOT NULL, policy TEXT NOT NULL, age_confirmed INTEGER NOT NULL CHECK(age_confirmed=1), suspended INTEGER NOT NULL DEFAULT 0, game_name TEXT, UNIQUE(provider,subject));
CREATE TABLE IF NOT EXISTS oauth_states(id TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL, policy TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT REFERENCES members(id) ON DELETE SET NULL, category TEXT NOT NULL, prefix TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, squad TEXT, card_id INTEGER, created INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0 CHECK(views>=0));
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, author TEXT REFERENCES members(id) ON DELETE SET NULL, body TEXT NOT NULL, created INTEGER NOT NULL, hidden INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS votes(member_id TEXT REFERENCES members(id) ON DELETE CASCADE, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(member_id,post_id));
CREATE TABLE IF NOT EXISTS bookmarks(member_id TEXT REFERENCES members(id) ON DELETE CASCADE, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, PRIMARY KEY(member_id,post_id));
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT REFERENCES members(id) ON DELETE CASCADE, kind TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', reply TEXT);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT REFERENCES members(id) ON DELETE CASCADE, post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE, reason TEXT NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', UNIQUE(member_id,post_id));
CREATE TABLE IF NOT EXISTS squads(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT REFERENCES members(id) ON DELETE CASCADE, name TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS value_history(id INTEGER PRIMARY KEY AUTOINCREMENT,squad_id INTEGER REFERENCES squads(id) ON DELETE CASCADE, bp INTEGER NOT NULL, observed INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS favorites(member_id TEXT REFERENCES members(id) ON DELETE CASCADE, card_id INTEGER NOT NULL, grade INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(member_id,card_id,grade));
CREATE TABLE IF NOT EXISTS diagnoses(id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT REFERENCES members(id) ON DELETE CASCADE, nickname TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT REFERENCES members(id) ON DELETE SET NULL, action TEXT NOT NULL, target TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS post_feed ON posts(hidden,category,created DESC);
CREATE INDEX IF NOT EXISTS comment_feed ON comments(post_id,hidden,created);
CREATE INDEX IF NOT EXISTS session_exp ON sessions(expires);
CREATE INDEX IF NOT EXISTS vote_post ON votes(post_id);
CREATE INDEX IF NOT EXISTS squad_owner ON squads(member_id);
CREATE INDEX IF NOT EXISTS diag_owner ON diagnoses(member_id);
CREATE INDEX IF NOT EXISTS feedback_owner ON feedback(member_id);
CREATE INDEX IF NOT EXISTS audit_time ON audit(created);

-- Community v2 additive migration
CREATE TABLE IF NOT EXISTS post_dislikes(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,PRIMARY KEY(member_id,post_id));
CREATE INDEX IF NOT EXISTS post_dislike_post ON post_dislikes(post_id);
CREATE TABLE IF NOT EXISTS comment_votes(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,value INTEGER NOT NULL CHECK(value IN (-1,1)),PRIMARY KEY(member_id,comment_id));
CREATE INDEX IF NOT EXISTS comment_vote_comment ON comment_votes(comment_id);
CREATE TABLE IF NOT EXISTS comment_replies(comment_id INTEGER PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,parent_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE);

-- Consent evidence, additive migration. No fabricated backfill for legacy members.
CREATE TABLE IF NOT EXISTS member_consents(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,policy TEXT NOT NULL,agreed_at INTEGER NOT NULL,age_confirmed INTEGER NOT NULL CHECK(age_confirmed=1),terms_agreed INTEGER NOT NULL CHECK(terms_agreed=1),privacy_agreed INTEGER NOT NULL CHECK(privacy_agreed=1),PRIMARY KEY(member_id,policy));

CREATE TABLE IF NOT EXISTS traffic_events(day INTEGER NOT NULL, visitor TEXT NOT NULL, minute INTEGER NOT NULL, page TEXT NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, kind INTEGER NOT NULL CHECK(kind IN (0,1)), PRIMARY KEY(day,visitor,minute,page,kind)) WITHOUT ROWID;

-- Arcade activity XP
CREATE TABLE IF NOT EXISTS arcade_rounds(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,game TEXT NOT NULL,day INTEGER NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL,issued INTEGER NOT NULL,questions TEXT NOT NULL,step INTEGER NOT NULL DEFAULT 0,score INTEGER NOT NULL DEFAULT 0,fee INTEGER NOT NULL CHECK(fee IN (0,2)),reward INTEGER NOT NULL DEFAULT 0,state INTEGER NOT NULL DEFAULT 0 CHECK(state IN (0,1,2)));
CREATE INDEX IF NOT EXISTS arcade_owner_day ON arcade_rounds(member_id,day);
CREATE INDEX IF NOT EXISTS arcade_week ON arcade_rounds(game,day,state,score);
CREATE UNIQUE INDEX IF NOT EXISTS arcade_one_active ON arcade_rounds(member_id) WHERE state=0;

-- Live chat and private visitor feedback
CREATE TABLE IF NOT EXISTS live_chat(id INTEGER PRIMARY KEY AUTOINCREMENT,author TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,body TEXT NOT NULL,created INTEGER NOT NULL,hidden INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS live_chat_author_time ON live_chat(author,created);
CREATE INDEX IF NOT EXISTS live_chat_time ON live_chat(created);
CREATE TABLE IF NOT EXISTS live_chat_blocks(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,blocked TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,PRIMARY KEY(member_id,blocked));
CREATE TABLE IF NOT EXISTS live_chat_reports(member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,chat_id INTEGER NOT NULL REFERENCES live_chat(id) ON DELETE CASCADE,created INTEGER NOT NULL,PRIMARY KEY(member_id,chat_id));
CREATE TABLE IF NOT EXISTS private_contact(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id TEXT REFERENCES members(id) ON DELETE CASCADE,kind TEXT NOT NULL,body TEXT NOT NULL,page TEXT NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'new',reply TEXT);
CREATE INDEX IF NOT EXISTS private_contact_owner ON private_contact(member_id,created);
CREATE INDEX IF NOT EXISTS private_contact_status ON private_contact(status,created);
CREATE TABLE IF NOT EXISTS contact_limits(bucket TEXT PRIMARY KEY,expires INTEGER NOT NULL,n INTEGER NOT NULL);
