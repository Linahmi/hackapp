const { getData } = require('./lib/dataLoader.js');
const fs = require('fs');
const { requests } = getData();
const currentRequest = requests.find(r => r.request_id === 'REQ-000038');
const currentReqDate = new Date(currentRequest.required_by_date);

function getRegion(countries) {
  if (!countries || !countries.length) return null;
  const EU = new Set(['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK','CH','UK']);
  if (countries.some(c => EU.has(c))) return 'EU';
  return null;
}

const currentRegion = getRegion(currentRequest.delivery_countries);

const matches = requests.filter(r => {
  if (r.request_id === currentRequest.request_id) return false;
  if (r.category_l2 !== currentRequest.category_l2) return false;
  if (!['new', 'open', 'approved'].includes(r.status)) return false; 
  if (getRegion(r.delivery_countries) !== currentRegion) return false;
  if (!r.quantity) return false;
  if (r.required_by_date) {
    const rDate = new Date(r.required_by_date);
    const diffDays = Math.abs((rDate - currentReqDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) return false;
  }
  return true;
});

const out = matches.map(m => `ID: ${m.request_id}, Qty: ${m.quantity}, Date: ${m.required_by_date}, Country: ${m.delivery_countries.join(',')}\n`).join('');
fs.writeFileSync('matches.txt', out);
console.log('wrote matches');
