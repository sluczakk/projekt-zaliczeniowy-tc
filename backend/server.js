const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sql = require("mssql");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// do podpisywania json web tokena
const SECRET_KEY = process.env.JWT_SECRETKEY;

const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

// informacje do logowania do zasobu azure
const dbConfig = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

let pool;

async function initDb() {
  pool = await sql.connect(dbConfig); // logowanie do zasobu azure

  console.log("polaczono z Azure SQL");

  // inicjalizacja tabel
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sys.tables WHERE name = 'users'
    )
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      email NVARCHAR(255) UNIQUE,
      password NVARCHAR(255)
    );
  `);

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sys.tables WHERE name = 'tasks'
    )
    CREATE TABLE tasks (
      id INT IDENTITY(1,1) PRIMARY KEY,
      userid INT,
      title NVARCHAR(255),
      description NVARCHAR(MAX),
      detailedDescription NVARCHAR(MAX),
      priority NVARCHAR(50),
      deadline NVARCHAR(100),
      tags NVARCHAR(MAX),
      progress NVARCHAR(50),
      FOREIGN KEY (userid) REFERENCES users(id)
    );
  `);

  console.log("Stworzono/sprawdzono tabele SQL");
}

// routes


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

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .input("password", sql.NVarChar(255), hashedPassword)
      .query(`
        INSERT INTO users (email, password)
        OUTPUT INSERTED.id
        VALUES (@email, @password)
      `);

    const user = {
      id: result.recordset[0].id,
      email,
    };

    const token = jwt.sign(user, SECRET_KEY, { expiresIn: "7d" });

    res.json({ token, user });
  } catch (err) {
    console.error(err);

    return res.status(400).json({ message: "Email już istnieje" });
  }
});

// logowanie
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool
      .request()
      .input("email", sql.NVarChar(255), email)
      .query(`
        SELECT *
        FROM users
        WHERE email = @email
      `);

    const user = result.recordset[0];

    if (!user) {
      return res
        .status(401)
        .json({ message: "Nie istnieje konto z podanym emailem" });
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
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
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
app.get("/tasks", authMiddleware, async (req, res) => {
  try {
    const result = await pool
      .request()
      .input("userid", sql.Int, req.user.id)
      .query(`
        SELECT *
        FROM tasks
        WHERE userid = @userid
      `);

    const tasks = result.recordset.map((task) => ({
      ...task,
      tags: JSON.parse(task.tags || "[]"),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// dodaj zadanie
app.post("/tasks", authMiddleware, async (req, res) => {
  const {
    title,
    description,
    detailedDescription,
    priority,
    deadline,
    tags,
    progress,
  } = req.body;

  try {
    const result = await pool
      .request()
      .input("userid", sql.Int, req.user.id)
      .input("title", sql.NVarChar(255), title)
      .input("description", sql.NVarChar(sql.MAX), description)
      .input("detailedDescription", sql.NVarChar(sql.MAX), detailedDescription)
      .input("priority", sql.NVarChar(50), priority)
      .input("deadline", sql.NVarChar(100), deadline || "")
      .input("tags", sql.NVarChar(sql.MAX), JSON.stringify(tags || []))
      .input("progress", sql.NVarChar(50), progress)
      .query(`
        INSERT INTO tasks
          (userid, title, description, detailedDescription, priority, deadline, tags, progress)
        OUTPUT INSERTED.id
        VALUES
          (@userid, @title, @description, @detailedDescription, @priority, @deadline, @tags, @progress)
      `);

    const newId = result.recordset[0].id;

    res.json({
      task: {
        id: newId,
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// zaktualizuj zadanie
app.put("/tasks/:id", authMiddleware, async (req, res) => {
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

  try {
    const result = await pool
      .request()
      .input("title", sql.NVarChar(255), title)
      .input("description", sql.NVarChar(sql.MAX), description)
      .input("detailedDescription", sql.NVarChar(sql.MAX), detailedDescription)
      .input("priority", sql.NVarChar(50), priority)
      .input("deadline", sql.NVarChar(100), deadline || "")
      .input("tags", sql.NVarChar(sql.MAX), JSON.stringify(tags || []))
      .input("progress", sql.NVarChar(50), progress)
      .input("id", sql.Int, id)
      .input("userid", sql.Int, req.user.id)
      .query(`
        UPDATE tasks
        SET
          title = @title,
          description = @description,
          detailedDescription = @detailedDescription,
          priority = @priority,
          deadline = @deadline,
          tags = @tags,
          progress = @progress
        WHERE id = @id AND userid = @userid
      `);

    if (result.rowsAffected[0] === 0) {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// usun zadanie
app.delete("/tasks/:id", authMiddleware, async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("userid", sql.Int, req.user.id)
      .query(`
        DELETE FROM tasks
        WHERE id = @id AND userid = @userid
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Nie znaleziono zadania" });
    }

    res.json({ message: "Usunięto zadanie" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// do serwowania frontendu na azure
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// start serwera
async function startServer() {
  try {
    await initDb();

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`Serwer uruchomiony na porcie ${port}`);
    });
  } catch (err) {
    console.error("Nie udalo sie uruchomic serwera:", err);
    process.exit(1);
  }
}

startServer();
