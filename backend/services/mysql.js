import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "9085_Shiny",
  database: process.env.DB_NAME || "analytics_dashboard",
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;