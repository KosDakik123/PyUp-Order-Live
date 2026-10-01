import sqlite3

conn = sqlite3.connect("app.db")
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 1")
    print("Added is_verified")
except Exception as e:
    print(f"is_verified: {e}")

try:
    cursor.execute("ALTER TABLE users ADD COLUMN verification_token VARCHAR")
    print("Added verification_token")
except Exception as e:
    print(f"verification_token: {e}")

conn.commit()
conn.close()
print("Done!")