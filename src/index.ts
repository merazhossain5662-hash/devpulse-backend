import express, { type Application, type Request, type Response } from "express"
import dotenv from "dotenv"
import {Pool} from "pg"
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken"
const app : Application= express()
const port = 8000
dotenv.config();
app.use(express.json());

const pool = new Pool({
  connectionString :process.env.CONNECTIONSTRING,
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

        await pool.query(`
        CREATE TABLE IF NOT EXISTS issues(
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description VARCHAR(150) CHECK (length(description) >= 20),
        type VARCHAR(20) NOT NULL CHECK (type IN ('bug','feature_request')),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
        reporter_id INT REFERENCES users(id),
        created_at DATE DEFAULT CURRENT_DATE,
        updated_at DATE DEFAULT CURRENT_DATE
      )
        `)
        console.log("database connected seccessfully");
        
    } catch (error : any) {
      console.log(error);
      
    };
};
initDb();

app.get('/', (req : Request, res : Response) => {
  res.send('Hello World')
});

app.post("/api/auth/signup", async(req : Request, res : Response)=>{
     const {name, email,password}= req.body;
     const role = req.body.role || "contributor";
     const hashPassword = await bcrypt.hash(password, 10)
    try {
      const result =  await pool.query(`
        INSERT INTO users(name, email, password, role)
        VALUES($1,$2,$3, $4)
        RETURNING *
        `,[name,email, hashPassword, role]);
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

app.post("/api/auth/login", async(req :Request, res :Response)=>{
  const {email,password}= req.body;
  try {
    const userData = await pool.query(`
    SELECT * FROM users WHERE email=$1
    `,[email])
    if(userData.rows.length === 0){
     res.status(400).json({
        message : "Invalid Credentials!"
      })
    }
    const user = userData.rows[0]; 

    const comparePassword = await bcrypt.compare(password, user.password)
    if(!comparePassword){
      res.status(400).json({
        message : "Invalid Credentials!"
      })
    };
    const jwtPayload = {
      id : user.id,
      name : user.anme,
      role : user.role,
      email : user.email
    }
    const Token = jwt.sign(jwtPayload, process.env.JWT_SECRATE as string,{
      expiresIn : "1d"
    })
    delete userData.rows[0].password
    res.status(200).json({
      success : true,
      message : "Login successful",
      data : {
        token : Token,
        user :userData.rows[0]
      }
    })
  } catch (error : any) {
    console.log(error);
    
  }

})

app.post("/api/issues", async(req : Request, res :Response)=>{
  const token = req.headers.authorization;
  const {title, description,type} = req.body
  if(!token){
   res.status(401).json({
    success : false,
    message : "Unauthorized"
   })
  }
 try {
   const decoded = jwt.verify(token as string, process.env.JWT_SECRATE as string) as JwtPayload;
   const issue = await pool.query(`
    INSERT INTO issues(title, description,type, reporter_id)
    VALUES($1,$2,$3,$4)
        RETURNING *
    `,[title, description ,type, decoded.id])
   res.status(201).json({
    success: true,
    message: "Issue created successfully",
    data : issue.rows[0]
   })
 } catch (error) {
   res.status(401).json({
    success : false,
    message : "Unauthorized"
   })
 }
  

  
    
  
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
