import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
const rawPool = mysql.createPool({ uri: process.env.DATABASE_URL, multipleStatements: true });

function adapt(raw) {
  return { async query(sql, values = []) {
    const params=[]; const text=sql.replace(/\$(\d+)/g, (_m,n)=>{params.push(values[Number(n)-1]);return '?'});
    const [result]=await raw.query(text,params);
    return Array.isArray(result)?{rows:result,rowCount:result.length}:{rows:[],rowCount:result.affectedRows||0,insertId:result.insertId};
  }, release: raw.release ? ()=>raw.release() : undefined, end: raw.end ? ()=>raw.end() : undefined };
}
export const pool=adapt(rawPool);
export async function withTransaction(work) { const connection=await rawPool.getConnection(), client=adapt(connection); try { await connection.beginTransaction(); const result=await work(client); await connection.commit(); return result; } catch(error) { await connection.rollback(); throw error; } finally { connection.release(); } }
