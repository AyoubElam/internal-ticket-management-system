import mysql from "mysql2/promise";


import dotenv from "dotenv";
dotenv.config();

console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD);

async function testDB() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("✅ Database connected successfully!");

    const [rows] = await connection.query("SELECT 1 + 1 AS result");
    console.log("Test query result:", rows);

    await connection.end();
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
  }
}

testDB();