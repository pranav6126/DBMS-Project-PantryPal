// Regenerate the Chen ER diagram from the explicit schema model below.
const { writeFileSync, mkdirSync } = require('node:fs');
const { instance } = require('@viz-js/viz');
const sharp = require('sharp');
const destination = 'PantryPal_Report_Assets';
const entities = {
  app_user: [ ['user_id','SERIAL','PK'],['name','VARCHAR(80)'],['email','VARCHAR(120)','UK'],['password_hash','VARCHAR(255)'],['role','VARCHAR(10)'],['diet_pref','VARCHAR(15)'],['created_at','TIMESTAMP'] ],
  ingredient: [ ['ingredient_id','SERIAL','PK'],['name','VARCHAR(60)','UK'],['category','VARCHAR(30)'],['shelf_life_days','INT'] ],
  recipe: [ ['recipe_id','SERIAL','PK'],['title','VARCHAR(120)'],['cuisine','VARCHAR(40)'],['diet_type','VARCHAR(10)'],['prep_minutes','INT'],['instructions','TEXT'],['calories','INT'],['times_cooked','INT'],['created_by','INT nullable','FK'] ],
  pantry_item: [ ['pantry_id','SERIAL','PK'],['user_id','INT','FK'],['ingredient_id','INT','FK'],['purchased_on','DATE'],['quantity','VARCHAR(30)'] ],
  recipe_ingredient: [ ['recipe_id','INT','PK,FK'],['ingredient_id','INT','PK,FK'],['quantity','VARCHAR(30)'],['is_optional','BOOLEAN'] ],
  rating: [ ['rating_id','SERIAL','PK'],['user_id','INT','FK'],['recipe_id','INT','FK'],['score','INT'],['comment','TEXT'],['rated_on','DATE'] ],
  meal_plan: [ ['plan_id','SERIAL','PK'],['user_id','INT','FK'],['plan_name','VARCHAR(60)'],['week_start','DATE'] ],
  meal_plan_item: [ ['item_id','SERIAL','PK'],['plan_id','INT','FK'],['recipe_id','INT','FK'],['planned_date','DATE'],['meal_slot','VARCHAR(10)'] ],
  app_session: [ ['session_id','SERIAL','PK'],['user_id','INT','FK'],['token_hash','CHAR(64)','UK'],['created_at','TIMESTAMPTZ'],['expires_at','TIMESTAMPTZ'] ]
};
const links = [
  ['app_user','pantry_item','owns','user_id'],['ingredient','pantry_item','stocked as','ingredient_id'],
  ['app_user','recipe','creates','created_by',true],['recipe','recipe_ingredient','requires','recipe_id'],
  ['ingredient','recipe_ingredient','used in','ingredient_id'],['app_user','rating','gives','user_id'],
  ['recipe','rating','receives','recipe_id'],['app_user','meal_plan','owns plan','user_id'],
  ['meal_plan','meal_plan_item','contains','plan_id'],['recipe','meal_plan_item','scheduled in','recipe_id'],
  ['app_user','app_session','authenticates','user_id']
];
const selected = {
  app_user:['user_id','email','password_hash','diet_pref'],ingredient:['ingredient_id','name','shelf_life_days'],
  recipe:['recipe_id','title','diet_type','times_cooked'],pantry_item:['pantry_id','purchased_on','quantity'],
  recipe_ingredient:['recipe_id','ingredient_id','quantity','is_optional'],rating:['rating_id','score'],
  meal_plan:['plan_id','plan_name','week_start'],meal_plan_item:['item_id','planned_date','meal_slot'],
  app_session:['session_id','token_hash','expires_at']
};
(async () => {
  mkdirSync(destination,{recursive:true});const viz=await instance();
  const common='graph [fontname="Helvetica", bgcolor="white", pad="0.45", nodesep="0.45", ranksep="1.1", splines=polyline]; node [fontname="Helvetica", fontsize=12]; edge [fontname="Helvetica", fontsize=10, color="#52665b", fontcolor="#263b2d"];';
  let chen='graph ER { rankdir=LR; '+common+'\n';
  for(const [name,fields] of Object.entries(entities)) {
    chen+=`${name} [shape=box style=filled fillcolor="#e7f1e9" color="#205e3a" label="${name}" fontsize=16 penwidth=1.4];\n`;
    for(const [field] of fields.filter(x=>selected[name].includes(x[0]))) {
      const key=fields.find(x=>x[0]===field)[2]||'';
      chen+=`${name}_${field} [shape=ellipse label=<${key.includes('PK')?'<U>'+field+'</U>':field}> color="#98aa9d"]; ${name} -- ${name}_${field} [color="#9fac9f"];\n`;
    }
  }
  links.forEach(([parent,child,label,fk,nullable],i)=>{
    chen+=`relationship${i} [shape=diamond label="${label}" style=filled fillcolor="#f7f5e8" color="#9c946f"];\n`;
    chen+=`${parent} -- relationship${i} [headlabel="${nullable?'0..1':'1'}" labeldistance=1.7]; relationship${i} -- ${child} [taillabel="0..N" labeldistance=1.7];\n`;
  });
  chen+='label="PantryPal conceptual ER diagram — Chen notation\nRectangle: entity   Diamond: relationship   Ellipse: attribute   Underline: primary key\nSelected attributes shown for readability; schema.sql lists every column.\nLabels describe the number of related rows at each end."; labelloc=b; fontsize=14; }';
  for(const [name,dot] of [['er-diagram',chen]]) {
    writeFileSync(`${destination}/${name}.dot`,dot);
    const svg=viz.renderString(dot,{format:'svg',engine:'dot'});
    writeFileSync(`${destination}/${name}.svg`,svg);
    await sharp(Buffer.from(svg),{density:160}).png().toFile(`${destination}/${name}.png`);
  }
  writeFileSync('docs/schema-model.json',JSON.stringify({entities,links},null,2)+'\n');
  console.log('Generated Chen SVG/PNG/DOT and schema model for all 9 tables.');
})().catch(e=>{console.error(e);process.exitCode=1;});
