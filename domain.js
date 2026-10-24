export const defaultRules={bronze:60,silver:75,gold:90};
export function medal(percent,rules=defaultRules){return percent===100?'Troféu':percent>=rules.gold?'Ouro':percent>=rules.silver?'Prata':percent>=rules.bronze?'Bronze':'Em progresso';}
export function summarize(assessments,student,rules=defaultRules){
 const groups=new Map();
 for(const a of assessments){const key=JSON.stringify([a.school,a.class,a.subject,a.period]);if(!groups.has(key))groups.set(key,{school:a.school,class:a.class,subject:a.subject,period:a.period,subjectWeight:a.subjectWeight||1,items:[]});groups.get(key).items.push(a);}
 const disciplines=[...groups.values()].map(({items,...g})=>{let total=0,weight=0,pending=0,exempt=0,absent=0;for(const a of items){const grade=a.grades.find(x=>x.student===student);if(!grade){pending++;continue;}if(grade.status==='exempt'){exempt++;continue;}weight+=a.weight;if(grade.status==='absent')absent++;else total+=(grade.score/a.max)*100*a.weight;}
 const percent=weight?total/weight:null;return {...g,percent,pending,exempt,absent,count:items.length,complete:pending===0,achievement:percent===null?'Sem resultado':medal(percent,rules),trophy:pending===0&&percent===100};});
 const valid=disciplines.filter(d=>d.percent!==null);return {disciplines,overall:valid.length?valid.reduce((s,d)=>s+d.percent*d.subjectWeight,0)/valid.reduce((s,d)=>s+d.subjectWeight,0):null,partial:disciplines.some(d=>!d.complete)};
}
