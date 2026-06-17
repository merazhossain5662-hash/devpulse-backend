import express, { type Application, type Request, type Response } from "express"
import {Pool} from "pg"
const app : Application= express()
const port = 8000

app.use(express.json());

const pool = new Pool({
  connectionString :"postgresql://neondb_owner:npg_zk9fEl4udjiB@ep-tiny-lake-aoashz7x-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
});

const initDb = async ()=>{
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users(
        id SERIAL PRIMARY KEY,
        name VARCHAR(20) NOT NULL,
        email VARCHAR(25) NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'contributor' CHECK (role IN ('maintainer','contributor')),
        created_at DATE DEFAULT CURRENT_DATE,
        updated_at DATE DEFAULT CURRENT_DATE
        )
        `);
        console.log("database connected seccessfully");
        
    } catch (error : any) {
      console.log(error);
      
    }
};
initDb();

app.get('/', (req : Request, res : Response) => {
  res.send('Hello World')
});

app.post("/api/auth/signup", async(req : Request, res : Response)=>{
     const {name, email,password}= req.body;
     const role = req.body.role || "contributor";
    try {
      const result =  await pool.query(`
        INSERT INTO users(name, email, password, role)
        VALUES($1,$2,$3, $4)
        RETURNING *
        `,[name,email, password, role]);
        delete result.rows[0].password
        res.status(201).json({
          success : true,
          message : "User registered successfully",
          data : result.rows[0]
        })
        
    } catch (error : any) {
      console.log(error);
      
    }
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
