import { summarize, defaultRules } from './domain.js';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';

mkdirSync(process.env.DATA_DIR || './data', {recursive:true});
const db = new DatabaseSync(`${process.env.DATA_DIR || './data'}/cejla.sqlite`);
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,phone TEXT UNIQUE,password TEXT,role TEXT,school INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user INTEGER,expires INTEGER);
CREATE TABLE IF NOT EXISTS enrollments(student INTEGER,class TEXT,school INTEGER);
CREATE TABLE IF NOT EXISTS assignments(teacher INTEGER,class TEXT,subject TEXT,school INTEGER);
CREATE TABLE IF NOT EXISTS assessments(id INTEGER PRIMARY KEY,title TEXT,class TEXT,subject TEXT,school INTEGER,max REAL,weight REAL,teacher INTEGER);
CREATE TABLE IF NOT EXISTS grades(assessment INTEGER,student INTEGER,score REAL,PRIMARY KEY(assessment,student));
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER,assessment INTEGER,student INTEGER,old REAL,new REAL,reason TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,school INTEGER,class TEXT,title TEXT,body TEXT);
`);
export function hash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
function valid(password,stored){const [salt,key]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}
if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
 const insert=db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)');
 for(const u of [[1,'Ana Silva','11900000001','student',1],[2,'Marcos Oliveira','11900000002','teacher',1],[3,'Helena Costa','11900000003','director',1],[4,'Administrador','11900000004','admin',1],[5,'Pedro Santos','11900000005','student',2]]) insert.run(u[0],u[1],u[2],hash('Escola@123'),u[3],u[4]);
 db.exec(`INSERT INTO enrollments VALUES(1,'9º A',1),(5,'8º B',2); INSERT INTO assignments VALUES(2,'9º A','Matemática',1);
 INSERT INTO assessments VALUES(1,'Avaliação de frações','9º A','Matemática',1,10,1,2),(2,'Prova do bimestre','9º A','Matemática',1,10,2,2);
 INSERT INTO grades(assessment,student,score) VALUES(1,1,9); INSERT INTO messages VALUES(1,1,'9º A','Uma nova etapa começa aqui','Confira suas avaliações e acompanhe cada conquista. Nossa próxima prova será na sexta-feira.');`);
}
db.exec(`CREATE TABLE IF NOT EXISTS reactions(message INTEGER,user INTEGER,emoji TEXT,PRIMARY KEY(message,user),FOREIGN KEY(message) REFERENCES messages(id),FOREIGN KEY(user) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS schools(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY,school INTEGER,name TEXT,UNIQUE(school,name));
CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY,school INTEGER,name TEXT,UNIQUE(school,name));
CREATE TABLE IF NOT EXISTS profiles(user INTEGER PRIMARY KEY,birth TEXT DEFAULT '',father TEXT DEFAULT '',mother TEXT DEFAULT '',notes TEXT DEFAULT '');
INSERT OR IGNORE INTO schools VALUES(1,'Escola CEJLA'),(2,'Escola Horizonte');
INSERT OR IGNORE INTO classes(school,name) SELECT DISTINCT school,class FROM enrollments;
INSERT OR IGNORE INTO subjects(school,name) SELECT DISTINCT school,subject FROM assignments;`);
for(const [name,type] of [['student','INTEGER'],['author','INTEGER'],['created',"TEXT"]]){
 if(!db.prepare('PRAGMA table_info(messages)').all().some(c=>c.name===name))db.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`);
}
db.exec(`CREATE TABLE IF NOT EXISTS periods(id INTEGER PRIMARY KEY,school INTEGER,name TEXT,closed INTEGER DEFAULT 0,UNIQUE(school,name));
CREATE TABLE IF NOT EXISTS rules(school INTEGER PRIMARY KEY,bronze REAL,silver REAL,gold REAL);
CREATE TABLE IF NOT EXISTS subscriptions(user INTEGER PRIMARY KEY,status TEXT DEFAULT 'active',expires TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,actor INTEGER,action TEXT,details TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO periods(school,name) SELECT id,'1º bimestre' FROM schools;`);
for(const [table,columns] of Object.entries({users:[['active','INTEGER DEFAULT 1']],assessments:[['period',"TEXT DEFAULT '1º bimestre'"],['type',"TEXT DEFAULT 'Avaliação'"],['date',"TEXT DEFAULT ''"]],grades:[['status',"TEXT DEFAULT 'graded'"]]}))for(const [name,type] of columns){if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);}
const audit=(actor,action,details)=>db.prepare('INSERT INTO events(actor,action,details) VALUES(?,?,?)').run(actor,action,JSON.stringify(details));
const attempts=new Map();
// Remove the original single-phone restriction without losing accounts or dependent records.
if(db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get().sql.includes('phone TEXT UNIQUE')){
 db.exec(`PRAGMA foreign_keys=OFF; BEGIN;
 CREATE TABLE users_new(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,password TEXT,role TEXT,school INTEGER,active INTEGER DEFAULT 1);
 INSERT INTO users_new SELECT id,name,phone,password,role,school,active FROM users;
 DROP TABLE users; ALTER TABLE users_new RENAME TO users; COMMIT; PRAGMA foreign_keys=ON;`);
}
if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='code'))db.exec("ALTER TABLE users ADD COLUMN code TEXT");
for(const u of db.prepare('SELECT id FROM users WHERE code IS NULL').all())db.prepare('UPDATE users SET code=? WHERE id=?').run(String(u.id).padStart(6,'0'),u.id);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS user_access_code ON users(code)');
if(!db.prepare('PRAGMA table_info(subjects)').all().some(c=>c.name==='weight'))db.exec('ALTER TABLE subjects ADD COLUMN weight REAL DEFAULT 1');
export function achievement(p){return p===100?'Troféu':p>=90?'Ouro':p>=75?'Prata':p>=60?'Bronze':'Em progresso';}
const appVersion=()=>createHash('sha256').update(['./server.js','./domain.js','./public/index.html','./public/app.js','./public/style.css'].map(file=>readFileSync(new URL(file,import.meta.url))).join('')).digest('hex').slice(0,16);
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 const path=new URL(req.url,'http://localhost').pathname;
 if(req.method==='GET'&&path==='/api/health')return json(res,200,{ok:true});
 if(req.method==='GET'&&path==='/api/version')return json(res,200,{version:appVersion()});
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(res,403,{error:'Origem inválida'});
 if(!path.startsWith('/api/')){res.setHeader('Cache-Control','no-store');const file=path==='/'?'index.html':path.slice(1);if(!['index.html','app.js','style.css'].includes(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');return res.end(readFileSync(new URL(`./public/${file}`,import.meta.url)));}
 let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return json(res,413,{error:'Requisição muito grande'});}try{body=JSON.parse(raw||'{}');}catch{return json(res,400,{error:'JSON inválido'});}if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Dados inválidos'});}
 if(path==='/api/login'&&req.method==='POST'){
 const address=req.socket.remoteAddress,now=Date.now();let attempt=attempts.get(address);if(!attempt||attempt.until<now){attempt={count:0,until:now+600000};attempts.set(address,attempt);}if(attempt.count>=15)return json(res,429,{error:'Muitas tentativas. Aguarde 10 minutos.'});attempt.count++;
 const candidates=db.prepare('SELECT * FROM users WHERE active=1 AND phone=?').all(String(body.phone||'').replace(/\D/g,''));
 const user=body.code?candidates.find(u=>u.code===String(body.code).trim()):candidates.length===1?candidates[0]:null;
 if(!user||!valid(String(body.password||''),user.password))return json(res,401,{error:'Telefone, código ou senha inválidos. Se compartilhar o telefone, informe seu código de acesso'});
 attempt.count=0;
 const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,user.id,Date.now()+86400000);
 res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return json(res,200,{ok:true});}
 const token=(req.headers.cookie||'').match(/(?:^|; )session=([a-f0-9]+)/)?.[1];
 const user=db.prepare('SELECT u.id,u.name,u.phone,u.role,u.school,u.code FROM sessions s JOIN users u ON u.id=s.user WHERE s.token=? AND s.expires>? AND u.active=1').get(token||'',Date.now());
 if(!user)return json(res,401,{error:'Entre para continuar'});
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return json(res,403,{error:'Origem inválida'});
 const subscription=db.prepare('SELECT status,expires FROM subscriptions WHERE user=?').get(user.id)||{status:'active',expires:null};
 const accessActive=subscription.status==='active'&&(!subscription.expires||subscription.expires>=new Date().toISOString().slice(0,10));
 if(['teacher','director'].includes(user.role)&&!accessActive&&!['/api/logout','/api/password','/api/account'].includes(path))return json(res,402,{error:'Acesso suspenso. Solicite a regularização da licença ao administrador.'});
 if(path==='/api/account'&&req.method==='GET')return json(res,200,{user,subscription});
 if(path==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
 const permitted=(a)=>user.role==='admin'||(a.school===user.school&&(user.role==='director'||(user.role==='teacher'&&!!db.prepare('SELECT 1 FROM assignments WHERE teacher=? AND school=? AND class=? AND subject=?').get(user.id,a.school,a.class,a.subject))||(user.role==='student'&&!!db.prepare('SELECT 1 FROM enrollments WHERE student=? AND school=? AND class=?').get(user.id,a.school,a.class))));
 if(path==='/api/dashboard'&&req.method==='GET'){
 const assessments=db.prepare('SELECT * FROM assessments').all().filter(permitted).map(a=>({...a,subjectWeight:db.prepare('SELECT weight FROM subjects WHERE school=? AND name=?').get(a.school,a.subject)?.weight||1,grades:db.prepare('SELECT g.student,u.name,g.score,g.status FROM grades g JOIN users u ON u.id=g.student WHERE assessment=?').all(a.id).filter(g=>user.role!=='student'||g.student===user.id)}));
 const students=db.prepare("SELECT u.id,u.name,e.class,u.school FROM users u JOIN enrollments e ON e.student=u.id WHERE u.role='student'").all().filter(s=>user.role==='admin'||(s.school===user.school&&(user.role==='director'||user.role==='student'&&s.id===user.id||user.role==='teacher'&&db.prepare('SELECT 1 FROM assignments WHERE teacher=? AND class=? AND school=?').get(user.id,s.class,s.school))));
 const visibleMessage=(m)=>user.role==='admin'||m.school===user.school&&(user.role==='director'||user.role==='teacher'&&db.prepare('SELECT 1 FROM assignments WHERE teacher=? AND class=? AND school=?').get(user.id,m.class,m.school)||user.role==='student'&&(!m.student||m.student===user.id)&&students.some(s=>s.class===m.class));
 const messages=db.prepare('SELECT m.*,u.name AS authorName FROM messages m LEFT JOIN users u ON u.id=m.author ORDER BY m.id DESC').all().filter(visibleMessage).map(m=>({...m,reactions:db.prepare('SELECT emoji,COUNT(*) AS count FROM reactions WHERE message=? GROUP BY emoji').all(m.id),myReaction:db.prepare('SELECT emoji FROM reactions WHERE message=? AND user=?').get(m.id,user.id)?.emoji||null}));
 const profile=db.prepare('SELECT birth,father,mother FROM profiles WHERE user=?').get(user.id)||{};
 const schoolRules=db.prepare('SELECT bronze,silver,gold FROM rules WHERE school=?').get(user.school)||defaultRules;
 const catalog=user.role==='admin'?{schools:db.prepare('SELECT * FROM schools').all(),classes:db.prepare('SELECT * FROM classes').all(),subjects:db.prepare('SELECT * FROM subjects').all(),users:db.prepare('SELECT u.id,u.name,u.phone,u.role,u.school,u.active,u.code,p.birth,p.father,p.mother,p.notes FROM users u LEFT JOIN profiles p ON p.user=u.id').all(),enrollments:db.prepare('SELECT * FROM enrollments').all(),links:db.prepare('SELECT * FROM assignments').all(),periods:db.prepare('SELECT * FROM periods').all(),subscriptions:db.prepare('SELECT * FROM subscriptions').all(),events:db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 100').all(),audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all()}:null;
 return json(res,200,{user,profile,catalog,rules:schoolRules,subscription,reports:students.map(s=>({...s,...summarize(assessments,s.id,db.prepare('SELECT bronze,silver,gold FROM rules WHERE school=?').get(s.school)||defaultRules)})),periods:db.prepare('SELECT * FROM periods').all().filter(p=>user.role==='admin'||p.school===user.school),assessments,students,messages,assignments:user.role==='admin'?db.prepare('SELECT * FROM assignments').all():db.prepare('SELECT * FROM assignments WHERE teacher=?').all(user.id)});}
 if(path==='/api/reactions'&&req.method==='POST'){
 if(!['teacher','admin'].includes(user.role))return json(res,403,{error:'Apenas professores e administradores podem reagir'});
 if(!['👍','❤️','👏','😊'].includes(body.emoji))return json(res,400,{error:'Emoji inválido'});
 const m=db.prepare('SELECT * FROM messages WHERE id=?').get(body.message);
 if(!m||user.role!=='admin'&&(m.school!==user.school||!db.prepare('SELECT 1 FROM assignments WHERE teacher=? AND class=? AND school=?').get(user.id,m.class,m.school)))return json(res,403,{error:'Recado não autorizado'});
 const previous=db.prepare('SELECT emoji FROM reactions WHERE message=? AND user=?').get(m.id,user.id);
 if(previous?.emoji===body.emoji)db.prepare('DELETE FROM reactions WHERE message=? AND user=?').run(m.id,user.id);
 else db.prepare('INSERT INTO reactions VALUES(?,?,?) ON CONFLICT(message,user) DO UPDATE SET emoji=excluded.emoji').run(m.id,user.id,body.emoji);
 return json(res,200,{ok:true});}
 if(path==='/api/password'&&req.method==='POST'){
 const stored=db.prepare('SELECT password FROM users WHERE id=?').get(user.id);
 if(!valid(String(body.current||''),stored.password))return json(res,400,{error:'Senha atual incorreta'});
 if(typeof body.password!=='string'||body.password.length<10)return json(res,400,{error:'Use pelo menos 10 caracteres na nova senha'});
 db.prepare('UPDATE users SET password=? WHERE id=?').run(hash(body.password),user.id);
 db.prepare('DELETE FROM sessions WHERE user=? AND token<>?').run(user.id,token);return json(res,200,{ok:true});}
 if(path==='/api/messages'&&req.method==='POST'){
 const school=user.role==='admin'?Number(body.school):user.school;
 const classroom=String(body.class||'');
 if(!['admin','teacher'].includes(user.role)||user.role==='teacher'&&!db.prepare('SELECT 1 FROM assignments WHERE teacher=? AND class=? AND school=?').get(user.id,classroom,school))return json(res,403,{error:'Sem permissão para enviar a esta turma'});
 if(!db.prepare('SELECT 1 FROM classes WHERE school=? AND name=?').get(school,classroom)||!String(body.title||'').trim()||!String(body.body||'').trim())return json(res,400,{error:'Confira turma, título e mensagem'});
 const student=body.student?Number(body.student):null;
 if(student&&!db.prepare('SELECT 1 FROM enrollments WHERE student=? AND class=? AND school=?').get(student,classroom,school))return json(res,400,{error:'Destinatário não pertence à turma'});
 db.prepare('INSERT INTO messages(school,class,title,body,student,author,created) VALUES(?,?,?,?,?,?,?)').run(school,classroom,String(body.title).slice(0,160),String(body.body).slice(0,5000),student,user.id,new Date().toISOString());return json(res,201,{ok:true});}
 if(path.startsWith('/api/admin/')&&req.method==='POST'){
 if(user.role!=='admin')return json(res,403,{error:'Apenas o administrador pode gerenciar cadastros'});
 const kind=path.split('/').pop(), school=Number(body.school);
 if(kind==='subject-weight'){
 if(!Number.isFinite(body.weight)||body.weight<=0||!db.prepare('SELECT 1 FROM subjects WHERE school=? AND name=?').get(school,body.name))return json(res,400,{error:'Disciplina ou peso inválido'});
 db.prepare('UPDATE subjects SET weight=? WHERE school=? AND name=?').run(body.weight,school,body.name);audit(user.id,'subject-weight',body);return json(res,200,{ok:true});}
 if(kind==='rename'){
 const tables={school:'schools',class:'classes',subject:'subjects'},table=tables[body.type];
 if(!table||!String(body.name||'').trim())return json(res,400,{error:'Cadastro inválido'});
 const id=Number(body.id),record=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
 if(!record||body.type!=='school'&&record.school!==school)return json(res,404,{error:'Cadastro não encontrado'});
 if(body.type!=='school'&&db.prepare(`SELECT 1 FROM ${table} WHERE school=? AND name=? AND id<>?`).get(school,String(body.name).trim(),id))return json(res,409,{error:'Nome já utilizado nesta escola'});
 db.exec('BEGIN');try{const name=String(body.name).trim();db.prepare(`UPDATE ${table} SET name=? WHERE id=?`).run(name,id);
 if(body.type==='class')for(const t of ['enrollments','assignments','assessments','messages'])db.prepare(`UPDATE ${t} SET class=? WHERE school=? AND class=?`).run(name,school,record.name);
 if(body.type==='subject')for(const t of ['assignments','assessments'])db.prepare(`UPDATE ${t} SET subject=? WHERE school=? AND subject=?`).run(name,school,record.name);
 audit(user.id,'rename',{type:body.type,id,old:record.name,name});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});}
 if(kind==='reset-password'){
 const target=db.prepare('SELECT id FROM users WHERE id=? AND school=?').get(Number(body.user),school);
 if(!target||typeof body.password!=='string'||body.password.length<10)return json(res,400,{error:'Usuário inválido ou senha menor que 10 caracteres'});
 db.exec('BEGIN');try{db.prepare('UPDATE users SET password=? WHERE id=?').run(hash(body.password),target.id);db.prepare('DELETE FROM sessions WHERE user=?').run(target.id);audit(user.id,'password-reset',{user:target.id});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});}
 if(kind==='user-update'){
 const target=db.prepare('SELECT * FROM users WHERE id=? AND school=?').get(Number(body.id),school);
 if(!target)return json(res,404,{error:'Usuário não encontrado'});
 if(target.role==='admin'&&body.active===false)return json(res,400,{error:'Contas administrativas não podem ser desativadas nesta tela'});
 if(!String(body.name||'').trim())return json(res,400,{error:'Informe o nome'});
 if(body.birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(body.birth)||Number.isNaN(Date.parse(body.birth))||body.birth>new Date().toISOString().slice(0,10)))return json(res,400,{error:'Data de nascimento inválida'});
 db.exec('BEGIN');try{db.prepare('UPDATE users SET name=?,active=? WHERE id=?').run(String(body.name).trim(),body.active===false?0:1,target.id);
 db.prepare('INSERT INTO profiles(user,birth,father,mother,notes) VALUES(?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET birth=excluded.birth,father=excluded.father,mother=excluded.mother,notes=excluded.notes').run(target.id,String(body.birth||''),String(body.father||''),String(body.mother||''),String(body.notes||''));
 if(body.active===false)db.prepare('DELETE FROM sessions WHERE user=?').run(target.id);
 audit(user.id,'user-update',{id:target.id,active:body.active!==false});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});}
 if(kind==='unlink'){
 if(body.type==='enrollment')db.prepare('DELETE FROM enrollments WHERE student=? AND school=? AND class=?').run(Number(body.user),school,body.class);
 else if(body.type==='assignment')db.prepare('DELETE FROM assignments WHERE teacher=? AND school=? AND class=? AND subject=?').run(Number(body.user),school,body.class,body.subject);
 else return json(res,400,{error:'Vínculo inválido'});
 audit(user.id,'unlink',body);return json(res,200,{ok:true});}
 if(kind==='subscriptions'){
 const target=db.prepare("SELECT id FROM users WHERE id=? AND school=? AND role IN ('teacher','director')").get(Number(body.user),school);
 if(!target||!['pending','active','expired','canceled'].includes(body.status)||body.expires&&!/^\d{4}-\d{2}-\d{2}$/.test(body.expires))return json(res,400,{error:'Licença inválida'});
 db.prepare('INSERT INTO subscriptions VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET status=excluded.status,expires=excluded.expires').run(target.id,body.status,body.expires||null);audit(user.id,'subscription',{user:target.id,status:body.status,expires:body.expires||null});return json(res,200,{ok:true});}
 if(kind==='periods'){
 if(!String(body.name||'').trim())return json(res,400,{error:'Informe o período'});
 db.prepare('INSERT INTO periods(school,name,closed) VALUES(?,?,?) ON CONFLICT(school,name) DO UPDATE SET closed=excluded.closed').run(school,String(body.name).trim(),body.closed?1:0);audit(user.id,'period',body);return json(res,201,{ok:true});}
 if(kind==='rules'){
 const {bronze,silver,gold}=body;if(![bronze,silver,gold].every(Number.isFinite)||bronze<0||bronze>=silver||silver>=gold||gold>=100)return json(res,400,{error:'Use limites crescentes: bronze < prata < ouro < 100'});
 db.prepare('INSERT INTO rules VALUES(?,?,?,?) ON CONFLICT(school) DO UPDATE SET bronze=excluded.bronze,silver=excluded.silver,gold=excluded.gold').run(school,bronze,silver,gold);audit(user.id,'rules',body);return json(res,200,{ok:true});}
 if(kind==='schools'){
 if(!String(body.name||'').trim())return json(res,400,{error:'Informe o nome da escola'});
 const result=db.prepare('INSERT INTO schools(name) VALUES(?)').run(String(body.name).trim());db.prepare('INSERT INTO periods(school,name) VALUES(?,?)').run(Number(result.lastInsertRowid),'1º bimestre');return json(res,201,{id:Number(result.lastInsertRowid)});}
 if(!db.prepare('SELECT 1 FROM schools WHERE id=?').get(school))return json(res,400,{error:'Escola inválida'});
 if(['classes','subjects'].includes(kind)){
 if(!String(body.name||'').trim())return json(res,400,{error:'Informe o nome'});
 db.prepare(`INSERT OR IGNORE INTO ${kind}(school,name) VALUES(?,?)`).run(school,String(body.name).trim());return json(res,201,{ok:true});}
 if(kind==='users'){
 const phone=String(body.phone||'').replace(/\D/g,'');
 if(!String(body.name||'').trim()||!/^\d{10,15}$/.test(phone)||!['student','teacher','director','admin'].includes(body.role)||typeof body.password!=='string'||body.password.length<10)return json(res,400,{error:'Confira nome, telefone, perfil e senha (mínimo 10 caracteres)'});

 const birth=String(body.birth||'');if(birth&&(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||Number.isNaN(Date.parse(birth))||birth>new Date().toISOString().slice(0,10)))return json(res,400,{error:'Data de nascimento inválida'});
 db.exec('BEGIN');try{const result=db.prepare('INSERT INTO users(name,phone,password,role,school) VALUES(?,?,?,?,?)').run(String(body.name).trim(),phone,hash(body.password),body.role,school);const id=Number(result.lastInsertRowid);db.prepare('UPDATE users SET code=? WHERE id=?').run(String(id).padStart(6,'0'),id);db.prepare('INSERT INTO profiles(user,birth,father,mother,notes) VALUES(?,?,?,?,?)').run(id,birth,String(body.father||''),String(body.mother||''),String(body.notes||''));db.exec('COMMIT');return json(res,201,{id,code:String(id).padStart(6,'0')});}catch(e){db.exec('ROLLBACK');throw e;}}
 if(['enrollments','assignments'].includes(kind)){
 const role=kind==='enrollments'?'student':'teacher', id=Number(body.user);
 if(!db.prepare('SELECT 1 FROM users WHERE id=? AND role=? AND school=?').get(id,role,school)||!db.prepare('SELECT 1 FROM classes WHERE school=? AND name=?').get(school,body.class))return json(res,400,{error:'Usuário e turma devem pertencer à mesma escola'});
 if(kind==='assignments'&&!db.prepare('SELECT 1 FROM subjects WHERE school=? AND name=?').get(school,body.subject))return json(res,400,{error:'Disciplina inválida'});
 if(kind==='enrollments'){if(!db.prepare('SELECT 1 FROM enrollments WHERE student=? AND class=? AND school=?').get(id,body.class,school))db.prepare('INSERT INTO enrollments VALUES(?,?,?)').run(id,body.class,school);}
 else if(!db.prepare('SELECT 1 FROM assignments WHERE teacher=? AND class=? AND subject=? AND school=?').get(id,body.class,body.subject,school))db.prepare('INSERT INTO assignments VALUES(?,?,?,?)').run(id,body.class,body.subject,school);
 return json(res,201,{ok:true});}
 return json(res,404,{error:'Cadastro não encontrado'});}
 if(path==='/api/grades'&&req.method==='POST'){
 const a=db.prepare('SELECT * FROM assessments WHERE id=?').get(body.assessment);
 if(!a||!['teacher','admin'].includes(user.role)||!permitted(a))return json(res,403,{error:'Sem permissão para alterar esta avaliação'});
 if(!db.prepare('SELECT 1 FROM enrollments WHERE student=? AND class=? AND school=?').get(body.student,a.class,a.school))return json(res,400,{error:'Aluno não pertence à turma'});
 if(db.prepare('SELECT closed FROM periods WHERE school=? AND name=?').get(a.school,a.period)?.closed)return json(res,400,{error:'Período encerrado. O administrador precisa reabri-lo para correções.'});
 const status=body.status||'graded';if(!['graded','absent','exempt'].includes(status))return json(res,400,{error:'Situação inválida'});
 if(status!=='graded')body.score=0;
 if(typeof body.score!=='number'||!Number.isFinite(body.score)||body.score<0||body.score>a.max)return json(res,400,{error:'Nota fora do intervalo permitido'});
 const old=db.prepare('SELECT score FROM grades WHERE assessment=? AND student=?').get(a.id,body.student);
 if(old&&!String(body.reason||'').trim())return json(res,400,{error:'Informe a justificativa da correção'});
 db.exec('BEGIN');try{db.prepare('INSERT INTO grades(assessment,student,score,status) VALUES(?,?,?,?) ON CONFLICT(assessment,student) DO UPDATE SET score=excluded.score,status=excluded.status').run(a.id,body.student,body.score,status);db.prepare('INSERT INTO audit(actor,assessment,student,old,new,reason) VALUES(?,?,?,?,?,?)').run(user.id,a.id,body.student,old?.score??null,body.score,String(body.reason||''));audit(user.id,'grade-status',{assessment:a.id,student:body.student,status});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return json(res,200,{ok:true});}
 if(path==='/api/assessment-update'&&req.method==='POST'){
 const a=db.prepare('SELECT * FROM assessments WHERE id=?').get(Number(body.id));
 if(!a||!['teacher','admin'].includes(user.role)||!permitted(a))return json(res,403,{error:'Avaliação não autorizada'});
 if(db.prepare('SELECT closed FROM periods WHERE school=? AND name=?').get(a.school,a.period)?.closed)return json(res,400,{error:'Período encerrado'});
 if(!String(body.title||'').trim()||!Number.isFinite(body.weight)||body.weight<=0)return json(res,400,{error:'Confira título e peso'});
 db.prepare('UPDATE assessments SET title=?,weight=?,type=?,date=? WHERE id=?').run(String(body.title).trim(),body.weight,String(body.type||a.type),String(body.date||''),a.id);audit(user.id,'assessment-update',{id:a.id,title:body.title,weight:body.weight});return json(res,200,{ok:true});}
 if(path==='/api/assessments'&&req.method==='POST'){
 const a={school:user.role==='admin'?Number(body.school):user.school,class:body.class,subject:body.subject};
 if(!['teacher','admin'].includes(user.role)||!permitted(a))return json(res,403,{error:'Turma ou disciplina não autorizada'});
 if(!String(body.title||'').trim()||!Number.isFinite(body.max)||body.max<=0||!Number.isFinite(body.weight)||body.weight<=0)return json(res,400,{error:'Confira título, pontuação e peso'});
 const period=String(body.period||'1º bimestre'),periodRecord=db.prepare('SELECT closed FROM periods WHERE school=? AND name=?').get(a.school,period);
 if(!periodRecord||periodRecord.closed)return json(res,400,{error:'Período inválido ou encerrado'});
 if(!db.prepare('SELECT 1 FROM classes WHERE school=? AND name=?').get(a.school,a.class)||!db.prepare('SELECT 1 FROM subjects WHERE school=? AND name=?').get(a.school,a.subject))return json(res,400,{error:'Turma ou disciplina inválida'});
 db.prepare('INSERT INTO assessments(title,class,subject,school,max,weight,teacher,period,type,date) VALUES(?,?,?,?,?,?,?,?,?,?)').run(body.title,a.class,a.subject,a.school,body.max,body.weight,user.id,period,String(body.type||'Avaliação'),String(body.date||''));return json(res,201,{ok:true});}
 return json(res,404,{error:'Recurso não encontrado'});
 }catch(e){console.error(e.message);json(res,500,{error:'Não foi possível concluir a operação'});}
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('CEJLA iniciado na porta '+(process.env.PORT||3000)));
