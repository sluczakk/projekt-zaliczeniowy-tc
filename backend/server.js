const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = "your_secret_key";

const path = require("path");

app.use(express.static(path.join(__dirname, "public")));

const dbPath = process.env.DATABASE_PATH || "./database.sqlite";

// baza danych sqlite3
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("DB error:", err.message);
  } else {
    console.log("Connected to SQLite DB");
  }
});

// tworzymy tabele
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userid INTEGER,
      title TEXT,
      description TEXT,
      detailedDescription TEXT,
      priority TEXT,
      deadline TEXT,
      tags TEXT,
      progress TEXT,
      FOREIGN KEY(userid) REFERENCES users(id)
    )
  `);
});

// ================= AUTH =================

// rejestracja

function isPasswordStrong(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&   // duża litera
    /[a-z]/.test(password) &&   // mała litera
    /[0-9]/.test(password) &&   // cyfra
    /[^A-Za-z0-9]/.test(password) // znak specjalny
  );
}

app.post("/auth/register", async (req, res) => {
  const { email, password, repeatedpassword } = req.body;

  if (password !== repeatedpassword) {
    return res.status(400).json({ message: "Hasła nie pasują" });
  }

  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      message:
        "Hasło musi mieć min. 8 znaków, dużą literę, małą literę, cyfrę i znak specjalny",
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (email, password) VALUES (?, ?)`,
    [email, hashedPassword],
    function (err) {
      if (err) {
        return res.status(400).json({ message: "Email już istnieje" });
      }

      const user = {
        id: this.lastID,
        email,
      };

      const token = jwt.sign(user, SECRET_KEY, { expiresIn: "7d" });

      res.json({ token, user });
    }
  );
});

// logowanie
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (!user) {
      return res.status(401).json({ message: "Nie istnieje konto z podanym emailem" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Złe hasło" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  });
});

// weryfikacja tokena
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: "Brak tokenu" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Nieprawidłowy token" });
  }
}

app.get("/auth/verifytoken", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ================= TASKS =================

// pobierz zadania uzytkownika
app.get("/tasks", authMiddleware, (req, res) => {
  db.all(
    `SELECT * FROM tasks WHERE userid = ?`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "DB error" });

      // parse tags JSON
      const tasks = rows.map((task) => ({
        ...task,
        tags: JSON.parse(task.tags || "[]"),
      }));

      res.json({ tasks });
    }
  );
});

// przyklad braku parametryzacji i zabezpieczen
/*app.get("/tasks-unsafe", (req, res) => {
  const { userid } = req.query; 

  const query = `SELECT * FROM tasks WHERE userid = ${userid}`;

  console.log("QUERY:", query);

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error" });

    res.json({ tasks: rows });
  });
});*/


// dodaj zadanie
app.post("/tasks", authMiddleware, (req, res) => {
  const {
    title,
    description,
    detailedDescription,
    priority,
    deadline,
    tags,
    progress,
  } = req.body;

  db.run(
    `INSERT INTO tasks 
    (userid, title, description, detailedDescription, priority, deadline, tags, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      title,
      description,
      detailedDescription,
      priority,
      deadline || "",
      JSON.stringify(tags || []),
      progress,
    ],
    function (err) {
      if (err) return res.status(500).json({ message: "DB error" });

      res.json({
        task: {
          id: this.lastID,
          userid: req.user.id,
          title,
          description,
          detailedDescription,
          priority,
          deadline,
          tags,
          progress,
        },
      });
    }
  );
});

// zaktualizuj zadanie
app.put("/tasks/:id", authMiddleware, (req, res) => {
  const id = req.params.id;

  const {
    title,
    description,
    detailedDescription,
    priority,
    deadline,
    tags,
    progress,
  } = req.body;

  db.run(
    `UPDATE tasks SET 
      title=?, description=?, detailedDescription=?, priority=?, deadline=?, tags=?, progress=?
     WHERE id=? AND userid=?`,
    [
      title,
      description,
      detailedDescription,
      priority,
      deadline || "",
      JSON.stringify(tags || []),
      progress,
      id,
      req.user.id,
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ message: "DB error" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "Nie znaleziono zadania" });
      }

      res.json({
        task: {
          id: Number(id),
          userid: req.user.id,
          title,
          description,
          detailedDescription,
          priority,
          deadline: deadline || "",
          tags: tags || [],
          progress,
        },
      });
    }
  );
});

// usun zadanie
app.delete("/tasks/:id", authMiddleware, (req, res) => {
  const id = req.params.id;

  db.run(
    `DELETE FROM tasks WHERE id=? AND userid=?`,
    [id, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ message: "DB error" });

      res.json({ message: "Usunięto zadanie" });
    }
  );
});

// serwowanie frontendu na azure
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// START
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
