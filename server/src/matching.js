// MySQL-friendly, explainable 0-100 weighted matching.
export async function createMatchesForItem(db, itemId) {
  const { rows: [subject] } = await db.query('SELECT * FROM items WHERE id=$1', [itemId]);
  if (!subject || subject.status !== 'open') return [];
  const { rows: candidates } = await db.query(`SELECT * FROM items WHERE kind <> $1 AND status='open' AND category=$2`, [subject.kind, subject.category]);
  const created=[];
  for (const candidate of candidates) {
    const category=100;
    const location=subject.location.toLowerCase()===candidate.location.toLowerCase()?100:0;
    const date=Math.max(0,100-Math.abs((new Date(subject.event_date)-new Date(candidate.event_date))/86400000)*10);
    const words=new Set(`${subject.title} ${subject.description}`.toLowerCase().match(/[a-z0-9]{3,}/g)||[]);
    const candidateWords=new Set(`${candidate.title} ${candidate.description}`.toLowerCase().match(/[a-z0-9]{3,}/g)||[]);
    const keyword=words.size?Math.round([...words].filter(w=>candidateWords.has(w)).length/words.size*100):0;
    const overall=Math.round((.35*category+.25*location+.20*date+.20*keyword)*100)/100;
    if(overall<55) continue;
    const lost=subject.kind==='lost'?subject.id:candidate.id, found=subject.kind==='found'?subject.id:candidate.id;
    await db.query(`INSERT INTO matches(lost_item_id,found_item_id,category_score,location_score,date_score,keyword_score,overall_score)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON DUPLICATE KEY UPDATE category_score=VALUES(category_score),location_score=VALUES(location_score),date_score=VALUES(date_score),keyword_score=VALUES(keyword_score),overall_score=VALUES(overall_score)`,[lost,found,category,location,date,keyword,overall]);
    created.push({lost,found,overall});
  }
  return created;
}
