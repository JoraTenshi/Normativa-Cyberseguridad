const fs=require('fs'),path=require('path'),postcss=require('postcss');
const folder=path.resolve(__dirname,'../public-experience');
function files(dir) {return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);}
test('all public demonstration styles are scoped away from real accounts',()=>{
 for(const file of files(folder).filter(f=>f.endsWith('.css'))) {
   postcss.parse(fs.readFileSync(file,'utf8')).walkRules(rule=>{
     if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
     for(const selector of rule.selectors) expect(selector.trim().startsWith('.public-experience')).toBe(true);
   });
 }
});
test('public demonstration uses no real company API or authentication helpers',()=>{
 const text=files(folder).filter(f=>/\.(jsx|js)$/.test(f)).map(f=>fs.readFileSync(f,'utf8')).join('\n');
 expect(text).not.toMatch(/from\s+['"][^'"]*(?:api-client|AuthContext|services\/api)/);
 expect(text).not.toMatch(/fetch\(['"]\/api/);
 expect(text).not.toContain('createRoot(');
});
